import { render, cleanup, screen } from '@testing-library/react';

export function renderComponent(ui, options = {}) {
  return render(ui, options);
}

export function renderWithProviders(ui, options = {}) {
  return render(ui, options);
}

export function getText(text, options) {
  return screen.getByText(text, options);
}

export function getRole(role, options) {
  return screen.getByRole(role, options);
}

export function queryRole(role, options) {
  return screen.queryByRole(role, options);
}

export function queryText(text, options) {
  return screen.queryByText(text, options);
}

export function cleanupDom() {
  cleanup();
}

export { screen };
