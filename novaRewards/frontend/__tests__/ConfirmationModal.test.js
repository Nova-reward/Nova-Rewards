import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConfirmationModal from '../components/ConfirmationModal';

const defaultProps = {
  isOpen: true,
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
  recipient: 'GABC...XYZ',
  amount: '50',
};

describe('ConfirmationModal', () => {
  beforeEach(() => jest.clearAllMocks());

  test('renders nothing when isOpen is false', () => {
    const { container } = render(<ConfirmationModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders recipient and amount when open', () => {
    render(<ConfirmationModal {...defaultProps} />);
    expect(screen.getByText('GABC...XYZ')).toBeInTheDocument();
    expect(screen.getByText(/50/)).toBeInTheDocument();
  });

  test('defaults to NOVA asset and transfer operation', () => {
    render(<ConfirmationModal {...defaultProps} />);
    expect(screen.getByText('50 NOVA')).toBeInTheDocument();
    expect(screen.getByText('Confirm transfer')).toBeInTheDocument();
  });

  test('uses custom asset and operation props', () => {
    render(<ConfirmationModal {...defaultProps} asset="XLM" operation="redemption" />);
    expect(screen.getByText('50 XLM')).toBeInTheDocument();
    expect(screen.getByText('Confirm redemption')).toBeInTheDocument();
  });

  test('calls onConfirm when Confirm button clicked', () => {
    render(<ConfirmationModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  test('calls onCancel when Cancel button clicked', () => {
    render(<ConfirmationModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  test('calls onCancel when overlay is clicked', () => {
    render(<ConfirmationModal {...defaultProps} />);
    fireEvent.click(document.querySelector('.modal-overlay'));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  test('does not call onCancel when modal content is clicked', () => {
    render(<ConfirmationModal {...defaultProps} />);
    fireEvent.click(document.querySelector('.modal-content'));
    expect(defaultProps.onCancel).not.toHaveBeenCalled();
  });
});
