const assert = require('node:assert');
const pkg = require('../package.json');

assert(pkg.scripts && pkg.scripts.build, 'Frontend package.json must include a build script');
assert(pkg.dependencies && pkg.dependencies.next, 'Next.js dependency must be present');
assert(pkg.dependencies && pkg.dependencies.react, 'React dependency must be present');

console.log('Frontend smoke test passed');
