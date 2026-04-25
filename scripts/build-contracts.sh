#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$REPO_ROOT"
cargo build --manifest-path contracts/Cargo.toml --workspace --target wasm32v1-none --release

echo "Built contracts into contracts/target/wasm32v1-none/release"
