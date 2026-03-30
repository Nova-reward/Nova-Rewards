# Soroban Contracts

This workspace contains the Nova Rewards Soroban smart contracts and is set up
to follow the current Stellar CLI and Rust target conventions.

## Prerequisites

- Rust `stable` with the `wasm32v1-none` target
- `stellar` CLI
- Docker Desktop (or another Docker-compatible runtime) if you want a local
  standalone testnet

The repo includes helper scripts in [`scripts`](../scripts) to install and
verify the toolchain on Windows PowerShell and POSIX shells.

On Windows, prefer the PowerShell helper scripts because they strip Git's
`usr/bin` directory from `PATH` before invoking Rust, which avoids the common
`link.exe` collision with Git for Windows.

## Common Commands

From the repository root:

```bash
cargo contracts-test
cargo contracts-build
```

Or use the helper scripts:

```bash
./scripts/test-contracts.sh
./scripts/build-contracts.sh
```

PowerShell:

```powershell
./scripts/test-contracts.ps1
./scripts/build-contracts.ps1
```

The PowerShell test helper uses the local GNU Rust toolchain when it is
available. On Windows that path runs a full workspace `cargo check`, a real
`wasm32v1-none` release build, and the locally runnable contract tests while CI
keeps enforcing the full workspace `cargo test` job on Linux.

Build artifacts are written to `contracts/target/wasm32v1-none/release`.

## Local Standalone Network

Start the local RPC-enabled network:

```bash
./scripts/start-local-testnet.sh
```

PowerShell:

```powershell
./scripts/start-local-testnet.ps1
```

This uses the recommended `stellar/quickstart:testing --local
--enable-stellar-rpc` container and configures a `local` network entry for the
Stellar CLI at `http://localhost:8000/rpc`.
