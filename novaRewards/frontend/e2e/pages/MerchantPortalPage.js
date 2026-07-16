/**
 * MerchantPortalPage.js — Page object for /merchant route.
 *
 * Encapsulates all merchant portal UI interactions:
 * - Registration form
 * - Campaign creation form
 * - Reward issuance form
 * - Dashboard stats
 */

export class MerchantPortalPage {
  constructor(page) {
    this.page = page;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  async goto() {
    await this.page.goto('/merchant');
    await this.page.waitForLoadState('networkidle');
  }

  async assertPageLoaded() {
    await this.page.waitForSelector('h1:has-text("Merchant Portal")');
  }

  // ── Merchant Registration Form ─────────────────────────────────────────────

  /**
   * Fills merchant registration form fields.
   */
  async fillMerchantRegistration({ name, walletAddress, businessCategory }) {
    await this.page.getByLabel('Business Name').fill(name);
    await this.page.getByLabel('Stellar Wallet Address').fill(walletAddress);
    if (businessCategory) {
      await this.page.getByLabel('Business Category (optional)').fill(businessCategory);
    }
  }

  /**
   * Submits merchant registration form.
   */
  async submitMerchantRegistration() {
    await this.page.getByRole('button', { name: /Register/i }).click();
  }

  /**
   * Waits for API key to display on screen after registration.
   *
   * @param {number} timeoutMs
   * @returns {Promise<string>} The displayed API key
   */
  async waitForApiKeyDisplay(timeoutMs = 10_000) {
    const locator = this.page.locator('span', { hasText: /[0-9a-f]{32}/i });
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });
    return locator.textContent();
  }

  /**
   * Gets the displayed merchant name.
   */
  async getDisplayedMerchantName() {
    return this.page.locator('.merchant-name, [data-testid="merchant-name"]').textContent();
  }

  /**
   * Checks if merchant registration form is visible.
   */
  async isMerchantRegistrationFormVisible() {
    return this.page.locator('h2:has-text("Register as a Merchant")').isVisible();
  }

  // ── Campaign Form ──────────────────────────────────────────────────────────

  /**
   * Fills campaign creation form fields.
   */
  async fillCampaignForm({ name, rewardRate, startDate, endDate }) {
    await this.page.getByLabel('Campaign Name').fill(name);
    await this.page.getByLabel(/Reward Rate/i).fill(rewardRate);

    const dateInputs = this.page.locator('input[type="date"]');
    await dateInputs.nth(0).fill(startDate);
    await dateInputs.nth(1).fill(endDate);
  }

  /**
   * Submits campaign creation form.
   */
  async submitCampaignCreation() {
    await this.page.getByRole('button', { name: /Create Campaign/i }).click();
  }

  /**
   * Waits for campaign creation success message.
   */
  async waitForCampaignSuccessMessage(timeoutMs = 10_000) {
    await this.page.waitForSelector('text=Campaign created successfully', {
      timeout: timeoutMs,
    });
  }

  /**
   * Gets all campaign rows from the table.
   */
  async getCampaignTableRows() {
    return this.page.locator('tbody tr, [role="list"] > li').all();
  }

  /**
   * Finds a campaign in the table by name.
   */
  async findCampaignInTable(campaignName) {
    return this.page.locator(`text=${campaignName}`).first();
  }

  /**
   * Checks if a campaign is visible in the table.
   */
  async isCampaignVisible(campaignName) {
    const element = await this.findCampaignInTable(campaignName);
    return element.isVisible();
  }

  // ── Issue Reward Form ──────────────────────────────────────────────────────

  /**
   * Selects a campaign from the dropdown by name.
   */
  async selectCampaignFromDropdown(campaignName) {
    await this.page.getByLabel('Campaign').selectOption({ label: new RegExp(campaignName) });
  }

  /**
   * Fills reward issuance form fields.
   */
  async fillRewardIssueForm({ campaignName, walletAddress, amount }) {
    await this.selectCampaignFromDropdown(campaignName);
    await this.page.getByLabel('Customer Wallet Address').fill(walletAddress);
    await this.page.getByLabel('Amount (NOVA)').fill(amount);
  }

  /**
   * Submits reward issuance form.
   */
  async submitRewardIssue() {
    await this.page.getByRole('button', { name: /Issue Rewards/i }).click();
  }

  /**
   * Waits for reward issuance success message.
   */
  async waitForRewardSuccessMessage(timeoutMs = 15_000) {
    await this.page.waitForSelector('text=Rewards issued successfully', {
      timeout: timeoutMs,
    });
  }

  /**
   * Gets the transaction hash link from the success message.
   */
  async getTransactionHashLink() {
    return this.page.locator('a[href*="stellar.expert"]').first();
  }

  // ── Dashboard Stats ───────────────────────────────────────────────────────

  /**
   * Gets total NOVA distributed (from dashboard stats).
   */
  async getTotalDistributed() {
    const text = await this.page
      .locator('text=Total Distributed')
      .locator('..')
      .textContent();
    const match = text.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  }

  /**
   * Gets total NOVA redeemed (from dashboard stats).
   */
  async getTotalRedeemed() {
    const text = await this.page.locator('text=Total Redeemed').locator('..').textContent();
    const match = text.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  }

  // ── Error Handling ────────────────────────────────────────────────────────

  /**
   * Gets error message from the page (if visible).
   */
  async getErrorMessage() {
    const error = this.page.locator('.error, [role="alert"]').first();
    return (await error.isVisible()) ? error.textContent() : null;
  }

  /**
   * Asserts that error message matches expected pattern.
   */
  async assertErrorContains(pattern) {
    const message = await this.getErrorMessage();
    if (!message || !pattern.test(message)) {
      throw new Error(`[MerchantPortalPage] Expected error matching ${pattern}, got: ${message}`);
    }
  }
}
