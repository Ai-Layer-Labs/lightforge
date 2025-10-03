FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy all packages and apps needed
COPY packages/ ./packages/
COPY apps/context-builder/ ./apps/context-builder/

# Install pnpm and dependencies
RUN npm install -g pnpm@8
RUN pnpm install --no-frozen-lockfile

# Build packages first, then the app
RUN pnpm --filter @rcrt-builder/core build || echo "Core already built"
RUN pnpm --filter @rcrt-builder/sdk build
RUN pnpm --filter @rcrt-builder/tools build
RUN pnpm --filter @rcrt-builder/context-builder build

WORKDIR /app/apps/context-builder

CMD ["node", "dist/index.js"]

