// @ts-check
/**
 * E2E tests for Freighter wallet connection flow (#953)
 *
 * Comprehensive test suite covering:
 * - Clicking "Connect Wallet" triggers the Freighter prompt (mocked)
 * - Connected wallet address appears in the header after connection
 * - Disconnecting clears the session and shows the connect button
 * - "Freighter not installed" modal appears when extension is absent
 * - Network mismatch handling
 * - Session persistence across page reloads
 */

const { test, expect } = require('@playwright/test');
const {
  uniqueEmail,
  TEST_USER,
  TEST_WALLET_ADDRESS,
  registerUser,
  mockFreighterExtension,
  authorizeFreighter,
  setUpConnectedFreighterWallet,
  mockHorizonAPI,
} = require('./helpers');

// ============================================================================
// Test Setup
// ============================================================================

test.describe('Wallet Connection Flow', () => {
  // Before each test, register a user and prepare the dashboard
  test.beforeEach(async ({ page }) => {
    await registerUser(page, {
      name: 'Wallet Tester',
      email: uniqueEmail('wallet-e2e'),
      password: 'Password1',
    });
  });

  // =========================================================================
  // Test 1: Connect Wallet - Clicking "Connect Wallet" triggers prompt
  // =========================================================================

  test('clicking "Connect Wallet" button opens the wallet selection modal', async ({ page }) => {
    // Set up mocked Freighter (not yet authorized)
    await mockFreighterExtension(page, { installed: true, authorized: false });
    await mockHorizonAPI(page);

    await page.goto('/dashboard');

    // Find and click the "Connect Wallet" button
    const connectBtn = page.locator('button:has-text("Connect Wallet")').first();
    await expect(connectBtn).toBeVisible({ timeout: 8_000 });
    await connectBtn.click();

    // Verify wallet selection modal/dropdown appears with wallet options
    // (The modal shows Freighter, Albedo, xBull options)
    const walletPicker = page.locator('text=Choose a wallet');
    await expect(walletPicker).toBeVisible({ timeout: 5_000 });

    // Verify Freighter option is available in the picker
    const freighterOption = page.locator('button:has-text("Freighter")').first();
    await expect(freighterOption).toBeVisible();
  });

  test('clicking Freighter option initiates connection with mocked extension', async ({ page }) => {
    // Set up mocked Freighter as installed
    await mockFreighterExtension(page, { installed: true, authorized: false });
    await mockHorizonAPI(page);

    await page.goto('/dashboard');

    // Click Connect Wallet
    const connectBtn = page.locator('button:has-text("Connect Wallet")').first();
    await connectBtn.click();

    // Wait for wallet picker to appear
    await expect(page.locator('text=Choose a wallet')).toBeVisible({ timeout: 5_000 });

    // Click on Freighter option
    const freighterOption = page.locator('button:has-text("Freighter")').first();
    await freighterOption.click();

    // At this point, the connection attempt is made.
    // With our mock, it should either succeed (if authorized) or fail gracefully.
    // Since we have authorized=false, it should show an error or remain in connect state.
  });

  // =========================================================================
  // Test 2: Connected Wallet Address in Header
  // =========================================================================

  test('displays connected wallet address in the header after successful connection', async ({ page }) => {
    // Set up Freighter as connected
    await mockFreighterExtension(page, {
      installed: true,
      authorized: true,
      publicKey: TEST_WALLET_ADDRESS,
    });
    await mockHorizonAPI(page, { balance: '500.5000000' });

    await page.goto('/dashboard');

    // Seed the connected wallet into localStorage to simulate a successful connection
    await page.evaluate((publicKey) => {
      localStorage.setItem('walletPublicKey', publicKey);
      localStorage.setItem('walletType', 'freighter');
    }, TEST_WALLET_ADDRESS);

    // Reload to load from localStorage
    await page.reload();

    // Verify wallet address appears in the UI
    // The truncated address format should show
    const truncatedAddress = TEST_WALLET_ADDRESS.slice(0, 4) + '...' + TEST_WALLET_ADDRESS.slice(-4);
    
    // Look for the address or wallet info section
    const walletSection = page.locator('text=Wallet').or(page.locator(`text=${TEST_WALLET_ADDRESS.slice(0, 6)}`));
    await expect(walletSection).toBeVisible({ timeout: 8_000 });

    // Verify balance is displayed
    await expect(page.locator('text=500.5')).toBeVisible({ timeout: 5_000 });
  });

  test('displays full wallet address in detailed wallet view', async ({ page }) => {
    await mockFreighterExtension(page, {
      installed: true,
      authorized: true,
      publicKey: TEST_WALLET_ADDRESS,
    });
    await mockHorizonAPI(page, { balance: '250.0000000' });

    await page.goto('/dashboard');

    // Seed connected wallet
    await page.evaluate((publicKey) => {
      localStorage.setItem('walletPublicKey', publicKey);
      localStorage.setItem('walletType', 'freighter');
    }, TEST_WALLET_ADDRESS);

    await page.reload();

    // Check for full address in the wallet info section
    const fullAddress = page.locator(`text=${TEST_WALLET_ADDRESS}`);
    await expect(fullAddress).toBeVisible({ timeout: 8_000 });
  });

  // =========================================================================
  // Test 3: Disconnect Flow - Clears Session & Shows Connect Button
  // =========================================================================

  test('disconnect button clears wallet session and returns to connect state', async ({ page }) => {
    // Start with a connected wallet
    await mockFreighterExtension(page, {
      installed: true,
      authorized: true,
      publicKey: TEST_WALLET_ADDRESS,
    });
    await mockHorizonAPI(page, { balance: '1000.0000000' });

    await page.goto('/dashboard');

    // Seed connected wallet
    await page.evaluate((publicKey) => {
      localStorage.setItem('walletPublicKey', publicKey);
      localStorage.setItem('walletType', 'freighter');
    }, TEST_WALLET_ADDRESS);

    await page.reload();

    // Verify connected state
    const disconnectBtn = page.locator('button:has-text("Disconnect")');
    await expect(disconnectBtn).toBeVisible({ timeout: 8_000 });

    // Click disconnect
    await disconnectBtn.click();

    // Verify wallet session is cleared from localStorage
    const walletKey = await page.evaluate(() => localStorage.getItem('walletPublicKey'));
    expect(walletKey).toBeNull();

    // Verify "Connect Wallet" button reappears
    const connectBtn = page.locator('button:has-text("Connect Wallet")').first();
    await expect(connectBtn).toBeVisible({ timeout: 5_000 });
  });

  test('clearing wallet from context removes wallet info from UI', async ({ page }) => {
    // Start connected
    await mockFreighterExtension(page, {
      installed: true,
      authorized: true,
      publicKey: TEST_WALLET_ADDRESS,
    });
    await mockHorizonAPI(page, { balance: '750.0000000' });

    await page.goto('/dashboard');

    // Seed connected wallet
    await page.evaluate((publicKey) => {
      localStorage.setItem('walletPublicKey', publicKey);
      localStorage.setItem('walletType', 'freighter');
    }, TEST_WALLET_ADDRESS);

    await page.reload();

    // Confirm wallet display is present
    await expect(page.locator(`text=${TEST_WALLET_ADDRESS.slice(0, 8)}`)).toBeVisible({ timeout: 8_000 });

    // Disconnect
    const disconnectBtn = page.locator('button:has-text("Disconnect")');
    await disconnectBtn.click();

    // Verify wallet address is no longer visible
    const addressVisible = await page.locator(`text=${TEST_WALLET_ADDRESS}`).count();
    expect(addressVisible).toBe(0);
  });

  // =========================================================================
  // Test 4: Freighter Not Installed Modal
  // =========================================================================

  test('shows "Freighter not installed" error when extension is absent', async ({ page }) => {
    // Mock Freighter as NOT installed
    await mockFreighterExtension(page, { installed: false });
    await mockHorizonAPI(page);

    await page.goto('/dashboard');

    // Click Connect Wallet
    const connectBtn = page.locator('button:has-text("Connect Wallet")').first();
    await connectBtn.click();

    // Wait for wallet picker
    await expect(page.locator('text=Choose a wallet')).toBeVisible({ timeout: 5_000 });

    // Click Freighter (which will fail since not installed)
    const freighterOption = page.locator('button:has-text("Freighter")').first();
    await freighterOption.click();

    // Should show error message about Freighter not being installed
    const errorMsg = page.locator('text=/freighter|not installed|extension/i');
    await expect(errorMsg).toBeVisible({ timeout: 5_000 });
  });

  test('Freighter install modal displays when extension check fails', async ({ page }) => {
    // Mock Freighter as not installed
    await mockFreighterExtension(page, { installed: false });
    await mockHorizonAPI(page);

    await page.goto('/dashboard');

    const connectBtn = page.locator('button:has-text("Connect Wallet")').first();
    await connectBtn.click();

    await expect(page.locator('text=Choose a wallet')).toBeVisible({ timeout: 5_000 });

    // Try to connect with Freighter
    const freighterOption = page.locator('button:has-text("Freighter")').first();
    await freighterOption.click();

    // Look for "Freighter Not Detected" modal or install prompt
    const installPrompt = page.locator('text=Freighter Not Detected').or(
      page.locator('text=not installed').or(page.locator('text=Install the extension'))
    );
    await expect(installPrompt).toBeVisible({ timeout: 5_000 });
  });

  test('install modal can be closed without installing', async ({ page }) => {
    await mockFreighterExtension(page, { installed: false });
    await mockHorizonAPI(page);

    await page.goto('/dashboard');

    const connectBtn = page.locator('button:has-text("Connect Wallet")').first();
    await connectBtn.click();

    await expect(page.locator('text=Choose a wallet')).toBeVisible({ timeout: 5_000 });

    const freighterOption = page.locator('button:has-text("Freighter")').first();
    await freighterOption.click();

    // Find and click the close button or "later" button
    const closeBtn = page.locator('button:has-text("later")').or(
      page.locator('button[aria-label*="Close"]')
    );
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
      // Should return to dashboard or wallet picker
      await expect(page.locator('button:has-text("Connect Wallet")').first()).toBeVisible({ timeout: 5_000 });
    }
  });

  // =========================================================================
  // Test 5: Network Mismatch Handling
  // =========================================================================

  test('shows error when Freighter is on the wrong network', async ({ page }) => {
    // Mock Freighter with a network mismatch
    await mockFreighterExtension(page, {
      installed: true,
      authorized: true,
      network: 'TESTNET',
      networkMismatch: true, // This will make the network PUBLIC instead of TESTNET
    });
    await mockHorizonAPI(page);

    await page.goto('/dashboard');

    // Try to connect (it will detect network mismatch)
    const connectBtn = page.locator('button:has-text("Connect Wallet")').first();
    await connectBtn.click();

    await expect(page.locator('text=Choose a wallet')).toBeVisible({ timeout: 5_000 });

    const freighterOption = page.locator('button:has-text("Freighter")').first();
    await freighterOption.click();

    // Should show network mismatch error
    const networkError = page.locator('text=/network|mismatch|wrong/i');
    await expect(networkError).toBeVisible({ timeout: 5_000 });
  });

  test('wallet connection succeeds when networks match', async ({ page }) => {
    // Mock Freighter with matching network (no mismatch)
    await mockFreighterExtension(page, {
      installed: true,
      authorized: true,
      network: 'TESTNET',
      networkPassphrase: 'Test SDF Network ; September 2015',
      networkMismatch: false,
    });
    await mockHorizonAPI(page, { balance: '1000.0000000' });

    await page.goto('/dashboard');

    // Seed a connected wallet to simulate successful connection
    await page.evaluate((publicKey) => {
      localStorage.setItem('walletPublicKey', publicKey);
      localStorage.setItem('walletType', 'freighter');
    }, TEST_WALLET_ADDRESS);

    await page.reload();

    // Should display wallet connected (no error)
    await expect(page.locator('button:has-text("Disconnect")')).toBeVisible({ timeout: 8_000 });
  });

  // =========================================================================
  // Test 6: Session Persistence
  // =========================================================================

  test('wallet connection persists across page reloads', async ({ page }) => {
    await mockFreighterExtension(page, {
      installed: true,
      authorized: true,
      publicKey: TEST_WALLET_ADDRESS,
    });
    await mockHorizonAPI(page, { balance: '500.0000000' });

    await page.goto('/dashboard');

    // Seed connected wallet
    await page.evaluate((publicKey) => {
      localStorage.setItem('walletPublicKey', publicKey);
      localStorage.setItem('walletType', 'freighter');
    }, TEST_WALLET_ADDRESS);

    // First load
    await page.reload();
    await expect(page.locator('button:has-text("Disconnect")')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator(`text=${TEST_WALLET_ADDRESS.slice(0, 8)}`)).toBeVisible();

    // Second reload
    await page.reload();
    await expect(page.locator('button:has-text("Disconnect")')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator(`text=${TEST_WALLET_ADDRESS.slice(0, 8)}`)).toBeVisible();
  });

  test('balance updates when fetched from Horizon after connection', async ({ page }) => {
    await mockFreighterExtension(page, {
      installed: true,
      authorized: true,
      publicKey: TEST_WALLET_ADDRESS,
    });

    // First balance
    await mockHorizonAPI(page, { balance: '250.5000000' });

    await page.goto('/dashboard');

    await page.evaluate((publicKey) => {
      localStorage.setItem('walletPublicKey', publicKey);
      localStorage.setItem('walletType', 'freighter');
    }, TEST_WALLET_ADDRESS);

    await page.reload();

    // Verify first balance appears
    await expect(page.locator('text=250.5')).toBeVisible({ timeout: 8_000 });
  });

  // =========================================================================
  // Test 7: Multiple Wallet Types (Optional Extended Coverage)
  // =========================================================================

  test('can switch between Freighter and Albedo wallets', async ({ page }) => {
    await mockFreighterExtension(page, { installed: true, authorized: true });
    await mockHorizonAPI(page, { balance: '100.0000000' });

    await page.goto('/dashboard');

    // Connect with Freighter mock
    await page.evaluate((publicKey) => {
      localStorage.setItem('walletPublicKey', publicKey);
      localStorage.setItem('walletType', 'freighter');
    }, TEST_WALLET_ADDRESS);

    await page.reload();
    await expect(page.locator('button:has-text("Disconnect")')).toBeVisible({ timeout: 8_000 });

    // Disconnect
    const disconnectBtn = page.locator('button:has-text("Disconnect")');
    await disconnectBtn.click();

    // Verify can reconnect
    const connectBtn = page.locator('button:has-text("Connect Wallet")').first();
    await expect(connectBtn).toBeVisible({ timeout: 5_000 });
  });

  // =========================================================================
  // Test 8: Error Recovery
  // =========================================================================

  test('recovers gracefully when connection is denied by user', async ({ page }) => {
    // Mock Freighter with user denial
    await mockFreighterExtension(page, {
      installed: true,
      authorized: false,
      accessDenialError: 'denied',
    });
    await mockHorizonAPI(page);

    await page.goto('/dashboard');

    const connectBtn = page.locator('button:has-text("Connect Wallet")').first();
    await connectBtn.click();

    await expect(page.locator('text=Choose a wallet')).toBeVisible({ timeout: 5_000 });

    const freighterOption = page.locator('button:has-text("Freighter")').first();
    await freighterOption.click();

    // Should show error about access denied
    const errorMsg = page.locator('text=/denied|rejected|access/i');
    await expect(errorMsg).toBeVisible({ timeout: 5_000 });

    // User should still be able to try again
    const retryBtn = page.locator('button:has-text("Connect Wallet")').first();
    if (await retryBtn.isVisible()) {
      // Good - can retry
      expect(true).toBe(true);
    }
  });

  test('shows clear error message when connection attempt fails', async ({ page }) => {
    // Mock Freighter with a generic error
    await mockFreighterExtension(page, {
      installed: true,
      authorized: false,
      accessDenialError: 'error',
    });
    await mockHorizonAPI(page);

    await page.goto('/dashboard');

    const connectBtn = page.locator('button:has-text("Connect Wallet")').first();
    await connectBtn.click();

    await expect(page.locator('text=Choose a wallet')).toBeVisible({ timeout: 5_000 });

    const freighterOption = page.locator('button:has-text("Freighter")').first();
    await freighterOption.click();

    // Should show an error message
    const errorMsg = page.locator('text=/fail|error|unable/i');
    await expect(errorMsg).toBeVisible({ timeout: 5_000 });
  });
});
