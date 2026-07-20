'use client';
/**
 * useFormValidation — Issue #323
 *
 * React hook that wires up real-time inline validation for any form.
 *
 * Usage:
 *   const { values, errors, touched, handleChange, handleBlur, validate } =
 *     useFormValidation(initialValues, rules);
 */
import { useState, useCallback } from 'react';
import { validateForm } from '../lib/validation';

/**
 * @param {Record<string, unknown>} initialValues
 * @param {Record<string, (v: unknown) => string | null>} rules
 */
export default function useFormValidation(initialValues, rules) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setValues((prev) => ({ ...prev, [name]: value }));
      // Re-validate the changed field immediately if it has been touched
      if (touched[name] && rules[name]) {
        setErrors((prev) => ({ ...prev, [name]: rules[name](value) }));
      }
    },
    [touched, rules]
  );

  const handleBlur = useCallback(
    (e) => {
      const { name, value } = e.target;
      setTouched((prev) => ({ ...prev, [name]: true }));
      if (rules[name]) {
        setErrors((prev) => ({ ...prev, [name]: rules[name](value) }));
      }
    },
    [rules]
  );

  /** Run all rules; marks every field as touched. Returns true if valid. */
  const validate = useCallback(() => {
    const { valid, errors: newErrors } = validateForm(values, rules);
    setErrors(newErrors);
    const allTouched = Object.keys(rules).reduce(
      (acc, k) => ({ ...acc, [k]: true }),
      {}
    );
    setTouched(allTouched);
    return valid;
  }, [values, rules]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return { values, errors, touched, handleChange, handleBlur, validate, reset, setValues };
}
