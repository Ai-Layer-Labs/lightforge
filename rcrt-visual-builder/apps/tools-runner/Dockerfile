# RCRT Tools Runner - Docker deployment
FROM node:18-alpine AS base
RUN apk add --no-cache dumb-init
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY apps/tools-runner/package.json ./apps/tools-runner/

# Install prod dependencies workspace-wide
RUN pnpm install --filter . --prod --frozen-lockfile

FROM base AS build
# Copy sources
COPY . ./

# Install all dependencies (including dev)
RUN pnpm install --no-frozen-lockfile

# Build dependencies required by tools-runner (skip DTS for docker)
ENV TSUP_DTS=false
RUN pnpm --filter @rcrt-builder/tools build
# Build tools-runner with deps bundled (noExternal in tsup config)
RUN pnpm --filter @rcrt-builder/tools-runner build

FROM base AS runtime

# Install Deno for self-contained tools execution using official installer
RUN apk add --no-cache curl bash ca-certificates \
    && curl -fsSL https://deno.land/install.sh | sh -s v1.48.1 \
    && mv /root/.deno/bin/deno /usr/local/bin/deno \
    && chmod +x /usr/local/bin/deno \
    && deno --version

# Copy built output with dependencies embedded
COPY --from=build /app/apps/tools-runner/dist ./apps/tools-runner/dist
COPY --from=build /app/apps/tools-runner/package.json ./apps/tools-runner/
# Copy workspace structure and dependencies
COPY --from=build /app/packages ./packages
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml

# CRITICAL: Copy tool source folders with definition.json files for dynamic discovery!
# Bootstrap-tools scans these folders to find definition.json
COPY --from=build /app/packages/tools/src ./packages/tools/src

# Install production dependencies in runtime
RUN pnpm install --prod --filter @rcrt-builder/tools-runner...

# Environment
ENV NODE_ENV=production
ENV DEPLOYMENT_MODE=docker
ENV RCRT_BASE_URL=http://rcrt:8081
ENV WORKSPACE=workspace:tools

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)"

EXPOSE 3001

USER node
ENTRYPOINT ["dumb-init", "--", "node", "apps/tools-runner/dist/index.js"]
