# syntax=docker/dockerfile:1
# Production image for Open ClickUp (Vite 6 + React 19 + Hono + Prisma 7 + Postgres).

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.6.1 --activate
WORKDIR /app

# --- install dependencies (cached on lockfile) ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts \
  && pnpm rebuild @prisma/engines prisma esbuild

# --- build the app ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate && pnpm build

# --- runtime ---
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build /app ./
EXPOSE 3000
CMD ["sh", "-c", "pnpm prisma migrate deploy && pnpm start"]
