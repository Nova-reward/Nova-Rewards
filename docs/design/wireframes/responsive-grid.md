# Responsive Grid System — Nova Rewards

**Version:** 1.0  
**Last Updated:** 2026-07-23

---

## Grid Foundation

Nova Rewards uses a **12-column fluid grid** built on Tailwind CSS.

| Property | Value |
|----------|-------|
| Columns | 12 |
| Column width | Auto (fluid) |
| Gutter (desktop) | 24px (`gap-6`) |
| Gutter (tablet) | 20px (`gap-5`) |
| Gutter (mobile) | 16px (`gap-4`) |
| Container padding (desktop) | 32px (`px-8`) |
| Container padding (mobile) | 16px (`px-4`) |

---

## Breakpoints

| Name | Min Width | Container Max-Width | Cols | Gutter |
|------|-----------|---------------------|------|--------|
| `xs` | 0px | 100% | 1-2 | 16px |
| `sm` | 640px | 640px | 2 | 16px |
| `md` | 768px | 768px | 4-6 | 20px |
| `lg` | 1024px | 1024px | 8-12 | 24px |
| `xl` | 1280px | 1280px | 12 | 24px |
| `2xl` | 1536px | 1536px | 12 | 24px |

---

## Card Grid Patterns

### Dashboard KPI Cards

```
xs:  grid-cols-2   [Card][Card]
                   [Card][Card]

md:  grid-cols-2   [Card][Card]
                   [Card][Card]

lg:  grid-cols-4   [Card][Card][Card][Card]
```

```jsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
  {kpiCards.map(card => <KpiCard key={card.id} {...card} />)}
</div>
```

### Rewards / Campaign Grid

```
xs:  grid-cols-1   [Card]

sm:  grid-cols-2   [Card][Card]

lg:  grid-cols-3   [Card][Card][Card]

xl:  grid-cols-4   [Card][Card][Card][Card]
```

```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
  {items.map(item => <RewardCard key={item.id} {...item} />)}
</div>
```

### Analytics / Charts Grid

```
xs:  stacked       [Wide Chart — 100%]
                   [Narrow Chart — 100%]

md:  2 columns     [Wide Chart — 8/12][Narrow — 4/12]

lg:  3 columns     [Chart][Chart][Chart]
```

---

## Dashboard Layout

```jsx
// Container with sidebar
<div className="flex min-h-screen bg-neutral-50">
  {/* Sidebar */}
  <aside className="hidden md:flex md:w-16 lg:w-60 flex-col bg-white border-r border-neutral-200">
    <Sidebar />
  </aside>

  {/* Main area */}
  <div className="flex-1 flex flex-col min-w-0">
    <header className="h-16 bg-white border-b border-neutral-200 flex items-center px-4 lg:px-6">
      <Topbar />
    </header>
    <main className="flex-1 p-4 lg:p-6 xl:p-8 max-w-[1440px] mx-auto w-full">
      {children}
    </main>
  </div>
</div>
```

---

## Safe Areas (Mobile)

For devices with notch or home indicator:

```css
/* Apply to mobile nav bar */
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
  /* Fallback */
  padding-bottom: max(16px, env(safe-area-inset-bottom));
}

/* Apply to top-of-screen fixed elements */
.topbar-fixed {
  padding-top: env(safe-area-inset-top);
}
```

In Tailwind (requires custom config):
```jsx
<nav className="pb-safe"> {/* custom utility */}
```

---

## Max Widths for Content

| Context | Max Width | Tailwind |
|---------|-----------|----------|
| Dashboard main | 1440px | `max-w-[1440px]` |
| Form pages | 480px | `max-w-md` |
| Article/docs | 720px | `max-w-2xl` |
| Wide tables | 1200px | `max-w-[1200px]` |
| Modal content | varies | see Modal component |

---

## Typography Measure (Line Length)

Optimal reading: 50–75 characters per line.

- Body text: `max-w-prose` (65ch)
- Headlines: no max-width limit
- Table cells: truncate with `truncate` + `title` attribute
