FROM node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS build
WORKDIR /app
RUN npm install --global pnpm@10.34.9
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
RUN pnpm install --frozen-lockfile --filter @trf/api...
RUN pnpm --filter @trf/api build \
    && pnpm --filter @trf/api deploy --legacy --prod /runtime

FROM node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
RUN mkdir -p /data/documents && chown node:node /data/documents
COPY --from=build --chown=node:node /runtime ./
COPY --chown=node:node db/migrations ./db/migrations
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
