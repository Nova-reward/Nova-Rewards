$ErrorActionPreference = "Stop"

$gnuRustc = Join-Path $env:USERPROFILE ".rustup\toolchains\stable-x86_64-pc-windows-gnu\bin\rustc.exe"
$gnuCargo = Join-Path $env:USERPROFILE ".rustup\toolchains\stable-x86_64-pc-windows-gnu\bin\cargo.exe"
$cargo = if (Test-Path $gnuCargo) { $gnuCargo } else { (Get-Command cargo -ErrorAction Stop).Source }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot
$env:PATH = (($env:PATH -split ";") | Where-Object { $_ -and $_ -notmatch "\\Git\\usr\\bin$" } | Select-Object -Unique) -join ";"
if (Test-Path $gnuRustc) {
    $env:RUSTC = $gnuRustc
}

& $cargo build --manifest-path contracts/Cargo.toml --workspace --target wasm32v1-none --release

Write-Host "Built contracts into contracts/target/wasm32v1-none/release"
