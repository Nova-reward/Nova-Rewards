$ErrorActionPreference = "Stop"

function Require-Command {
    param([string] $Name, [string] $InstallHint)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw $InstallHint
    }
}

Require-Command -Name "docker" -InstallHint "Docker Desktop is required to run the local standalone Stellar testnet."
Require-Command -Name "stellar" -InstallHint "stellar CLI is required before starting the local testnet."

docker rm -f stellar-local *> $null
docker run -d --rm `
    -p 8000:8000 `
    --name stellar-local `
    stellar/quickstart:testing `
    --local `
    --enable-stellar-rpc | Out-Null

try {
    stellar network add local `
        --rpc-url "http://localhost:8000/rpc" `
        --network-passphrase "Standalone Network ; February 2017" | Out-Null
} catch {
}

Write-Host "Local standalone network is starting on http://localhost:8000/rpc"
