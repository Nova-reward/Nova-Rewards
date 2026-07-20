/**
 * Async Polling Helper
 * 
 * Robust utilities for polling operations in E2E tests
 * Prevents flaky timeouts with exponential backoff and error handling
 */

/**
 * Poll a condition with exponential backoff
 * 
 * @param {Function} condition - Async function that returns true when condition met
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Maximum wait time in ms (default: 30000)
 * @param {number} options.interval - Initial interval in ms (default: 1000)
 * @param {number} options.backoff - Backoff multiplier (default: 1.5)
 * @param {number} options.maxInterval - Maximum interval between attempts (default: 5000)
 * @param {string} options.description - Description for logging
 * @returns {Promise<{success: boolean, attempts: number, error?: Error}>}
 */
async function pollUntil(condition, options = {}) {
  const {
    timeout = 30000,
    interval = 1000,
    backoff = 1.5,
    maxInterval = 5000,
    description = 'condition',
  } = options;
  
  const startTime = Date.now();
  let attempt = 0;
  let currentInterval = interval;
  
  while (Date.now() - startTime < timeout) {
    attempt++;
    
    try {
      const result = await condition();
      
      if (result) {
        console.log(`✅ ${description} met after ${attempt} attempts (${Date.now() - startTime}ms)`);
        return { success: true, attempts: attempt };
      }
      
      console.log(`⏳ Attempt ${attempt}: ${description} not yet met`);
    } catch (error) {
      console.log(`⚠️ Attempt ${attempt} error: ${error.message}`);
    }
    
    // Calculate next interval with exponential backoff
    currentInterval = Math.min(currentInterval * backoff, maxInterval);
    await new Promise(resolve => setTimeout(resolve, currentInterval));
  }
  
  console.error(`❌ ${description} timed out after ${attempt} attempts (${timeout}ms)`);
  return { success: false, attempts: attempt, timedOut: true };
}

/**
 * Poll API endpoint until response meets condition
 * 
 * @param {string} url - URL to poll
 * @param {Function} validateResponse - Function to validate response data
 * @param {Object} options - Polling options
 * @returns {Promise<{success: boolean, data?: any, attempts: number}>}
 */
async function pollApiEndpoint(url, validateResponse, options = {}) {
  const fetchOptions = options.fetchOptions || {};
  
  return pollUntil(async () => {
    try {
      const response = await fetch(url, fetchOptions);
      
      if (!response.ok) {
        console.log(`  HTTP ${response.status} from ${url}`);
        return false;
      }
      
      const data = await response.json();
      return validateResponse(data);
    } catch (error) {
      throw new Error(`Fetch failed: ${error.message}`);
    }
  }, {
    ...options,
    description: `API endpoint ${url}`,
  });
}

/**
 * Poll balance endpoint until reward is reflected
 * 
 * @param {string} baseUrl - API base URL (e.g., http://localhost:3000/api)
 * @param {string} userId - User ID or wallet address
 * @param {number} expectedMinBalance - Minimum expected balance
 * @param {Object} options - Polling options
 * @returns {Promise<{success: boolean, balance?: number, attempts: number}>}
 */
async function pollBalance(baseUrl, userId, expectedMinBalance, options = {}) {
  const url = `${baseUrl}/users/${userId}/balance`;
  let finalBalance;
  
  const result = await pollApiEndpoint(url, (data) => {
    const balance = data.balance || 0;
    finalBalance = balance;
    
    if (balance >= expectedMinBalance) {
      console.log(`  Balance: ${balance} >= ${expectedMinBalance} ✅`);
      return true;
    }
    
    console.log(`  Balance: ${balance}/${expectedMinBalance}`);
    return false;
  }, {
    ...options,
    timeout: options.timeout || 30000,
  });
  
  return {
    ...result,
    balance: finalBalance,
  };
}

/**
 * Poll page element with condition
 * 
 * @param {Page} page - Playwright page object
 * @param {string} selector - CSS selector to poll
 * @param {Function} validate - Validation function
 * @param {Object} options - Polling options
 * @returns {Promise<{success: boolean, element?: Locator, attempts: number}>}
 */
async function pollElement(page, selector, validate, options = {}) {
  let element;
  
  const result = await pollUntil(async () => {
    element = page.locator(selector);
    const count = await element.count();
    
    if (count === 0) {
      console.log(`  Element not found: ${selector}`);
      return false;
    }
    
    if (validate) {
      try {
        const isValid = await validate(element);
        if (isValid) {
          console.log(`  Element valid: ${selector} ✅`);
          return true;
        }
      } catch (error) {
        console.log(`  Validation error: ${error.message}`);
        return false;
      }
    } else {
      console.log(`  Element found: ${selector} ✅`);
      return true;
    }
  }, {
    ...options,
    description: `Element ${selector}`,
  });
  
  return {
    ...result,
    element,
  };
}

/**
 * Wait for page navigation with timeout
 * 
 * @param {Page} page - Playwright page
 * @param {Function} action - Action that triggers navigation
 * @param {Object} options - Navigation options
 * @returns {Promise<{success: boolean, url: string}>}
 */
async function waitForNavigation(page, action, options = {}) {
  const {
    timeout = 10000,
    urlPattern = /.*/,
  } = options;
  
  try {
    await Promise.all([
      page.waitForNavigation({ url: urlPattern, timeout }),
      action(),
    ]);
    
    console.log(`✅ Navigation completed to: ${page.url()}`);
    return { success: true, url: page.url() };
  } catch (error) {
    if (error.name === 'TimeoutError') {
      console.log(`⚠️ Navigation timeout (${timeout}ms)`);
      return { success: false, error: 'Timeout' };
    }
    throw error;
  }
}

/**
 * Retry a function with exponential backoff
 * 
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise<any>}
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    backoff = 2,
  } = options;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(backoff, attempt - 1);
      console.log(`⚠️ Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Check if page has flaky network conditions
 * 
 * @param {Page} page - Playwright page
 * @returns {Promise<boolean>} true if page is experiencing issues
 */
async function isPageFlaky(page) {
  try {
    const metrics = await page.evaluate(() => ({
      memory: performance.memory ? performance.memory.usedJSHeapSize : null,
      responseTime: Date.now(),
    }));
    
    return metrics.memory > 100 * 1024 * 1024; // Over 100MB
  } catch {
    return false;
  }
}

module.exports = {
  pollUntil,
  pollApiEndpoint,
  pollBalance,
  pollElement,
  waitForNavigation,
  retryWithBackoff,
  isPageFlaky,
};
