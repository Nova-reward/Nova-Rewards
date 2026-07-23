'use client';

import React, { useState, useRef, useEffect, useId, useCallback } from 'react';

/**
 * Tooltip — accessible hover/focus tooltip component.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children      - The trigger element
 * @param {string|React.ReactNode} props.content - Tooltip content
 * @param {'top'|'bottom'|'left'|'right'} [props.position='top'] - Preferred position
 * @param {number} [props.delay=200]             - Show delay in ms
 * @param {string} [props.className]             - Additional classes for tooltip bubble
 * @param {boolean} [props.disabled]             - Disable tooltip
 *
 * @example
 * <Tooltip content="Copy wallet address">
 *   <button onClick={handleCopy}>Copy</button>
 * </Tooltip>
 *
 * @example
 * <Tooltip content="Locked for 30 days" position="right">
 *   <LockClosedIcon className="w-5 h-5 text-neutral-400" />
 * </Tooltip>
 */
export function Tooltip({
  children,
  content,
  position = 'top',
  delay = 200,
  className = '',
  disabled = false,
}) {
  const [visible, setVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const showTimer = useRef(null);
  const hideTimer = useRef(null);
  const wrapperRef = useRef(null);
  const tooltipRef = useRef(null);
  const tooltipId = useId();

  // Check prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  const show = useCallback(() => {
    if (disabled || !content) return;
    clearTimeout(hideTimer.current);
    showTimer.current = setTimeout(() => {
      setVisible(true);
    }, prefersReducedMotion ? 0 : delay);
  }, [disabled, content, delay, prefersReducedMotion]);

  const hide = useCallback(() => {
    clearTimeout(showTimer.current);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
    }, prefersReducedMotion ? 0 : 100);
  }, [prefersReducedMotion]);

  // Keyboard: hide on Escape
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') hide();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, hide]);

  // Reposition if tooltip overflows viewport
  useEffect(() => {
    if (!visible || !tooltipRef.current || !wrapperRef.current) return;

    const tooltip = tooltipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let resolved = position;

    if (position === 'top' && tooltip.top < 0) resolved = 'bottom';
    else if (position === 'bottom' && tooltip.bottom > vh) resolved = 'top';
    else if (position === 'left' && tooltip.left < 0) resolved = 'right';
    else if (position === 'right' && tooltip.right > vw) resolved = 'left';

    if (resolved !== actualPosition) setActualPosition(resolved);
  }, [visible, position, actualPosition]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(showTimer.current);
      clearTimeout(hideTimer.current);
    };
  }, []);

  // Position classes for the tooltip bubble
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  // Arrow classes pointing toward the trigger
  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-neutral-900',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-neutral-900',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-neutral-900',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-neutral-900',
  };

  const resolvedPos = actualPosition;

  return (
    <span
      ref={wrapperRef}
      className="relative inline-flex items-center"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {/* Trigger — clone child to inject aria-describedby */}
      {React.isValidElement(children)
        ? React.cloneElement(children, {
            'aria-describedby': visible ? tooltipId : undefined,
          })
        : children}

      {/* Tooltip bubble */}
      {visible && content && (
        <span
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className={[
            // Base styles
            'absolute z-[600] w-max max-w-[280px]',
            'bg-neutral-900 text-white',
            'text-[13px] leading-snug font-medium',
            'px-2.5 py-1.5 rounded-md',
            'pointer-events-none select-none',
            // Animation (skipped if reduced motion)
            prefersReducedMotion
              ? ''
              : 'animate-[fadeIn_150ms_ease-out]',
            // Position
            positionClasses[resolvedPos],
            className,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {content}

          {/* Arrow */}
          <span
            aria-hidden="true"
            className={[
              'absolute w-0 h-0',
              'border-[6px] border-solid',
              arrowClasses[resolvedPos],
            ].join(' ')}
          />
        </span>
      )}
    </span>
  );
}

export default Tooltip;
