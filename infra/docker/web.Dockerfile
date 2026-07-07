# syntax=docker/dockerfile:1
FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /repo
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY . .
WORKDIR /repo/apps/web
ENV NEXT_OUTPUT=standalone
RUN pnpm build

FROM base AS run
WORKDIR /repo/apps/web
ENV NODE_ENV=production
COPY --from=build /repo/apps/web/.next/standalone /repo
COPY --from=build /repo/apps/web/.next/static ./.next/static
COPY --from=build /repo/apps/web/public ./public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
