$ErrorActionPreference = "Stop"

function Require-Command {
    param([string] $Name, [string] $InstallHint)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw $InstallHint
    }
}

$gnuCargo = Join-Path $env:USERPROFILE ".rustup\toolchains\stable-x86_64-pc-windows-gnu\bin\cargo.exe"
$gnuRustc = Join-Path $env:USERPROFILE ".rustup\toolchains\stable-x86_64-pc-windows-gnu\bin\rustc.exe"
$cargo = if (Test-Path $gnuCargo) { $gnuCargo } else { $null }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot
$env:PATH = (($env:PATH -split ";") | Where-Object { $_ -and $_ -notmatch "\\Git\\usr\\bin$" } | Select-Object -Unique) -join ";"
if (Test-Path $gnuRustc) {
    $env:RUSTC = $gnuRustc
}

Require-Command -Name "rustup" -InstallHint "rustup is required. Install Rust from https://rustup.rs first."

if (-not (Get-Command stellar -ErrorAction SilentlyContinue)) {
    winget install --id Stellar.StellarCLI --source winget --accept-package-agreements --accept-source-agreements --disable-interactivity
}

Require-Command -Name "stellar" -InstallHint "stellar CLI could not be found after installation."

rustup target add wasm32v1-none
if ($cargo) {
    rustup target add wasm32v1-none --toolchain stable-x86_64-pc-windows-gnu
}

try {
    stellar network add local `
        --rpc-url "http://localhost:8000/rpc" `
        --network-passphrase "Standalone Network ; February 2017" | Out-Null
} catch {
}

rustc --version
if ($cargo) {
    & $cargo --version
} else {
    cargo --version
}
stellar --version
