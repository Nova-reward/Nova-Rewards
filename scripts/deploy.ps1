# deploy.ps1 — Deploy all Nova Rewards contracts to testnet or mainnet.
#
# Usage:
#   $env:NETWORK="testnet"; .\scripts\deploy.ps1
#   $env:NETWORK="mainnet"; .\scripts\deploy.ps1
#   .\scripts\deploy.ps1 -DryRun          # print commands, no transactions
#
# Idempotent: contracts already present in the deployments JSON are skipped.
param(
    [switch]$DryRun
)
$ErrorActionPreference = "Stop"

# ── Config ────────────────────────────────────────────────────────────────────

$RepoRoot    = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Network     = if ($env:NETWORK) { $env:NETWORK } else { "testnet" }
$EnvFile     = Join-Path $RepoRoot ".env.$Network"
$ContractsDir= Join-Path $RepoRoot "contracts"
$WasmDir     = Join-Path $ContractsDir "target\wasm32v1-none\release"
$DeployOut   = Join-Path $RepoRoot "deployments\$Network.json"

# Prefer GNU cargo on Windows (wasm32v1-none requires it)
$GnuCargo = Join-Path $env:USERPROFILE ".rustup\toolchains\stable-x86_64-pc-windows-gnu\bin\cargo.exe"
$GnuRustc = Join-Path $env:USERPROFILE ".rustup\toolchains\stable-x86_64-pc-windows-gnu\bin\rustc.exe"
$Cargo    = if (Test-Path $GnuCargo) { $GnuCargo } else { (Get-Command cargo -ErrorAction Stop).Source }
if (Test-Path $GnuRustc) { $env:RUSTC = $GnuRustc }

# ── Load env file ─────────────────────────────────────────────────────────────

if (-not (Test-Path $EnvFile)) {
    throw "ERROR: $EnvFile not found. Copy .env.testnet or .env.mainnet and fill in values."
}

Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $k = $Matches[1].Trim()
        $v = $Matches[2].Trim().Trim('"')
        [System.Environment]::SetEnvironmentVariable($k, $v, "Process")
    }
}

$DeployerSecret  = $env:DEPLOYER_SECRET  ?? $(throw "DEPLOYER_SECRET must be set in $EnvFile")
$AdminAddress    = $env:ADMIN_ADDRESS    ?? $(throw "ADMIN_ADDRESS must be set in $EnvFile")
$RpcUrl          = $env:RPC_URL          ?? $(throw "RPC_URL must be set in $EnvFile")
$NetworkPhrase   = $env:NETWORK_PASSPHRASE ?? $(throw "NETWORK_PASSPHRASE must be set in $EnvFile")
$AdminSigners    = if ($env:ADMIN_SIGNERS) { $env:ADMIN_SIGNERS } else { $AdminAddress }
$AdminThreshold  = if ($env:ADMIN_THRESHOLD) { $env:ADMIN_THRESHOLD } else { "1" }

# ── Helpers ───────────────────────────────────────────────────────────────────

function Log  { param([string]$Msg) Write-Host "[deploy] $Msg" }
function Info { param([string]$Msg) Write-Host "[deploy] v $Msg" -ForegroundColor Green }
function Err  { param([string]$Msg) Write-Host "[deploy] x $Msg" -ForegroundColor Red }

function Require-Command { param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $Name"
    }
}

function Json-Get { param([string]$Key)
    if (Test-Path $DeployOut) {
        $d = Get-Content $DeployOut -Raw | ConvertFrom-Json
        $val = $d.$Key
        if ($val) { return $val }
    }
    return ""
}

function Json-Set { param([string]$Key, [string]$Val)
    $dir = Split-Path $DeployOut
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    if (Test-Path $DeployOut) {
        $d = Get-Content $DeployOut -Raw | ConvertFrom-Json
    } else {
        $d = [PSCustomObject]@{}
    }
    $d | Add-Member -NotePropertyName $Key -NotePropertyValue $Val -Force
    $d | ConvertTo-Json -Depth 5 | Set-Content $DeployOut
}

function Invoke-Stellar { param([string[]]$Args)
    Log "$ stellar $($Args -join ' ')"
    if ($DryRun) { return "DRY_RUN_OUTPUT" }
    $out = & stellar @Args 2>&1
    if ($LASTEXITCODE -ne 0) { throw "stellar failed: $out" }
    return ($out | Select-Object -Last 1).Trim()
}

function Build-Contract { param([string]$Pkg)
    Log "Building $Pkg..."
    if (-not $DryRun) {
        & $Cargo build `
            --manifest-path "$ContractsDir\Cargo.toml" `
            --target wasm32v1-none `
            --release `
            -p $Pkg `
            --quiet
        $wasm = Join-Path $WasmDir "$Pkg.wasm"
        stellar contract optimize --wasm $wasm --quiet 2>$null
    }
}

function Upload-Wasm { param([string]$Pkg)
    $wasm = Join-Path $WasmDir "$Pkg.optimized.wasm"
    if (-not (Test-Path $wasm)) { $wasm = Join-Path $WasmDir "$Pkg.wasm" }
    Log "Uploading $Pkg.wasm..."
    if ($DryRun) { return "DRY_HASH_$Pkg" }
    return (Invoke-Stellar @(
        "contract","upload",
        "--wasm",$wasm,
        "--source",$DeployerSecret,
        "--rpc-url",$RpcUrl,
        "--network-passphrase",$NetworkPhrase
    ))
}

function Deploy-Wasm { param([string]$Pkg, [string]$Hash)
    Log "Deploying $Pkg (hash: $Hash)..."
    if ($DryRun) { return "DRY_ID_$Pkg" }
    return (Invoke-Stellar @(
        "contract","deploy",
        "--wasm-hash",$Hash,
        "--source",$DeployerSecret,
        "--rpc-url",$RpcUrl,
        "--network-passphrase",$NetworkPhrase
    ))
}

function Invoke-Init { param([string]$ContractId, [string[]]$InitArgs)
    Log "Initializing $ContractId..."
    if ($DryRun) { return }
    Invoke-Stellar @(
        "contract","invoke",
        "--id",$ContractId,
        "--source",$DeployerSecret,
        "--rpc-url",$RpcUrl,
        "--network-passphrase",$NetworkPhrase,
        "--","initialize"
    ) + $InitArgs | Out-Null
}

function Verify-Contract { param([string]$ContractId, [string]$Fn, [string[]]$FnArgs)
    Log "Verifying $ContractId ($Fn)..."
    if ($DryRun) { Info "skipped (dry-run)"; return }
    Invoke-Stellar @(
        "contract","invoke",
        "--id",$ContractId,
        "--source",$DeployerSecret,
        "--rpc-url",$RpcUrl,
        "--network-passphrase",$NetworkPhrase,
        "--",$Fn
    ) + $FnArgs | Out-Null
    Info "$ContractId is callable"
}

# Deploy one contract idempotently.
function Deploy-Contract {
    param([string]$JsonKey, [string]$Pkg, [string[]]$InitArgs)

    $existing = Json-Get $JsonKey
    if ($existing) {
        Info "$Pkg already deployed: $existing (skipping)"
        return $existing
    }

    Build-Contract $Pkg
    $hash = Upload-Wasm $Pkg
    $id   = Deploy-Wasm $Pkg $hash
    Invoke-Init $id $InitArgs
    Json-Set $JsonKey $id
    Info "$Pkg deployed: $id"
    return $id
}

# ── Pre-flight ────────────────────────────────────────────────────────────────

Require-Command "stellar"

Log "Network : $Network"
Log "RPC     : $RpcUrl"
Log "Admin   : $AdminAddress"
if ($DryRun) { Log "Mode    : DRY RUN (no transactions will be broadcast)" }

if (-not (Test-Path $DeployOut)) {
    $dir = Split-Path $DeployOut
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    "{}" | Set-Content $DeployOut
}

# ── Deployment order ──────────────────────────────────────────────────────────
# 1. nova_token  (no deps)
# 2. distribution (needs nova_token contract ID)
# 3. reward_pool, vesting, referral, nova_rewards (no inter-deps)
# 4. admin_roles (last — governs all others)

# 1. nova_token
$NovaTokenId = Deploy-Contract "nova_token_contract_id" "nova_token" @(
    "--admin", $AdminAddress
)

# 2. distribution
$DistributionId = Deploy-Contract "distribution_contract_id" "distribution" @(
    "--admin",    $AdminAddress,
    "--token-id", $NovaTokenId
)

# 3a. reward_pool
$RewardPoolId = Deploy-Contract "reward_pool_contract_id" "reward_pool" @(
    "--admin", $AdminAddress
)

# 3b. vesting
$VestingId = Deploy-Contract "vesting_contract_id" "vesting" @(
    "--admin", $AdminAddress
)

# 3c. referral
$ReferralId = Deploy-Contract "referral_contract_id" "referral" @(
    "--admin", $AdminAddress
)

# 3d. nova_rewards
$NovaRewardsId = Deploy-Contract "nova_rewards_contract_id" "nova_rewards" @(
    "--admin", $AdminAddress
)

# 4. admin_roles (last)
$SignersJson = "[" + (($AdminSigners -split '\s+') | ForEach-Object { "`"$_`"" }) -join "," + "]"
$AdminRolesId = Deploy-Contract "admin_roles_contract_id" "admin_roles" @(
    "--admin",     $AdminAddress,
    "--signers",   $SignersJson,
    "--threshold", $AdminThreshold
)

# ── Post-deployment verification ──────────────────────────────────────────────

Log "Running post-deployment verification..."
Verify-Contract $NovaTokenId    "balance"     @("--addr", $AdminAddress)
Verify-Contract $RewardPoolId   "get_balance" @()
Verify-Contract $VestingId      "get_admin"   @()
Verify-Contract $ReferralId     "get_admin"   @()
Verify-Contract $DistributionId "get_admin"   @()
Verify-Contract $NovaRewardsId  "get_admin"   @()
Verify-Contract $AdminRolesId   "get_admin"   @()

# ── Summary ───────────────────────────────────────────────────────────────────

Log ""
Log "Deployment complete. Contract IDs written to: $DeployOut"
Log ""
Get-Content $DeployOut -Raw | ConvertFrom-Json | Format-List
