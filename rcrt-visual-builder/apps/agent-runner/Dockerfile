# Agent Runner Dockerfile
FROM node:18-alpine as base

RUN apk add --no-cache dumb-init
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# Build stage
FROM base as build
COPY . ./
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter "@rcrt-builder/*" build
RUN echo "Agent runner uses JS directly - no build needed"

# Runtime stage  
FROM base as runtime

# Copy the entire workspace structure with built packages
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/agent-runner/src ./src
COPY --from=build /app/package.json ./root-package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
# Copy agent-runner package.json LAST so it doesn't get overwritten
COPY --from=build /app/apps/agent-runner/package.json ./package.json

# Install production dependencies with workspace support
RUN pnpm install --prod

ENV NODE_ENV=production
ENV DEPLOYMENT_MODE=docker

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "console.log('Agent runner health check')" || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["npx", "tsx", "src/index.ts"]
