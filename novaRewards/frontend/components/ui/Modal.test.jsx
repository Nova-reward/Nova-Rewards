import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import Modal from './Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(<Modal open={false} onClose={jest.fn()} title="Test" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when open', () => {
    render(<Modal open onClose={jest.fn()} title="My Modal"><p>Content</p></Modal>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders title', () => {
    render(<Modal open onClose={jest.fn()} title="Hello Modal" />);
    expect(screen.getByText('Hello Modal')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<Modal open onClose={onClose} title="Close Test" />);
    await user.click(screen.getByRole('button', { name: /close modal/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<Modal open onClose={onClose} title="Esc Test" />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<Modal open onClose={onClose} title="Overlay Test" />);
    await user.click(screen.getByRole('presentation'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has aria-modal and aria-labelledby set', () => {
    render(<Modal open onClose={jest.fn()} title="ARIA Test" />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'ui-modal-title');
  });

  it('has no accessibility violations when open', async () => {
    const { container } = render(
      <Modal open onClose={jest.fn()} title="A11y Modal">
        <p>Accessible content</p>
      </Modal>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
