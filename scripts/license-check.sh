#!/bin/bash
set -e

# Allowed licenses (semicolon separated for license-checker)
ALLOWED_LICENSES="MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC"
# Allowed licenses (comma separated for the python check)
ALLOWED_LICENSES_RUST="MIT,Apache-2.0,BSD-2-Clause,BSD-3-Clause,ISC"

REPORT_DIR="docs/licenses"
mkdir -p "$REPORT_DIR"

# Function to check npm licenses
check_npm() {
    local dir=$1
    local name=$2
    local abs_report_dir=$(pwd)/$REPORT_DIR
    echo "Checking npm dependencies for $name..."
    cd "$dir"
    # Generate JSON report
    npx license-checker --json --out "$abs_report_dir/$name-licenses.json"
    # Generate human readable report
    echo "License report for $name" > "$abs_report_dir/$name-licenses.txt"
    echo "==========================" >> "$abs_report_dir/$name-licenses.txt"
    npx license-checker --summary >> "$abs_report_dir/$name-licenses.txt"
    # Enforce allowed licenses
    npx license-checker --summary --onlyAllow "$ALLOWED_LICENSES"
    cd - > /dev/null
}

# Check Backend
if [ -d "novaRewards/backend" ]; then
    check_npm "novaRewards/backend" "backend"
fi

# Check Frontend
if [ -d "novaRewards/frontend" ]; then
    check_npm "novaRewards/frontend" "frontend"
fi

# Check Docs Site
if [ -d "docs-site" ]; then
    check_npm "docs-site" "docs-site"
fi

# Check Rust
if [ -d "contracts" ]; then
    abs_report_dir=$(pwd)/$REPORT_DIR
    echo "Checking Rust dependencies..."
    cd contracts
    # cargo-license --json outputs a JSON array
    cargo license --json > "$abs_report_dir/rust-licenses.json"
    # Generate human readable report
    echo "License report for Rust contracts" > "$abs_report_dir/rust-licenses.txt"
    echo "===============================" >> "$abs_report_dir/rust-licenses.txt"
    cargo license >> "$abs_report_dir/rust-licenses.txt"

    # Verify Rust licenses
    python3 -c "
import json, sys
allowed = '$ALLOWED_LICENSES_RUST'.split(',')
with open('$abs_report_dir/rust-licenses.json') as f:
    data = json.load(f)
    disallowed = []
    for dep in data:
        lic = dep.get('license', 'Unknown')
        if lic is None:
            lic = 'Unknown'
        # Basic check for allowed licenses in the license string
        # This handles cases like 'MIT OR Apache-2.0'
        parts = lic.replace('(', '').replace(')', '').replace(' OR ', '|').replace(' AND ', '|').split('|')
        if not any(p.strip() in allowed for p in parts):
            disallowed.append(f\"{dep['name']} ({lic})\")
    if disallowed:
        print('Disallowed Rust licenses found:')
        for d in disallowed:
            print(f'  - {d}')
        sys.exit(1)
"
    cd - > /dev/null
fi

echo "License compliance check passed!"
