$ErrorActionPreference = "Stop"

$gnuRustc = Join-Path $env:USERPROFILE ".rustup\toolchains\stable-x86_64-pc-windows-gnu\bin\rustc.exe"
$gnuCargo = Join-Path $env:USERPROFILE ".rustup\toolchains\stable-x86_64-pc-windows-gnu\bin\cargo.exe"
$useGnuCargo = Test-Path $gnuCargo
$cargo = if ($useGnuCargo) { $gnuCargo } else { (Get-Command cargo -ErrorAction Stop).Source }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot
$env:PATH = (($env:PATH -split ";") | Where-Object { $_ -and $_ -notmatch "\\Git\\usr\\bin$" } | Select-Object -Unique) -join ";"
if (Test-Path $gnuRustc) {
    $env:RUSTC = $gnuRustc
}

if ($useGnuCargo) {
    & $cargo check --manifest-path contracts/Cargo.toml --workspace
    & $cargo build --manifest-path contracts/Cargo.toml --workspace --target wasm32v1-none --release
    & $cargo test --manifest-path contracts/Cargo.toml -p reward_pool --lib
    Write-Host "Windows GNU toolchain detected: completed workspace check, Wasm build, and local reward_pool tests. Full workspace contract tests continue in CI."
} else {
    & $cargo test --manifest-path contracts/Cargo.toml --workspace
}
