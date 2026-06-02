# License Compliance Reports

This directory contains automated license compliance reports for the NovaRewards project.

## Compliance Policy

Allowed licenses:
- MIT
- Apache-2.0
- BSD-2-Clause
- BSD-3-Clause
- ISC

## Automated Scanning

Licenses are scanned on every PR and push to `main` or `develop` branches using:
- `license-checker` for npm dependencies
- `cargo-license` for Rust dependencies

PRs that introduce dependencies with disallowed licenses will be automatically blocked by CI.
