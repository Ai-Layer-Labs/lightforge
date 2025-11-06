# Build stage
FROM rust:1.88 AS builder

WORKDIR /app

# Copy workspace Cargo.toml
COPY Cargo.toml ./

# Copy all crate manifests (required by workspace)
COPY crates/ ./crates/

# Build release (only context-builder)
RUN cargo build -p rcrt-context-builder --release

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy binary
COPY --from=builder /app/target/release/rcrt-context-builder /app/rcrt-context-builder

# Run as non-root
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

CMD ["/app/rcrt-context-builder"]

