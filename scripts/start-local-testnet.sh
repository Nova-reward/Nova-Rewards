#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run the local standalone Stellar testnet." >&2
  exit 1
fi

if ! command -v stellar >/dev/null 2>&1; then
  echo "stellar CLI is required before starting the local testnet." >&2
  exit 1
fi

docker rm -f stellar-local >/dev/null 2>&1 || true
docker run -d --rm \
  -p 8000:8000 \
  --name stellar-local \
  stellar/quickstart:testing \
  --local \
  --enable-stellar-rpc >/dev/null

stellar network add local \
  --rpc-url "http://localhost:8000/rpc" \
  --network-passphrase "Standalone Network ; February 2017" >/dev/null 2>&1 || true

echo "Local standalone network is starting on http://localhost:8000/rpc"
