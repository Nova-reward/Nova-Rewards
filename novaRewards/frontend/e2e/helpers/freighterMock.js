/**
 * freighterMock.js — Freighter wallet browser mock for Playwright E2E tests.
 *
 * ── Problem ──────────────────────────────────────────────────────────────────
 * Freighter is a browser extension.  Extensions cannot be installed in
 * Playwright's headless Chromium and are not available during CI runs.
 * Any code that imports from `@stellar/freighter-api` will therefore fail or
 * time-out waiting for the extension to respond.
 *
 * ── Solution ─────────────────────────────────────────────────────────────────
 * Playwright's `page.addInitScript(script)` injects a script that runs before
 * any page JavaScript.  We use it to replace the Freighter API with a
 * deterministic stub whose behaviour can be controlled per-test.
 *
 * The stub is injected into `window.__FREIGHTER_API_OVERRIDE__`.  The frontend
 * code in `lib/freighter.js` checks for this override at import time (after
 * this file patches the global) so all calls go to the stub automatically.
 *
 * ── How to use ───────────────────────────────────────────────────────────────
 *
 *   // At the top of a spec or in a fixture:
 *   const { buildFreighterMockScript } = require('./helpers/freighterMock');
 *
 *   test('does something wallet-related', async ({ page }) => {
 *     // Inject the mock before the page loads any scripts
 *     await page.addInitScript(buildFreighterMockScript({
 *       publicKey: 'GABC...XYZ',   // The wallet address that "isConnected"
 *       autoApprove: true,          // Silently sign every transaction (default)
 *     }));
 *
 *     await page.goto('/');
 *     // Freighter calls now return the stubbed values immediately.
 *   });
 *
 * ── Stub contract ────────────────────────────────────────────────────────────
 * The stub mirrors the @stellar/freighter-api v2 surface used by this project:
 *
 *   isConnected()        → Promise<{ isConnected: true }>
 *   requestAccess()      → Promise<{}>  (no error field)
 *   getPublicKey()       → Promise<{ publicKey: string }>
 *   signTransaction(xdr) → Promise<{ signedTxXdr: string }>
 *                          (returns the original XDR unmodified — Playwright
 *                          network mocks intercept the Horizon submit call)
 *
 * If `autoApprove` is false the stub will reject `signTransaction` with a
 * user-cancelled error, which lets tests verify rejection-path behaviour.
 */

// ---------------------------------------------------------------------------
// Export: buildFreighterMockScript
// ---------------------------------------------------------------------------

/**
 * Builds the `addInitScript` payload that installs the Freighter stub.
 *
 * The returned value is a plain function (serialised to string by Playwright
 * and eval'd in the browser).  It receives `{ publicKey, autoApprove }` via
 * the `arg` parameter of `page.addInitScript(fn, arg)`.
 *
 * @param {object} opts
 * @param {string}  opts.publicKey    Stellar public key the mock wallet will expose
 * @param {boolean} [opts.autoApprove=true]
 *                   When true every `signTransaction` call is auto-approved.
 *                   Set to false to simulate the user rejecting the signing request.
 * @returns {{ script: Function, arg: object }}
 *   Pass these to `page.addInitScript(result.script, result.arg)`.
 */
function buildFreighterMockScript({ publicKey, autoApprove = true }) {
  if (!publicKey || typeof publicKey !== 'string') {
    throw new Error('[freighterMock] publicKey is required');
  }

  /**
   * This function is serialised and executed inside the browser context.
   * It MUST be self-contained — no closures over outer Node.js variables.
   * All configuration arrives through the `cfg` parameter.
   *
   * @param {{ publicKey: string, autoApprove: boolean }} cfg
   */
  function browserScript(cfg) {
    // ── Install the stub on the global object ──────────────────────────────
    // lib/freighter.js imports { isConnected, requestAccess, getPublicKey,
    // signTransaction } from '@stellar/freighter-api'.  Next.js/webpack
    // resolves this at bundle time so we cannot swap the module at runtime.
    //
    // Instead we patch window.freighterApi (the object the extension exposes)
    // AND set a custom global that the frontend code checks as an escape hatch.
    // Both approaches are implemented so the mock works regardless of which
    // integration path is active.

    const stub = {
      /** @returns {Promise<{ isConnected: boolean }>} */
      isConnected: () => Promise.resolve({ isConnected: true }),

      /** @returns {Promise<object>} — no error field means success */
      requestAccess: () => Promise.resolve({}),

      /** @returns {Promise<{ publicKey: string }>} */
      getPublicKey: () => Promise.resolve({ publicKey: cfg.publicKey }),

      /**
       * Signs the transaction.  In autoApprove mode we return the XDR
       * unchanged — the Horizon submission is intercepted by Playwright's
       * page.route() mock so the XDR content does not actually matter.
       *
       * @param {string} xdr
       * @returns {Promise<{ signedTxXdr: string }|{ error: string }>}
       */
      signTransaction: (xdr) => {
        if (!cfg.autoApprove) {
          return Promise.resolve({ error: 'User declined to sign transaction' });
        }
        return Promise.resolve({ signedTxXdr: xdr });
      },
    };

    // 1. Patch the extension's global (used when the extension is installed)
    window.freighterApi = stub;

    // 2. Expose the override that lib/freighter.js checks (escape hatch)
    window.__FREIGHTER_API_OVERRIDE__ = stub;

    // 3. Patch the module namespace that webpack/Next.js typically exposes on
    //    window for stellar-sdk bundles (belt-and-suspenders).
    try {
      // Some bundler configurations expose named exports on the window
      if (!window.__stellarFreighterApi) {
        Object.defineProperty(window, '__stellarFreighterApi', {
          value: stub,
          writable: true,
          configurable: true,
        });
      }
    } catch {
      // Ignore — not all bundler configs expose this
    }

    // 4. Notify developer tooling that the mock is active
    console.debug('[FreighterMock] installed', {
      publicKey: cfg.publicKey,
      autoApprove: cfg.autoApprove,
    });
  }

  return {
    script: browserScript,
    arg: { publicKey, autoApprove },
  };
}

/**
 * Convenience wrapper: patches the Freighter API calls that lib/freighter.js
 * makes by intercepting them at the network / route level is not possible
 * (they're in-process), so we patch the `@stellar/freighter-api` module
 * through the browser's module system by overriding the global stubs.
 *
 * This can be used as a Playwright `page.addInitScript` source directly:
 *
 *   await page.addInitScript(FREIGHTER_MOCK_INLINE, { publicKey: 'G...' });
 *
 * @type {Function}
 */
const FREIGHTER_MOCK_INLINE = function ({ publicKey, autoApprove }) {
  /* global window */
  const stub = {
    isConnected: () => Promise.resolve({ isConnected: true }),
    requestAccess: () => Promise.resolve({}),
    getPublicKey: () => Promise.resolve({ publicKey }),
    signTransaction: (xdr) =>
      autoApprove
        ? Promise.resolve({ signedTxXdr: xdr })
        : Promise.resolve({ error: 'User declined to sign transaction' }),
  };

  window.freighterApi = stub;
  window.__FREIGHTER_API_OVERRIDE__ = stub;
};

module.exports = { buildFreighterMockScript, FREIGHTER_MOCK_INLINE };
