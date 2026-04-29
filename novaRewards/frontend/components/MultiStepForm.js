'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * Generic multi-step form component.
 *
 * Props:
 *   steps        — array of { title, fields: (data) => JSX, validate: (data) => errors{} }
 *   initialData  — initial form data object
 *   storageKey   — localStorage key for progress persistence (optional)
 *   onSubmit     — async (data) => void  called on final submission
 *   renderSummary — (data) => JSX  custom summary view (optional)
 *   urlParamKey  — URL search param name to persist step index (optional, e.g. 'step')
 */
export default function MultiStepForm({
  steps,
  initialData = {},
  storageKey,
  onSubmit,
  renderSummary,
  urlParamKey,
}) {
  const REVIEW_INDEX = steps.length;
  const router = useRouter();

  // Resolve initial step from URL param if provided
  const getInitialStep = () => {
    if (urlParamKey && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const s = parseInt(params.get(urlParamKey), 10);
      if (!isNaN(s) && s >= 0 && s <= REVIEW_INDEX) return s;
    }
    return 0;
  };

  const [current, setCurrent] = useState(getInitialStep);
  const [data, setData] = useState(() => {
    if (storageKey && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) return { ...initialData, ...JSON.parse(saved) };
      } catch { /* ignore */ }
    }
    return initialData;
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  // Sync step to URL param
  useEffect(() => {
    if (!urlParamKey || done) return;
    const params = new URLSearchParams(window.location.search);
    params.set(urlParamKey, String(current));
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [current, urlParamKey, done]);

  // Persist form data to localStorage
  useEffect(() => {
    if (!storageKey || done) return;
    try { localStorage.setItem(storageKey, JSON.stringify(data)); } catch { /* ignore */ }
  }, [data, storageKey, done]);

  const update = useCallback((field, value) => {
    setData((d) => ({ ...d, [field]: value }));
    setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  }, []);

  const validateCurrent = useCallback(() => {
    if (current === REVIEW_INDEX) return true;
    const errs = steps[current].validate?.(data) ?? {};
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [current, data, steps, REVIEW_INDEX]);

  const next = useCallback(() => {
    if (!validateCurrent()) return;
    setCurrent((c) => c + 1);
    setErrors({});
  }, [validateCurrent]);

  const prev = useCallback(() => {
    setCurrent((c) => c - 1);
    setErrors({});
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      await onSubmit(data);
      if (storageKey) localStorage.removeItem(storageKey);
      if (urlParamKey) {
        const params = new URLSearchParams(window.location.search);
        params.delete(urlParamKey);
        window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
      }
      setDone(true);
    } catch (err) {
      setSubmitError(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [data, onSubmit, storageKey, urlParamKey]);

  if (done) {
    return (
      <div className="msf-done">
        <span className="msf-done-icon">✅</span>
        <p>Submitted successfully!</p>
      </div>
    );
  }

  const isReview = current === REVIEW_INDEX;
  const totalSteps = steps.length;

  return (
    <div className="msf">
      {/* Step indicator */}
      <div className="msf-indicator" role="list">
        {steps.map((step, i) => (
          <div
            key={i}
            role="listitem"
            className={`msf-step ${i < current ? 'msf-step-done' : ''} ${i === current ? 'msf-step-active' : ''}`}
          >
            <div className="msf-step-circle">
              {i < current ? '✓' : i + 1}
            </div>
            <span className="msf-step-label">{step.title}</span>
            {i < totalSteps - 1 && <div className="msf-step-line" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="msf-body">
        {isReview ? (
          <div className="msf-review">
            <h3 className="msf-review-title">Review your details</h3>
            {renderSummary ? renderSummary(data) : <DefaultSummary data={data} />}
            {submitError && <p className="error" style={{ marginTop: '1rem' }}>{submitError}</p>}
          </div>
        ) : (
          <div className="msf-fields">
            <h3 className="msf-step-title">{steps[current].title}</h3>
            {steps[current].fields(data, update, errors)}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="msf-nav">
        {current > 0 && (
          <button className="btn btn-secondary" onClick={prev} disabled={submitting}>
            ← Previous
          </button>
        )}
        <div style={{ flex: 1 }} />
        {isReview ? (
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={next}>
            {current === totalSteps - 1 ? 'Review →' : 'Next →'}
          </button>
        )}
      </div>
    </div>
  );
}

function DefaultSummary({ data }) {
  return (
    <dl className="msf-summary-list">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="msf-summary-row">
          <dt>{k}</dt>
          <dd>{String(v ?? '—')}</dd>
        </div>
      ))}
    </dl>
  );
}
