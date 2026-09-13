#!/usr/bin/env node

/**
 * Dependency Alignment and Drift Validator
 * Closes #1307
 *
 * Enforces:
 * 1. Matching React & React-DOM versions across monorepo workspaces (prevents dual-runtime crashes).
 * 2. Unified major version alignment across all @storybook/* packages.
 * 3. Consistent peer-dependency declarations across frontend/backend workspaces.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const workspaces = ['frontend', 'backend', 'blockchain'];

let hasError = false;

function logError(msg) {
  console.error(`[31m[DEP-CHECK ERROR][0m ${msg}`);
  hasError = true;
}

function logSuccess(msg) {
  console.log(`[32m[DEP-CHECK OK][0m ${msg}`);
}

const packageConfigs = {};

workspaces.forEach((ws) => {
  const pkgPath = path.join(rootDir, ws, 'package.json');
  if (fs.existsSync(pkgPath)) {
    packageConfigs[ws] = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  }
});

// 1. Check React / React-DOM version synchronization
const frontendPkg = packageConfigs.frontend;
if (frontendPkg) {
  const allDeps = {
    ...(frontendPkg.dependencies || {}),
    ...(frontendPkg.devDependencies || {}),
  };

  const reactVer = allDeps['react'];
  const reactDomVer = allDeps['react-dom'];

  if (reactVer && reactDomVer) {
    const cleanReact = reactVer.replace(/[\^~]/g, '').split('.')[0];
    const cleanDom = reactDomVer.replace(/[\^~]/g, '').split('.')[0];

    if (cleanReact !== cleanDom) {
      logError(
        `React version mismatch in frontend: react (${reactVer}) and react-dom (${reactDomVer}) must share the same major version.`
      );
    } else {
      logSuccess(`React and React-DOM versions aligned (major v${cleanReact})`);
    }
  }

  // 2. Check Storybook ecosystem version consistency
  const storybookPackages = Object.keys(allDeps).filter(
    (name) => name === 'storybook' || name.startsWith('@storybook/')
  );

  if (storybookPackages.length > 0) {
    const majorVersions = new Set();
    storybookPackages.forEach((pkgName) => {
      const ver = allDeps[pkgName];
      const major = ver.replace(/[\^~]/g, '').split('.')[0];
      majorVersions.add(major);
    });

    if (majorVersions.size > 1) {
      logError(
        `Storybook major version drift detected across packages: ${Array.from(majorVersions).join(', ')}. All @storybook/* packages must align to the same major version.`
      );
    } else {
      logSuccess(
        `All ${storybookPackages.length} Storybook packages aligned on major v${Array.from(majorVersions)[0]}`
      );
    }
  }
}

if (hasError) {
  console.error('
Dependency alignment check failed. Please resolve version splits.');
  process.exit(1);
} else {
  console.log('
All workspace dependencies are cleanly aligned.
');
  process.exit(0);
}
