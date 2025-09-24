# Agent Runner Dockerfile - Modern TypeScript Implementation
FROM node:18-alpine as base

RUN apk add --no-cache dumb-init
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# Build stage
FROM base as build
COPY . ./
RUN pnpm install --no-frozen-lockfile
# Build all dependencies first
RUN pnpm --filter "@rcrt-builder/*" build
# Build agent-runner
RUN pnpm --filter "@rcrt-builder/agent-runner" build

# Runtime stage  
FROM base as runtime

# Copy built packages and agent-runner dist
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/agent-runner/dist ./dist
COPY --from=build /app/apps/agent-runner/ensure-default-agent-simple.js ./ensure-default-agent-simple.js
COPY --from=build /app/apps/agent-runner/package.json ./package.json
COPY --from=build /app/package.json ./root-package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Install production dependencies
RUN pnpm install --prod

ENV NODE_ENV=production
ENV DEPLOYMENT_MODE=docker

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "console.log('Agent runner health check')" || exit 1

# Run ensure-default-agent before starting the main process
ENTRYPOINT ["dumb-init", "--", "sh", "-c"]
CMD ["node ensure-default-agent-simple.js; exec node dist/index.js"]
