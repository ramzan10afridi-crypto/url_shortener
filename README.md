# URL Shortener — NestJS + React + Prisma (pnpm monorepo)

A small end-to-end app built to practice AWS deployment. Uses PostgreSQL for both local dev and production (AWS RDS).

## Structure

```
url-shortener/
├── apps/
│   ├── api/            NestJS + Prisma API (create + redirect)
│   └── web/            React + Vite frontend
└── packages/
    └── shared/         Shared types + Zod schemas
```

## Local dev

**Prerequisites:** PostgreSQL running locally (install via the [EDB Windows installer](https://www.postgresql.org/download/windows/) or Docker). Create a database named `url_shortener` (e.g., in pgAdmin: right-click Databases → Create → Database…).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env and set DATABASE_URL to your local Postgres connection string
pnpm --filter @url-shortener/api prisma:migrate --name init
pnpm dev
```

- API: http://localhost:3001
- Web: http://localhost:5173
- Redirects: `GET http://localhost:3001/{code}` → 302

### Running api or web individually

```bash
pnpm dev:api      # only the NestJS API
pnpm dev:web      # only the Vite dev server
```

## Endpoints

| Method | Path            | Purpose                    |
| ------ | --------------- | -------------------------- |
| POST   | `/api/urls`     | Create a short URL         |
| GET    | `/api/urls`     | List recent URLs           |
| GET    | `/:shortCode`   | Redirect + increment click |
| GET    | `/health`       | Health check               |

## Pointing at AWS RDS (production)

1. Provision an RDS Postgres instance (or Aurora Serverless v2).
2. Set `DATABASE_URL="postgresql://user:pass@<rds-endpoint>:5432/urlshortener?schema=public"` in your deployment environment (via AWS Secrets Manager).
3. Run migrations against RDS: `pnpm --filter @url-shortener/api prisma:deploy`.

## AWS deployment plan

**Frontend (React static)** — S3 + CloudFront + Route 53 + ACM
- `pnpm --filter @url-shortener/web build` → sync `apps/web/dist` to an S3 bucket
- CloudFront distribution in front with SPA fallback to `/index.html`

**Backend (NestJS container)** — App Runner (simplest) or ECS Fargate
- Build the image: `docker build -f apps/api/Dockerfile -t url-shortener-api .`
- Push to ECR, deploy to App Runner
- Store `DATABASE_URL` in AWS Secrets Manager, inject via App Runner env

**Database** — RDS Postgres (or Aurora Serverless v2)
- Private subnet, security group allows only the App Runner VPC connector

**DNS/TLS** — Route 53 for the domain, ACM cert attached to CloudFront (frontend) and App Runner custom domain (API)

**CI/CD** — GitHub Actions
- On push to `main`: build API image → push to ECR → App Runner auto-deploys
- Frontend: build + `aws s3 sync` + `aws cloudfront create-invalidation`

## Scripts

```bash
pnpm dev                 # run api + web in parallel
pnpm build               # build all packages
pnpm typecheck           # typecheck all packages
pnpm db:migrate          # run prisma migrations
pnpm db:studio           # open Prisma Studio
```
