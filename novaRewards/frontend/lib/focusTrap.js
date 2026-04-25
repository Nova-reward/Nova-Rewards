/**
 * Returns all focusable elements inside a container.
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
export function getFocusable(container) {
  return Array.from(
    container.querySelectorAll(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )
  );
}

/**
 * Traps Tab / Shift+Tab focus within `container`.
 * @param {HTMLElement} container
 * @param {KeyboardEvent} e
 */
export function trapFocus(container, e) {
  if (e.key !== 'Tab') return;
  const focusable = getFocusable(container);
  if (!focusable.length) { e.preventDefault(); return; }
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus(); }
  } else {
    if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
  }
}
