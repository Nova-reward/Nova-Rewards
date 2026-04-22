#!/usr/bin/env bash
set -euo pipefail

if ! command -v rustup >/dev/null 2>&1; then
  echo "rustup is required. Install Rust from https://rustup.rs first." >&2
  exit 1
fi

if ! command -v stellar >/dev/null 2>&1; then
  echo "stellar CLI is required. Install it from https://developers.stellar.org/docs/tools/cli/install-cli" >&2
  exit 1
fi

rustup target add wasm32v1-none

stellar network add local \
  --rpc-url "http://localhost:8000/rpc" \
  --network-passphrase "Standalone Network ; February 2017" >/dev/null 2>&1 || true

echo "Rust toolchain:"
rustc --version
cargo --version
echo "Stellar CLI:"
stellar --version
