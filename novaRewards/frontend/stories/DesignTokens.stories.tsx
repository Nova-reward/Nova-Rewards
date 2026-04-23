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

// ─── Typography ───────────────────────────────────────────────────────────────

export const Typography: StoryObj = {
  name: 'Typography Scale',
  render: () => (
    <div className="space-y-6 p-6 font-sans">
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Font Families
        </h2>
        <p className="font-sans  text-base text-neutral-800">Sans — Inter (primary body text)</p>
        <p className="font-serif text-base text-neutral-800">Serif — Merriweather (editorial)</p>
        <p className="font-mono  text-base text-neutral-800">Mono — JetBrains Mono (code / addresses)</p>
      </section>

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
            <p key={cls} className={`${cls} text-neutral-800 leading-tight`}>{label}</p>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Font Weights
        </h2>
        <div className="space-y-1 text-base text-neutral-800">
          <p className="font-light">Light (300) — Subtle, decorative</p>
          <p className="font-normal">Normal (400) — Body copy</p>
          <p className="font-medium">Medium (500) — UI labels</p>
          <p className="font-semibold">Semibold (600) — Subheadings</p>
          <p className="font-bold">Bold (700) — Headings, CTAs</p>
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
    <div className="p-6 font-sans space-y-6 max-w-2xl text-sm text-neutral-700">
      <section>
        <h2 className="mb-2 font-semibold text-neutral-900">Color tokens</h2>
        <ul className="space-y-1 list-disc pl-5">
          <li><code className="font-mono text-primary-600">primary-{'{50–950}'}</code> — Brand violet, interactive elements</li>
          <li><code className="font-mono text-primary-600">secondary-{'{50–950}'}</code> — Accent indigo, supporting UI</li>
          <li><code className="font-mono text-primary-600">neutral-{'{50–950}'}</code> — Grays for text, borders, backgrounds</li>
          <li><code className="font-mono text-primary-600">success / warning / error / info</code> — Semantic feedback</li>
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-semibold text-neutral-900">Typography tokens</h2>
        <ul className="space-y-1 list-disc pl-5">
          <li><code className="font-mono text-primary-600">font-sans / serif / mono</code> — Font family</li>
          <li><code className="font-mono text-primary-600">text-{'{xs|sm|base|lg|xl|2xl|3xl|4xl}'}</code> — Size</li>
          <li><code className="font-mono text-primary-600">font-{'{light|normal|medium|semibold|bold}'}</code> — Weight</li>
          <li><code className="font-mono text-primary-600">leading-{'{tight|normal|relaxed}'}</code> — Line height</li>
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-semibold text-neutral-900">Spacing tokens</h2>
        <p>All spacing uses a <strong>4px base unit</strong>. Use Tailwind utilities (<code className="font-mono text-primary-600">p-4</code>, <code className="font-mono text-primary-600">gap-6</code>) or CSS vars (<code className="font-mono text-primary-600">var(--space-4)</code>) for non-Tailwind contexts.</p>
      </section>
    </div>
  ),
};
