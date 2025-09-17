# Dockerfile for Visual Builder UI
FROM node:20-alpine

# Use corepack to pin pnpm version compatible with lockfile
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

# Set working directory
WORKDIR /workspace

# Copy workspace files (include lockfile for deterministic install)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/node-sdk/package.json ./packages/node-sdk/
COPY packages/runtime/package.json ./packages/runtime/
COPY packages/ui/package.json ./packages/ui/
COPY packages/management/package.json ./packages/management/
COPY packages/heroui-breadcrumbs/package.json ./packages/heroui-breadcrumbs/
COPY apps/builder/package.json ./apps/builder/

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY packages ./packages
COPY apps/builder ./apps/builder

# Link workspace and per-package bins after sources are present
RUN pnpm install --no-frozen-lockfile

# Build packages (skip DTS for speed/compat)
ENV TSUP_DTS=false
RUN pnpm --filter "@rcrt-builder/*" build

# Expose port
EXPOSE 3000

# Start development server
WORKDIR /workspace/apps/builder
CMD ["pnpm", "dev", "-H", "0.0.0.0"]
