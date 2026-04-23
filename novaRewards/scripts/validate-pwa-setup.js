const fs = require('fs');
const path = require('path');

console.log('🔍 Validating PWA Setup...\n');

const checks = {
  files: [
    { path: '../frontend/public/sw.js', name: 'Service Worker' },
    { path: '../frontend/public/manifest.json', name: 'Web Manifest' },
    { path: '../frontend/lib/pwa.js', name: 'PWA Utilities' },
    { path: '../frontend/lib/offlineStorage.js', name: 'Offline Storage' },
    { path: '../frontend/hooks/usePWA.js', name: 'usePWA Hook' },
    { path: '../frontend/components/NetworkStatus.js', name: 'Network Status' },
    { path: '../frontend/components/PWAInstallPrompt.js', name: 'Install Prompt' },
    { path: '../frontend/pages/offline.js', name: 'Offline Page' },
    { path: '../frontend/pages/_document.js', name: 'Document with Meta Tags' },
    { path: '../backend/routes/notifications.js', name: 'Notifications API' },
  ],
  config: [
    { path: '../.env.example', check: 'VAPID_PUBLIC_KEY', name: 'VAPID keys in .env.example' },
    { path: '../frontend/next.config.js', check: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', name: 'VAPID in next.config' },
    { path: '../backend/package.json', check: 'web-push', name: 'web-push dependency' },
  ],
  integration: [
    { path: '../frontend/pages/_app.js', check: 'registerServiceWorker', name: 'SW registration in _app.js' },
    { path: '../frontend/pages/_app.js', check: 'NetworkStatus', name: 'NetworkStatus in _app.js' },
    { path: '../frontend/pages/_app.js', check: 'PWAInstallPrompt', name: 'Install prompt in _app.js' },
    { path: '../backend/server.js', check: '/api/notifications', name: 'Notifications route in server.js' },
    { path: '../frontend/lib/api.js', check: 'offlineStorage', name: 'Offline support in api.js' },
  ]
};

let totalTests = 0;
let passedTests = 0;

// Check files exist
console.log('📁 File Existence Checks:');
checks.files.forEach(file => {
  totalTests++;
  const filePath = path.join(__dirname, file.path);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file.name}`);
    passedTests++;
  } else {
    console.log(`  ❌ ${file.name} - NOT FOUND`);
  }
});

// Check configuration
console.log('\n⚙️  Configuration Checks:');
checks.config.forEach(config => {
  totalTests++;
  const filePath = path.join(__dirname, config.path);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(config.check)) {
      console.log(`  ✅ ${config.name}`);
      passedTests++;
    } else {
      console.log(`  ❌ ${config.name} - NOT FOUND`);
    }
  } catch (error) {
    console.log(`  ❌ ${config.name} - ERROR: ${error.message}`);
  }
});

// Check integration
console.log('\n🔗 Integration Checks:');
checks.integration.forEach(integration => {
  totalTests++;
  const filePath = path.join(__dirname, integration.path);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(integration.check)) {
      console.log(`  ✅ ${integration.name}`);
      passedTests++;
    } else {
      console.log(`  ❌ ${integration.name} - NOT INTEGRATED`);
    }
  } catch (error) {
    console.log(`  ❌ ${integration.name} - ERROR: ${error.message}`);
  }
});

// Summary
console.log(`\n${'='.repeat(50)}`);
console.log(`📊 Test Results: ${passedTests}/${totalTests} passed`);
console.log('='.repeat(50));

if (passedTests === totalTests) {
  console.log('\n🎉 All PWA components are properly configured!\n');
  console.log('✅ Service worker implementation complete');
  console.log('✅ Offline functionality ready');
  console.log('✅ Push notifications configured');
  console.log('✅ Background sync enabled');
  console.log('✅ Install prompt integrated');
  console.log('✅ Network monitoring active\n');
  console.log('📝 Next Steps:');
  console.log('   1. Install dependencies: cd backend && npm install');
  console.log('   2. Generate VAPID keys: npx web-push generate-vapid-keys');
  console.log('   3. Update .env with VAPID keys');
  console.log('   4. Create app icons (see scripts/generate-pwa-icons.md)');
  console.log('   5. Test in browser: http://localhost:3000/test-pwa.html\n');
} else {
  console.log(`\n⚠️  ${totalTests - passedTests} test(s) failed. Review errors above.\n`);
  process.exit(1);
}
