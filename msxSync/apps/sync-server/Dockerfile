FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY apps/sync-server/package.json ./apps/sync-server/package.json

RUN pnpm install --filter sync-server...

COPY apps/sync-server ./apps/sync-server

WORKDIR /app/apps/sync-server

EXPOSE 8788

CMD ["pnpm", "dev"]
