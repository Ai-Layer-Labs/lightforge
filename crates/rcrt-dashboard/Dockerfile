# Multi-stage build for rcrt-dashboard
FROM rust:1.82-slim as builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY crates/rcrt-core ./crates/rcrt-core
COPY crates/rcrt-server ./crates/rcrt-server
COPY crates/rcrt-dashboard ./crates/rcrt-dashboard

# Build the dashboard
RUN cargo build --release -p rcrt-dashboard

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the binary
COPY --from=builder /app/target/release/rcrt-dashboard /app/rcrt-dashboard

# Copy static files from the dashboard crate
COPY --from=builder /app/crates/rcrt-dashboard/static /app/static

EXPOSE 8082

CMD ["./rcrt-dashboard"]
