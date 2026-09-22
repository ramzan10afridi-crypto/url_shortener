# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm 10** (see `packageManager` in root `package.json`); Node >= 20.

Root scripts (fan out across the workspace):

```bash
pnpm dev            # api + web in parallel (nest --watch, vite)
pnpm dev:api        # api only
pnpm dev:web        # web only
pnpm build          # build all workspace packages
pnpm build:api      # build api only
pnpm build:web      # build web only
pnpm start:api      # run the built api (node dist/main.js)
pnpm preview:web    # preview the built web bundle
pnpm typecheck      # tsc --noEmit across all packages
pnpm lint           # runs `lint` in each package (none defined yet)
pnpm db:generate    # prisma generate (api)
pnpm db:migrate     # prisma migrate dev (api)
pnpm db:studio      # prisma studio (api)
```

Targeting a single workspace uses pnpm filters, e.g.:

```bash
pnpm --filter @url-shortener/api dev
pnpm --filter @url-shortener/api prisma:migrate --name <migration-name>
pnpm --filter @url-shortener/api prisma:deploy      # production migrations
pnpm --filter @url-shortener/web build
```

No test runner is configured yet — there is no `test` script in any package.

First-time setup:

```bash
# Requires a local PostgreSQL server; create a `url_shortener` database first (e.g., via pgAdmin)
pnpm install
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — set DATABASE_URL to your local Postgres connection string
pnpm --filter @url-shortener/api prisma:migrate --name init
```

Dev URLs: API `http://localhost:3001`, Web `http://localhost:5173`, redirect `GET http://localhost:3001/r/{code}`.

## Architecture

pnpm monorepo with three workspaces defined by `pnpm-workspace.yaml` (`apps/*`, `packages/*`):

- **`apps/api`** — NestJS 10 + Prisma. Entry `src/main.ts` bootstraps `AppModule` (`src/app.module.ts`) with helmet, CORS (origins from `CORS_ORIGIN` env, comma-separated), and a global `ValidationPipe({ whitelist: true, transform: true })`. Two route surfaces share the same Nest app:
  - `UrlsModule` (`src/urls/`) mounts under `/api/urls` — create + list.
  - `RedirectController` (`src/redirect/`) serves `GET /r/:shortCode` and increments `clicks`. It was originally mounted at the root, where `/:shortCode` shadowed `/health` and broke the ALB health check; it also collided with the SPA once both were served from one CloudFront domain. Keep it under `/r` — nothing should be mounted at the application root.
  - `HealthController` serves `/health`.
  - `PrismaModule`/`PrismaService` (`src/prisma/`) is the single DB gateway injected into services.
- **`apps/web`** — React 18 + Vite. Talks to the API via `src/api.ts`; UI is a single `App.tsx`.
- **`packages/shared`** — Workspace package compiled with `tsc` to CommonJS (`main`/`types` point at `dist/`); `pnpm dev` runs it in watch mode. It must be built before `apps/api`, since the API's compiled output `require()`s it at runtime — `pnpm -r build` handles the ordering, and the api Dockerfile builds it explicitly. Exports Zod schemas (`CreateUrlSchema`) and DTO types used by both api and web. Consumers import via `@url-shortener/shared` (`workspace:*`).

TypeScript config is centralised in `tsconfig.base.json` (ES2022, `moduleResolution: "Bundler"`, strict). Each workspace extends it.

### Database

Prisma schema at `apps/api/prisma/schema.prisma`. Single `Url` model (`shortCode` unique, `clicks`, `createdAt` indexed). **PostgreSQL is used for both local dev and production** — locally against a Postgres server on `localhost:5432` (managed via pgAdmin or similar), in production against AWS RDS. The connection string is provided via the `DATABASE_URL` env var; migrations under `apps/api/prisma/migrations/` are Postgres-flavoured.

### Shared schema flow

Validation lives in `packages/shared` as Zod schemas. The API layers Nest's `class-validator` pipeline on top for DTOs, but treat `packages/shared` as the source of truth for request/response shapes so the web client and API stay in sync.

## Deployment context

Deployed to AWS in `us-east-1`, account `695746119332`. Live at **https://d3t588gbr3lp9p.cloudfront.net**.

One CloudFront distribution (`E2LCSYNUEOV3WI`) fronts everything, so the browser sees a single origin — which is why there is no ACM certificate and why CORS is not a factor:

```
/api/*   → ALB → ECS Fargate    (CachingDisabled, AllViewer origin-request policy)
/r/*     → ALB → ECS Fargate    (CachingDisabled — a cached 302 would stop counting clicks)
/health  → ALB → ECS Fargate
*        → S3 (private, OAC)    (403/404 → /index.html 200 for SPA routes)
```

- **API**: `apps/api/Dockerfile` → ECR `url-shortener-api` → ECS service `url-shortener-api-service` on cluster `url-shortener-cluster`, behind ALB `url-shortener-alb`. The ALB must have every AZ enabled that the service's subnets span, or tasks register as `Target.NotInUse`.
- **Web**: `apps/web/dist` → S3 `url-shortener-web-695746119332` (Block Public Access on; readable only by this distribution via OAC).
- **DB**: RDS PostgreSQL `url-shortener-db`. Fargate reaches it via security-group reference; local access depends on a "My IP" rule that goes stale often.
- **Secrets**: still plaintext env vars on the task definition. Moving them to Secrets Manager is outstanding, as is rotating them.

### CI/CD

`.github/workflows/deploy-api.yml` and `deploy-web.yml` deploy on push to `main`, each filtered by path so unrelated changes don't trigger a deploy. Both authenticate via **GitHub OIDC** — assuming role `github-actions-url-shortener`, scoped to this repo's `main` branch — so there are no long-lived AWS keys in GitHub secrets.

The API workflow tags images with the commit SHA, pulls the current task definition from AWS (rather than committing one, which would put secrets in git), swaps only the image, and waits for service stability. The web workflow uploads fingerprinted assets with a one-year immutable cache, then `index.html` with no-cache, then invalidates CloudFront.
