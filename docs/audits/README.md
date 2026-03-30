# Security Audit Reports

This directory contains all security audit reports for the Nova Rewards project.

## Audit Registry

### Completed Audits

| Date | Auditor | Scope | Status | Report |
|------|---------|--------|--------|--------|
| *No completed audits yet* | - | - | - | - |

### Scheduled Audits

| Date | Auditor | Scope | Status | Report |
|------|---------|--------|--------|--------|
| *No scheduled audits yet* | - | - | - | - |

## Severity Levels

The following severity levels are used for audit findings:

- 🔴 **Critical** - Vulnerabilities that can lead to loss of funds, contract compromise, or severe protocol damage
- 🟠 **High** - Issues that can significantly impact security or functionality but have mitigations
- 🟡 **Medium** - Problems that could cause minor issues or have low probability of exploitation
- 🟢 **Low** - Minor issues, code quality improvements, or best practice recommendations
- 🔵 **Informational** - General observations and suggestions for improvement

## Report Structure

Each audit report follows the standardized template defined in [TEMPLATE.md](./TEMPLATE.md).

### PDF Reports

Official PDF reports are stored in the `reports/` subdirectory with the naming convention:
```
YYYY-MM-DD--{auditor-name}.pdf
```

Example: `2024-03-15--certik.pdf`

## Audit Process

1. **Scope Definition** - Clear definition of contracts and components to be audited
2. **Audit Execution** - Comprehensive security analysis by independent auditor
3. **Report Generation** - Detailed findings using the standard template
4. **Remediation** - Address identified issues
5. **Verification** - Auditor verification of fixes
6. **Publication** - Final report publication in this directory

## Links

- [Main Project README](../README.md)
- [Security Section in Main README](../README.md#security)
- [Audit Template](./TEMPLATE.md)

---

*Last updated: 2024-03-28*
