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

Dev URLs: API `http://localhost:3001`, Web `http://localhost:5173`, redirect `GET http://localhost:3001/{code}`.

## Architecture

pnpm monorepo with three workspaces defined by `pnpm-workspace.yaml` (`apps/*`, `packages/*`):

- **`apps/api`** — NestJS 10 + Prisma. Entry `src/main.ts` bootstraps `AppModule` (`src/app.module.ts`) with helmet, CORS (origins from `CORS_ORIGIN` env, comma-separated), and a global `ValidationPipe({ whitelist: true, transform: true })`. Two route surfaces share the same Nest app:
  - `UrlsModule` (`src/urls/`) mounts under `/api/urls` — create + list.
  - `RedirectController` (`src/redirect/`) owns the root `GET /:shortCode` route and increments `clicks`. Because it lives at the root, any new top-level route must not collide with a short code shape.
  - `HealthController` serves `/health`.
  - `PrismaModule`/`PrismaService` (`src/prisma/`) is the single DB gateway injected into services.
- **`apps/web`** — React 18 + Vite. Talks to the API via `src/api.ts`; UI is a single `App.tsx`.
- **`packages/shared`** — Source-only workspace package (`main`/`types` point at `src/index.ts`, no build step). Exports Zod schemas (`CreateUrlSchema`) and DTO types used by both api and web. Consumers import via `@url-shortener/shared` (`workspace:*`).

TypeScript config is centralised in `tsconfig.base.json` (ES2022, `moduleResolution: "Bundler"`, strict). Each workspace extends it.

### Database

Prisma schema at `apps/api/prisma/schema.prisma`. Single `Url` model (`shortCode` unique, `clicks`, `createdAt` indexed). **PostgreSQL is used for both local dev and production** — locally against a Postgres server on `localhost:5432` (managed via pgAdmin or similar), in production against AWS RDS. The connection string is provided via the `DATABASE_URL` env var; migrations under `apps/api/prisma/migrations/` are Postgres-flavoured.

### Shared schema flow

Validation lives in `packages/shared` as Zod schemas. The API layers Nest's `class-validator` pipeline on top for DTOs, but treat `packages/shared` as the source of truth for request/response shapes so the web client and API stay in sync.

## Deployment context

The README lays out an AWS target (S3+CloudFront for web, App Runner or ECS Fargate for api container, RDS Postgres, Secrets Manager for `DATABASE_URL`, GitHub Actions CI/CD). There is no Dockerfile or CI workflow committed yet — the README references `apps/api/Dockerfile` as a future artifact.
