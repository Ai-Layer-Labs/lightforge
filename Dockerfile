# syntax=docker/dockerfile:1

FROM rust:1.85 as builder
WORKDIR /app
ARG FEATURES
COPY Cargo.toml ./
COPY crates/rcrt-core/Cargo.toml crates/rcrt-core/Cargo.toml
COPY crates/rcrt-server/Cargo.toml crates/rcrt-server/Cargo.toml
COPY migrations migrations
COPY docs docs
COPY crates/ crates/

# Pre-fetch dependencies now that full sources are present
RUN cargo fetch
# Bundle embedding model and tokenizer (public files)
RUN mkdir -p /app/models && \
    curl -fsSL -o /app/models/model.onnx https://huggingface.co/onnx-models/all-MiniLM-L6-v2-onnx/resolve/main/model.onnx && \
    curl -fsSL -o /app/models/tokenizer.json https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/tokenizer.json

# Bundle ONNX Runtime shared library for embed-onnx (CPU, linux x64)
RUN mkdir -p /app/onnx && \
    curl -fsSL -o /tmp/onnxruntime.tgz https://github.com/microsoft/onnxruntime/releases/download/v1.22.0/onnxruntime-linux-x64-1.22.0.tgz && \
    tar -xzf /tmp/onnxruntime.tgz -C /app/onnx --strip-components=1 && \
    rm /tmp/onnxruntime.tgz
RUN cargo clean && \
    if [ -n "$FEATURES" ]; then \
      cargo build -p rcrt-server --release --features "$FEATURES"; \
    else \
      cargo build -p rcrt-server --release; \
    fi

FROM gcr.io/distroless/cc-debian12
WORKDIR /app
COPY --from=builder /app/target/release/rcrt-server /app/rcrt-server
COPY --from=builder /app/migrations /app/migrations
COPY --from=builder /app/models /app/models
COPY --from=builder /app/onnx /app/onnx
ENV RUST_LOG=info
ENV EMBED_MODEL=/app/models/model.onnx
ENV EMBED_TOKENIZER=/app/models/tokenizer.json
ENV LD_LIBRARY_PATH=/app/onnx/lib
EXPOSE 8080
ENTRYPOINT ["/app/rcrt-server"]


