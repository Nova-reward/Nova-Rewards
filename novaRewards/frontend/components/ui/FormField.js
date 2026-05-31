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
      'block w-full rounded-md border px-3 py-2 text-sm',
      'focus:outline-none focus:ring-2',
      showError
        ? 'border-red-500 focus:ring-red-400'
        : 'border-gray-300 focus:ring-indigo-400',
      disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white',
    ].join(' '),
  };

  return (
    <div className="mb-4">
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-gray-700"
      >
        {label}
        {required && (
          <span className="ml-1 text-red-500" aria-hidden="true">
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
        <p id={hintId} className="mt-1 text-xs text-gray-500">
          {hint}
        </p>
      )}

      {showError && (
        <p
          id={errorId}
          role="alert"
          className="mt-1 text-xs text-red-600"
        >
          {error}
        </p>
      )}
    </div>
  );
}
