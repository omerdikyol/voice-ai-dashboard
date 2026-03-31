FROM node:22-alpine

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"

WORKDIR /app

RUN corepack enable

COPY apps/web/package.json apps/web/pnpm-lock.yaml apps/web/tsconfig.json apps/web/next.config.ts apps/web/postcss.config.mjs apps/web/components.json /app/
COPY apps/web/public /app/public
COPY apps/web/app /app/app
COPY apps/web/components /app/components
COPY apps/web/lib /app/lib
COPY apps/web/hooks /app/hooks

RUN pnpm install --frozen-lockfile || pnpm install

EXPOSE 3000

CMD ["pnpm", "dev", "--hostname", "0.0.0.0", "--port", "3000"]
