# syntax=docker/dockerfile:1

FROM rust:1.88 as builder

# Install dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Detect architecture for ONNX Runtime
ARG TARGETARCH
ARG FEATURES="embed-onnx nats"

COPY Cargo.toml ./
COPY crates/rcrt-core/Cargo.toml crates/rcrt-core/Cargo.toml
COPY crates/rcrt-server/Cargo.toml crates/rcrt-server/Cargo.toml
COPY migrations migrations
COPY docs docs
COPY crates/ crates/

# Pre-fetch dependencies
RUN cargo fetch

# Bundle embedding model and tokenizer
RUN mkdir -p /app/models && \
    curl -fsSL -o /app/models/model.onnx https://huggingface.co/onnx-models/all-MiniLM-L6-v2-onnx/resolve/main/model.onnx && \
    curl -fsSL -o /app/models/tokenizer.json https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/tokenizer.json

# Download ONNX Runtime for the target architecture
# Using v1.22.0 to match the ort crate requirements
RUN mkdir -p /app/onnx && \
    if [ "$TARGETARCH" = "arm64" ]; then \
        echo "📱 Building for ARM64..." && \
        wget -q -O /tmp/onnxruntime.tgz https://github.com/microsoft/onnxruntime/releases/download/v1.22.0/onnxruntime-linux-aarch64-1.22.0.tgz; \
    else \
        echo "💻 Building for x64..." && \
        wget -q -O /tmp/onnxruntime.tgz https://github.com/microsoft/onnxruntime/releases/download/v1.22.0/onnxruntime-linux-x64-1.22.0.tgz; \
    fi && \
    tar -xzf /tmp/onnxruntime.tgz -C /app/onnx --strip-components=1 && \
    rm /tmp/onnxruntime.tgz

# Ensure ONNX libs are available
RUN cp /app/onnx/lib/libonnxruntime.so* /usr/local/lib/ && \
    echo "/usr/local/lib" > /etc/ld.so.conf.d/onnx.conf && \
    ldconfig

# Set build environment
ENV LD_LIBRARY_PATH=/usr/local/lib:/app/onnx/lib:$LD_LIBRARY_PATH
ENV ORT_DYLIB_PATH=/usr/local/lib/libonnxruntime.so
RUN cargo clean && \
    if [ -n "$FEATURES" ]; then \
      cargo build -p rcrt-server --release --features "$FEATURES"; \
    else \
      cargo build -p rcrt-server --release; \
    fi

# Runtime stage - using debian for better compatibility
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built binary and resources
COPY --from=builder /app/target/release/rcrt-server /app/rcrt-server
COPY --from=builder /app/migrations /app/migrations
COPY --from=builder /app/models /app/models
COPY --from=builder /app/onnx /app/onnx

# Copy ONNX libraries to runtime
COPY --from=builder /usr/local/lib/libonnxruntime.so* /usr/local/lib/
RUN echo "/usr/local/lib" > /etc/ld.so.conf.d/onnx.conf && ldconfig

# Set runtime environment
ENV RUST_LOG=info
ENV EMBED_MODEL=/app/models/model.onnx
ENV EMBED_TOKENIZER=/app/models/tokenizer.json
ENV LD_LIBRARY_PATH=/usr/local/lib:/app/onnx/lib
ENV ORT_DYLIB_PATH=/usr/local/lib/libonnxruntime.so

EXPOSE 8080
ENTRYPOINT ["/app/rcrt-server"]


