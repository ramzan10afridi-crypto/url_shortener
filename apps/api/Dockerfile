# Multi-stage build for the NestJS API. Designed for AWS App Runner or ECS Fargate.
FROM node:22-alpine AS base
RUN apk add --no-cache openssl && corepack enable

FROM base AS build
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @url-shortener/api prisma:generate
RUN pnpm --filter @url-shortener/shared build
RUN pnpm --filter @url-shortener/api build
RUN pnpm --filter @url-shortener/api --legacy deploy /out
# pnpm deploy rebuilds node_modules from the lockfile, which drops generated
# artifacts, so the client has to be regenerated inside the deployed tree.
RUN cp -r apps/api/prisma /out/prisma && cd /out && ./node_modules/.bin/prisma generate

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /out/prisma ./prisma
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
