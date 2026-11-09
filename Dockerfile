# Dahan production image. One stage on purpose: the operator CLIs (`pnpm org:create`,
# `pnpm leads`, `pnpm reset-owner-password`) run through tsx, a devDependency, so the full
# node_modules stays in the image. See DEPLOYMENT-DOCKER.md.
FROM node:24-bookworm-slim

# Same pnpm as `packageManager` in package.json (installed directly: no corepack download at runtime).
RUN npm install -g pnpm@10.17.0 \
 && apt-get update \
 && apt-get install -y --no-install-recommends sqlite3 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# The generated client is git-ignored, so it is built here; `next build` needs it.
RUN pnpm prisma generate && pnpm build

# The container runs as an arbitrary uid (compose `user:`), so the app's writable paths are open
# and HOME points somewhere writable (pnpm, tsx caches).
RUN mkdir -p .next/cache /data && chmod -R a+rwX .next/cache /data
ENV NODE_ENV=production \
    HOME=/tmp \
    DATABASE_URL=file:/data/production.db \
    PORT=3000 \
    HOSTNAME=0.0.0.0

EXPOSE 3000
VOLUME /data
ENTRYPOINT ["/app/deploy/docker/entrypoint.sh"]
CMD ["pnpm", "start", "-H", "0.0.0.0", "-p", "3000"]
