const fs = require('fs');
const path = require('path');

console.log('🧪 Testing PWA Implementation...\n');

const tests = [
  {
    name: 'Service Worker',
    path: '../frontend/public/sw.js',
    checks: ['addEventListener', 'caches', 'fetch', 'sync', 'push']
  },
  {
    name: 'Web Manifest',
    path: '../frontend/public/manifest.json',
    checks: ['name', 'icons', 'start_url', 'display']
  },
  {
    name: 'PWA Utilities',
    path: '../frontend/lib/pwa.js',
    checks: ['registerServiceWorker', 'subscribeToPushNotifications', 'syncInBackground']
  },
  {
    name: 'Offline Page',
    path: '../frontend/pages/offline.js',
    checks: ['Offline', 'navigator.onLine']
  },
  {
    name: 'Network Status Component',
    path: '../frontend/components/NetworkStatus.js',
    checks: ['NetworkStatus', 'online', 'offline']
  },
  {
    name: 'PWA Install Prompt',
    path: '../frontend/components/PWAInstallPrompt.js',
    checks: ['beforeinstallprompt', 'Install']
  },
  {
    name: 'usePWA Hook',
    path: '../frontend/hooks/usePWA.js',
    checks: ['usePWA', 'enableNotifications', 'triggerBackgroundSync']
  },
  {
    name: 'Notifications API',
    path: '../backend/routes/notifications.js',
    checks: ['subscribe', 'unsubscribe', 'send']
  },
  {
    name: 'Document Meta Tags',
    path: '../frontend/pages/_document.js',
    checks: ['manifest', 'theme-color', 'apple-mobile-web-app']
  },
  {
    name: 'Offline Storage',
    path: '../frontend/lib/offlineStorage.js',
    checks: ['indexedDB', 'saveToOfflineCache', 'getFromOfflineCache']
  }
];

let passed = 0;
let failed = 0;

tests.forEach(test => {
  const filePath = path.join(__dirname, test.path);
  
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ ${test.name}: File not found`);
      failed++;
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const missingChecks = test.checks.filter(check => !content.includes(check));

    if (missingChecks.length === 0) {
      console.log(`✅ ${test.name}: All checks passed`);
      passed++;
    } else {
      console.log(`⚠️  ${test.name}: Missing - ${missingChecks.join(', ')}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${test.name}: Error - ${error.message}`);
    failed++;
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log('🎉 All PWA files are properly configured!\n');
  console.log('Next steps:');
  console.log('1. Install dependencies: cd backend && npm install');
  console.log('2. Generate VAPID keys: npx web-push generate-vapid-keys');
  console.log('3. Add keys to .env file');
  console.log('4. Create app icons in frontend/public/icons/');
  console.log('5. Build and test: cd frontend && npm run build && npm start\n');
} else {
  console.log('⚠️  Some files need attention. Check the errors above.\n');
  process.exit(1);
}
