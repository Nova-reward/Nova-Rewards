/**
 * CustomerDashboardPage.js — Page object for /dashboard route (customer view).
 */

export class CustomerDashboardPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  // ── Wallet Connection ──────────────────────────────────────────────────────

  /**
   * Clicks the "Connect Wallet" button.
   */
  async connectWallet() {
    await this.page.getByRole('button', { name: /Connect Wallet|Connect Freighter/i }).click();
  }

  /**
   * Asserts that wallet is connected by checking for wallet address display.
   */
  async assertWalletConnected(walletAddress) {
    const shortAddr = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
    await this.page.waitForSelector(`text=${shortAddr}`);
  }

  // ── Points Display ────────────────────────────────────────────────────────

  /**
   * Gets current points balance from the page.
   */
  async getPointsBalance() {
    const text = await this.page
      .locator('[data-testid="points-balance"], .points-widget')
      .textContent();
    const match = text.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  }

  /**
   * Waits for points to update to expected amount.
   */
  async waitForPointsUpdate(expectedAmount, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const balance = await this.getPointsBalance();
      if (balance >= expectedAmount) return balance;
      await this.page.waitForTimeout(500);
    }
    throw new Error(
      `[CustomerDashboardPage] Points did not update to ${expectedAmount} within ${timeoutMs}ms`
    );
  }

  // ── Trustline Setup ───────────────────────────────────────────────────────

  /**
   * Clicks the "Setup Trustline" button.
   */
  async clickSetupTrustline() {
    await this.page.getByRole('button', { name: /Setup Trustline|Add Trustline/i }).click();
  }

  /**
   * Waits for trustline setup modal to appear.
   */
  async waitForTrustlineSetupModal() {
    await this.page.waitForSelector('[role="dialog"], .modal');
  }

  /**
   * Clicks the "Confirm" or "Sign" button in the trustline modal.
   */
  async signTrustlineTransaction() {
    await this.page.getByRole('button', { name: /Confirm|Sign/i }).click();
  }

  /**
   * Waits for trustline setup success message.
   */
  async waitForTrustlineSuccess(timeoutMs = 10_000) {
    await this.page.waitForSelector('text=Trustline created successfully', {
      timeout: timeoutMs,
    });
  }

  // ── Transaction History ─────────────────────────────────────────────────────

  /**
   * Gets all transaction rows from history.
   */
  async getTransactionHistoryRows() {
    return this.page.locator('tbody tr, [role="list"] > li').all();
  }

  /**
   * Finds a transaction in history by wallet and amount.
   */
  async findTransactionInHistory(walletAddress, amount) {
    const pattern = new RegExp(`${walletAddress}.*${amount}`);
    return this.page.locator(`text=${pattern}`).first();
  }
}
