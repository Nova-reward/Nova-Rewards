# Accessibility Testing Guide

## Overview

This document describes the comprehensive accessibility testing strategy for Nova Rewards, ensuring WCAG 2.1 Level AA compliance.

## Testing Coverage

### 1. WCAG 2.1 Compliance

Our accessibility tests verify compliance with WCAG 2.1 Level AA standards across all components and pages.

#### Key Success Criteria Tested:

- **1.3.1 Info and Relationships**: Semantic HTML and programmatic associations
- **1.4.3 Contrast (Minimum)**: Color contrast ratios meet AA standards (4.5:1 for normal text, 3:1 for large text)
- **1.4.10 Reflow**: Content reflows without horizontal scrolling at 320px width
- **1.4.11 Non-text Contrast**: UI components have sufficient contrast (3:1 minimum)
- **2.1.1 Keyboard**: All functionality available via keyboard
- **2.4.3 Focus Order**: Logical and intuitive focus order
- **2.4.7 Focus Visible**: Visible focus indicators on all interactive elements
- **2.5.3 Label in Name**: Accessible names match visible labels
- **3.2.2 On Input**: No unexpected context changes on input
- **3.3.1 Error Identification**: Clear error identification and description
- **3.3.2 Labels or Instructions**: Clear labels and instructions for inputs
- **4.1.2 Name, Role, Value**: Proper ARIA attributes on all components

### 2. Keyboard Navigation

All interactive elements are fully accessible via keyboard:

- **Tab Navigation**: Sequential navigation through interactive elements
- **Enter/Space**: Button activation
- **Escape**: Modal dismissal
- **Arrow Keys**: Navigation within composite widgets
- **Skip Links**: Skip to main content functionality

#### Tested Scenarios:

- Form navigation and submission
- Modal focus trapping
- Button activation
- Link navigation
- Disabled element skipping

### 3. Screen Reader Support

Components provide proper semantic information to assistive technologies:

#### ARIA Attributes:

- `role`: Proper roles for custom components
- `aria-label`: Accessible names where needed
- `aria-labelledby`: Association with visible labels
- `aria-describedby`: Association with descriptions and errors
- `aria-invalid`: Error state indication
- `aria-busy`: Loading state indication
- `aria-live`: Dynamic content announcements

#### Semantic HTML:

- Proper heading hierarchy (h1-h6)
- Landmark regions (main, nav, aside, footer)
- Form labels associated with inputs
- Button elements (not divs)
- Semantic lists and tables

### 4. Color Contrast

All text and UI components meet WCAG AA contrast requirements:

- **Normal Text**: 4.5:1 minimum contrast ratio
- **Large Text**: 3:1 minimum contrast ratio
- **UI Components**: 3:1 minimum contrast ratio
- **Focus Indicators**: Sufficient contrast against background

#### Tested Elements:

- Buttons (all variants)
- Input fields
- Error messages
- Toast notifications
- Links
- Disabled states

### 5. Focus Management

Proper focus handling throughout the application:

- **Visible Focus Indicators**: All focusable elements have clear focus styles
- **Focus Order**: Logical tab order matching visual layout
- **Focus Trapping**: Modals trap focus within dialog
- **Focus Restoration**: Focus returns to trigger element after modal close
- **Skip Links**: Allow skipping repetitive content

## Test Suites

### Unit Tests (Jest + jest-axe)

Location: `__tests__/accessibility.test.js`

Run with:
```bash
npm test -- accessibility.test.js
```

Tests individual components in isolation:
- Button variants and states
- Input fields with labels and errors
- Forms with validation
- Toast notifications
- Modals and dialogs
- Navigation components

### E2E Tests (Playwright + @axe-core/playwright)

Location: `e2e/accessibility.spec.js`

Run with:
```bash
npm run test:a11y
```

Tests complete pages and user flows:
- All public routes
- All authenticated routes
- Interactive states (errors, loading, etc.)
- Keyboard navigation flows
- Screen reader compatibility
- Color contrast across themes
- Focus management in complex interactions

## Running Tests

### Run All Accessibility Tests

```bash
# Unit tests
npm test -- accessibility.test.js

# E2E tests
npm run test:a11y

# All tests
npm test && npm run test:a11y
```

### Run Specific Test Suites

```bash
# Only keyboard navigation tests
npm test -- accessibility.test.js -t "Keyboard Navigation"

# Only WCAG compliance tests
npm test -- accessibility.test.js -t "WCAG"

# Only screen reader tests
npm run test:a11y -- -g "Screen reader"
```

### CI/CD Integration

Accessibility tests run automatically in CI:

```yaml
- name: Run accessibility tests
  run: |
    npm test -- accessibility.test.js
    npm run test:a11y
```

Tests fail the build if critical or serious violations are found.

## Manual Testing Checklist

While automated tests catch many issues, manual testing is essential:

### Screen Reader Testing

Test with at least one screen reader:

- **Windows**: NVDA (free) or JAWS
- **macOS**: VoiceOver (built-in)
- **Linux**: Orca

#### Test Scenarios:

- [ ] Navigate through forms
- [ ] Trigger and dismiss modals
- [ ] Navigate data tables
- [ ] Interact with custom widgets
- [ ] Verify error announcements
- [ ] Check dynamic content updates

### Keyboard-Only Testing

Navigate the entire application without a mouse:

- [ ] Tab through all interactive elements
- [ ] Activate buttons with Enter/Space
- [ ] Submit forms with Enter
- [ ] Close modals with Escape
- [ ] Navigate menus with arrow keys
- [ ] Verify focus is always visible

### Zoom and Reflow Testing

Test at different zoom levels:

- [ ] 200% zoom (WCAG requirement)
- [ ] 400% zoom
- [ ] Mobile viewport (320px width)
- [ ] Verify no horizontal scrolling
- [ ] Verify all content remains accessible

### Color Contrast Testing

Use browser extensions or tools:

- **Chrome**: Lighthouse, axe DevTools
- **Firefox**: Accessibility Inspector
- **Online**: WebAIM Contrast Checker

#### Check:

- [ ] Text on backgrounds
- [ ] Button states
- [ ] Focus indicators
- [ ] Error messages
- [ ] Disabled states

## Tools and Resources

### Browser Extensions

- **axe DevTools**: Automated accessibility testing
- **WAVE**: Visual accessibility evaluation
- **Lighthouse**: Comprehensive audits including accessibility
- **Color Contrast Analyzer**: Check contrast ratios

### Testing Libraries

- **jest-axe**: Automated accessibility testing in Jest
- **@axe-core/playwright**: E2E accessibility testing
- **@testing-library/react**: Accessible component testing
- **@testing-library/user-event**: Realistic user interactions

### Documentation

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM Resources](https://webaim.org/resources/)
- [A11y Project](https://www.a11yproject.com/)

## Known Issues and Remediation

Track accessibility issues in GitHub with the `accessibility` label.

### Issue Template

```markdown
**WCAG Criterion**: [e.g., 1.4.3 Contrast (Minimum)]
**Severity**: [Critical/Serious/Moderate/Minor]
**Component**: [e.g., Button, Input, Modal]
**Description**: [Clear description of the issue]
**Steps to Reproduce**: [How to find the issue]
**Expected Behavior**: [What should happen]
**Actual Behavior**: [What currently happens]
**Remediation**: [Proposed fix]
```

## Continuous Improvement

### Regular Audits

- **Weekly**: Review automated test results
- **Monthly**: Manual testing with screen readers
- **Quarterly**: Comprehensive accessibility audit
- **Annually**: Third-party accessibility assessment

### Training

- Team members complete accessibility training
- Regular knowledge sharing sessions
- Stay updated on WCAG guidelines and best practices

### User Feedback

- Provide accessibility feedback mechanism
- Monitor and respond to accessibility issues
- Engage with users who rely on assistive technologies

## Compliance Statement

Nova Rewards is committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply relevant accessibility standards.

### Conformance Status

**Target**: WCAG 2.1 Level AA Conformance

We aim to conform to WCAG 2.1 Level AA standards. Conformance means that the content fully conforms to the accessibility standard without any exceptions.

### Feedback

We welcome feedback on the accessibility of Nova Rewards. Please contact us if you encounter accessibility barriers:

- **Email**: accessibility@novarewards.com
- **GitHub**: Open an issue with the `accessibility` label

We try to respond to feedback within 2 business days.

## Conclusion

Accessibility is not a feature—it's a fundamental requirement. By following this testing guide and maintaining our commitment to accessibility, we ensure Nova Rewards is usable by everyone, regardless of ability.

---

**Last Updated**: 2024-01-01  
**Next Review**: 2024-04-01
