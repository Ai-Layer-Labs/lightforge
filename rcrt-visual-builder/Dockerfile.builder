# Dockerfile for Visual Builder UI
FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm@8

# Set working directory
WORKDIR /workspace

# Copy workspace files
COPY pnpm-workspace.yaml package.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/node-sdk/package.json ./packages/node-sdk/
COPY packages/runtime/package.json ./packages/runtime/
COPY packages/ui/package.json ./packages/ui/
COPY packages/management/package.json ./packages/management/
COPY packages/heroui-breadcrumbs/package.json ./packages/heroui-breadcrumbs/
COPY apps/builder/package.json ./apps/builder/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages ./packages
COPY apps/builder ./apps/builder

# Build packages
RUN pnpm --filter "@rcrt-builder/*" build

# Expose port
EXPOSE 3000

# Start development server
WORKDIR /workspace/apps/builder
CMD ["pnpm", "dev", "--host", "0.0.0.0"]
