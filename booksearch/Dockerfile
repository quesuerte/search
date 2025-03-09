FROM rust:latest AS builder
#RUN rustup target add x86_64-unknown-linux-musl
#RUN apt-get update && apt-get install -y musl-tools musl-dev openssl libssl-dev
RUN apt-get update && apt-get install -y openssl libssl-dev
WORKDIR /opt
COPY Cargo.toml Cargo.toml
COPY ./src ./src
#RUN cargo build --target x86_64-unknown-linux-musl --release --verbose
RUN cargo build --release --verbose

# FROM alpine:latest
# RUN apk add --no-cache openssl
# RUN addgroup -S search && adduser -S -G search search
#COPY --from=builder --chown=search:search --chmod=500 /opt/target/x86_64-unknown-linux-musl/release/booksearch /opt/booksearch

FROM debian:stable-slim
RUN apt-get update && apt-get install -y \
openssl \
ca-certificates \
&& rm -rf /var/lib/apt/lists/*
# Create a system group
RUN addgroup --system search && adduser --system --ingroup search --no-create-home search
COPY --from=builder --chown=search:search --chmod=500 /opt/target/release/booksearch /opt/booksearch
USER search
WORKDIR /opt
CMD ["./booksearch"]
