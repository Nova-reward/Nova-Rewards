import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import ColorPalette from '../components/tokens/ColorPalette';

// ─── Color Palette ────────────────────────────────────────────────────────────

const colorMeta: Meta<typeof ColorPalette> = {
  title: 'Design System/Color Palette',
  component: ColorPalette,
};
export default colorMeta;

export const Colors: StoryObj<typeof ColorPalette> = {
  name: 'All Colors',
};

// ─── Type Scale ───────────────────────────────────────────────────────────────

/**
 * The Nova Rewards type scale maps each text element to a semantic role.
 * Use the .type-{step} utility class — never hardcode font-size, line-height,
 * letter-spacing, or font-weight individually on a text element.
 *
 * Scale steps: h1 h2 h3 h4 h5 h6 | body-lg body body-sm | caption label
 */
export const TypeScale: StoryObj = {
  name: 'Type Scale',
  render: () => (
    <div className="space-y-10 p-8 font-sans max-w-3xl">

      {/* ── Heading scale ─────────────────────────────────────────── */}
      <section>
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Heading Scale
        </p>
        <div className="space-y-4">
          {[
            { cls: 'type-h1', tag: 'h1', label: 'h1',       desc: '36px · weight 700 · tracking −0.02em · leading 1.1' },
            { cls: 'type-h2', tag: 'h2', label: 'h2',       desc: '30px · weight 700 · tracking −0.015em · leading 1.2' },
            { cls: 'type-h3', tag: 'h3', label: 'h3',       desc: '24px · weight 600 · tracking −0.01em · leading 1.25' },
            { cls: 'type-h4', tag: 'h4', label: 'h4',       desc: '20px · weight 600 · tracking −0.005em · leading 1.3' },
            { cls: 'type-h5', tag: 'h5', label: 'h5',       desc: '18px · weight 600 · tracking 0em · leading 1.4' },
            { cls: 'type-h6', tag: 'h6', label: 'h6',       desc: '16px · weight 600 · tracking 0em · leading 1.5' },
          ].map(({ cls, tag: Tag, label, desc }) => (
            <div key={cls} className="flex items-baseline gap-6 border-b border-neutral-100 pb-3">
              <span className="w-16 shrink-0 font-mono text-[11px] text-neutral-400">.{cls}</span>
              <Tag className={`${cls} text-neutral-900 dark:text-neutral-100 flex-1`}>
                {label} — The quick brown fox
              </Tag>
              <span className="shrink-0 font-mono text-[10px] text-neutral-400 hidden lg:block">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Body scale ────────────────────────────────────────────── */}
      <section>
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Body Scale
        </p>
        <div className="space-y-4">
          {[
            { cls: 'type-body-lg', label: 'body-lg', desc: '18px · weight 400 · leading 1.7' },
            { cls: 'type-body',    label: 'body',    desc: '16px · weight 400 · leading 1.6' },
            { cls: 'type-body-sm', label: 'body-sm', desc: '14px · weight 400 · leading 1.5' },
          ].map(({ cls, label, desc }) => (
            <div key={cls} className="flex items-baseline gap-6 border-b border-neutral-100 pb-3">
              <span className="w-24 shrink-0 font-mono text-[11px] text-neutral-400">.{cls}</span>
              <p className={`${cls} text-neutral-900 dark:text-neutral-100 flex-1`}>
                {label} — Paragraph text. Nova Rewards makes it easy to earn and redeem loyalty points.
              </p>
              <span className="shrink-0 font-mono text-[10px] text-neutral-400 hidden lg:block">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── UI labels scale ───────────────────────────────────────── */}
      <section>
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-400">
          UI Labels
        </p>
        <div className="space-y-4">
          {[
            { cls: 'type-caption', label: 'caption', desc: '12px · weight 400 · tracking 0.01em · leading 1.4' },
            { cls: 'type-label',   label: 'label',   desc: '14px · weight 500 · tracking 0.01em · leading 1.25' },
          ].map(({ cls, label, desc }) => (
            <div key={cls} className="flex items-baseline gap-6 border-b border-neutral-100 pb-3">
              <span className="w-24 shrink-0 font-mono text-[11px] text-neutral-400">.{cls}</span>
              <span className={`${cls} text-neutral-900 dark:text-neutral-100 flex-1`}>
                {label} — Form label / timestamp / badge text
              </span>
              <span className="shrink-0 font-mono text-[10px] text-neutral-400 hidden lg:block">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Font families ─────────────────────────────────────────── */}
      <section>
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Font Families
        </p>
        <div className="space-y-3">
          <p className="font-sans  type-body text-neutral-800 dark:text-neutral-100">font-sans — Inter (primary body text)</p>
          <p className="font-serif type-body text-neutral-800 dark:text-neutral-100">font-serif — Merriweather (editorial)</p>
          <p className="font-mono  type-body text-neutral-800 dark:text-neutral-100">font-mono — JetBrains Mono (code / wallet addresses)</p>
        </div>
      </section>

      {/* ── Font weights ──────────────────────────────────────────── */}
      <section>
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Font Weights
        </p>
        <div className="space-y-2 type-body text-neutral-800 dark:text-neutral-100">
          <p className="font-light">font-light (300) — Subtle, decorative</p>
          <p className="font-normal">font-normal (400) — Body copy</p>
          <p className="font-medium">font-medium (500) — UI labels</p>
          <p className="font-semibold">font-semibold (600) — Subheadings</p>
          <p className="font-bold">font-bold (700) — Headings, CTAs</p>
        </div>
      </section>
    </div>
  ),
};

// ─── Typography ───────────────────────────────────────────────────────────────
// Kept for backward compatibility — TypeScale is now the canonical story
export const Typography: StoryObj = {
  name: 'Typography (Raw Scale)',
  render: () => (
    <div className="space-y-6 p-6 font-sans">
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Size Scale
        </h2>
        <div className="space-y-2">
          {[
            ['text-xs',   'xs — 12px — Caption, labels'],
            ['text-sm',   'sm — 14px — Secondary body'],
            ['text-base', 'base — 16px — Primary body'],
            ['text-lg',   'lg — 18px — Lead text'],
            ['text-xl',   'xl — 20px — Subheading'],
            ['text-2xl',  '2xl — 24px — Section heading'],
            ['text-3xl',  '3xl — 30px — Page heading'],
            ['text-4xl',  '4xl — 36px — Hero heading'],
          ].map(([cls, label]) => (
            <p key={cls} className={`${cls} text-neutral-800 dark:text-neutral-100 leading-tight`}>{label}</p>
          ))}
        </div>
      </section>
    </div>
  ),
};

// ─── Spacing ──────────────────────────────────────────────────────────────────

export const Spacing: StoryObj = {
  name: 'Spacing Scale',
  render: () => {
    const steps: [string, string][] = [
      ['1',  '4px'],  ['2',  '8px'],  ['3',  '12px'], ['4',  '16px'],
      ['5',  '20px'], ['6',  '24px'], ['8',  '32px'], ['10', '40px'],
      ['12', '48px'], ['16', '64px'], ['20', '80px'], ['24', '96px'],
    ];
    return (
      <div className="space-y-3 p-6 font-sans">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-400">
          4px Base Unit — Spacing Scale
        </h2>
        {steps.map(([step, px]) => (
          <div key={step} className="flex items-center gap-4">
            <span className="w-8 text-right text-xs font-mono text-neutral-400">{step}</span>
            <div
              className="h-4 rounded bg-primary-500"
              style={{ width: px }}
              title={px}
            />
            <span className="text-xs font-mono text-neutral-500">{px}</span>
          </div>
        ))}
      </div>
    );
  },
};

// ─── Token Naming Conventions ─────────────────────────────────────────────────

export const TokenConventions: StoryObj = {
  name: 'Token Naming Conventions',
  render: () => (
    <div className="p-6 font-sans space-y-6 max-w-2xl type-body-sm text-neutral-700 dark:text-neutral-300">
      <section>
        <h2 className="mb-2 type-h6 text-neutral-900 dark:text-neutral-100">Color tokens</h2>
        <ul className="space-y-1 list-disc pl-5">
          <li><code className="font-mono text-primary-600">primary-{'{50–950}'}</code> — Brand violet, interactive elements</li>
          <li><code className="font-mono text-primary-600">secondary-{'{50–950}'}</code> — Accent indigo, supporting UI</li>
          <li><code className="font-mono text-primary-600">neutral-{'{50–950}'}</code> — Grays for text, borders, backgrounds</li>
          <li><code className="font-mono text-primary-600">success / warning / error / info</code> — Semantic feedback</li>
        </ul>
      </section>
      <section>
        <h2 className="mb-2 type-h6 text-neutral-900 dark:text-neutral-100">Typography tokens</h2>
        <ul className="space-y-1 list-disc pl-5">
          <li><code className="font-mono text-primary-600">.type-h1 … .type-h6</code> — Heading scale (size + weight + tracking + leading)</li>
          <li><code className="font-mono text-primary-600">.type-body-lg / .type-body / .type-body-sm</code> — Body copy</li>
          <li><code className="font-mono text-primary-600">.type-caption</code> — Timestamps, image captions (12px)</li>
          <li><code className="font-mono text-primary-600">.type-label</code> — Form labels, badge text (14px medium)</li>
          <li><code className="font-mono text-primary-600">font-sans / serif / mono</code> — Font family overrides</li>
        </ul>
      </section>
      <section>
        <h2 className="mb-2 type-h6 text-neutral-900 dark:text-neutral-100">Spacing tokens</h2>
        <p>All spacing uses a <strong>4px base unit</strong>. Use Tailwind utilities (<code className="font-mono text-primary-600">p-4</code>, <code className="font-mono text-primary-600">gap-6</code>) or CSS vars (<code className="font-mono text-primary-600">var(--space-4)</code>) for non-Tailwind contexts.</p>
      </section>
    </div>
  ),
};
