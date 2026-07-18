'use client';
/**
 * FormField — Issue #323
 *
 * Accessible input wrapper that shows inline validation errors.
 * Renders an <input> (or <textarea> / <select>) with an associated
 * error message region so screen readers announce errors on blur.
 */
import React from 'react';

/**
 * @param {object} props
 * @param {string}  props.id
 * @param {string}  props.label
 * @param {string}  [props.type]        - input type, default "text"
 * @param {string}  props.name
 * @param {unknown} props.value
 * @param {string}  [props.error]       - error message (null/undefined = no error)
 * @param {boolean} [props.touched]     - whether the field has been blurred
 * @param {Function} props.onChange
 * @param {Function} props.onBlur
 * @param {string}  [props.placeholder]
 * @param {boolean} [props.required]
 * @param {boolean} [props.disabled]
 * @param {React.ReactNode} [props.hint] - optional helper text shown below input
 * @param {'input'|'textarea'|'select'} [props.as]
 * @param {React.ReactNode} [props.children] - options for <select>
 */
export default function FormField({
  id,
  label,
  type = 'text',
  name,
  value,
  error,
  touched,
  onChange,
  onBlur,
  placeholder,
  required = false,
  disabled = false,
  hint,
  as: Tag = 'input',
  children,
}) {
  const showError = touched && error;
  const errorId = `${id}-error`;
  const hintId = hint ? `${id}-hint` : undefined;

  const inputProps = {
    id,
    name,
    value,
    onChange,
    onBlur,
    placeholder,
    disabled,
    required,
    'aria-invalid': showError ? 'true' : undefined,
    'aria-describedby': [showError ? errorId : null, hintId]
      .filter(Boolean)
      .join(' ') || undefined,
    className: [
      'block w-full rounded-md border px-3 py-2 type-body-sm',
      'focus:outline-none focus:ring-2',
      showError
        ? 'border-error-500 focus:ring-error-400 dark:border-error-400'
        : 'border-neutral-300 focus:ring-primary-400 dark:border-neutral-600 dark:focus:ring-primary-400',
      disabled ? 'bg-neutral-100 cursor-not-allowed dark:bg-neutral-800' : 'bg-white dark:bg-neutral-900 dark:text-neutral-100',
    ].join(' '),
  };

  return (
    <div className="mb-4">
      <label
        htmlFor={id}
        className="mb-1 block type-label text-neutral-700 dark:text-neutral-300"
      >
        {label}
        {required && (
          <span className="ml-1 text-error-500 dark:text-error-400" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {Tag === 'input' && <input type={type} {...inputProps} />}
      {Tag === 'textarea' && <textarea rows={4} {...inputProps} />}
      {Tag === 'select' && (
        <select {...inputProps}>
          {children}
        </select>
      )}

      {hint && !showError && (
        <p id={hintId} className="mt-1 type-caption text-neutral-500">
          {hint}
        </p>
      )}

      {showError && (
        <p
          id={errorId}
          role="alert"
          className="mt-1 type-caption text-error-600 dark:text-error-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}
