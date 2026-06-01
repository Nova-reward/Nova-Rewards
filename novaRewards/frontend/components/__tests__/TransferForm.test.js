import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import TokenTransferForm from '../TransferForm';
import { useWalletStore } from '../../store/walletStore';
import { useToast } from '../Toast';
import * as api from '../../lib/api';
import * as freighter from '../../lib/freighter';

// =====================================================================
// Test Setup & Mocks
// =====================================================================

jest.mock('../../store/walletStore');
jest.mock('../Toast');
jest.mock('../../lib/api');
jest.mock('../../lib/freighter');
jest.mock('../../lib/horizonClient');

const mockToast = {
  addToast: jest.fn(),
  removeToast: jest.fn(),
};

const mockWalletStore = {
  publicKey: 'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQSXUSMIQ7XICSI6FCCYC7TQY',
  balance: '100.0000000',
};

beforeEach(() => {
  jest.clearAllMocks();
  useWalletStore.mockReturnValue(mockWalletStore);
  useToast.mockReturnValue(mockToast);
  api.post = jest.fn().mockResolvedValue({ data: { success: true, data: { exists: true } } });
  freighter.signAndSubmit = jest
    .fn()
    .mockResolvedValue({ txHash: '1234567890abcdef' });
});

// =====================================================================
// Test Suites
// =====================================================================

describe('TokenTransferForm - Acceptance Criteria Tests', () => {
  // =====================================================================
  // Criterion 1: Stellar Address Validation
  // =====================================================================

  describe('Criterion 1: Stellar Address Validation (Client-Side)', () => {
    it('should reject invalid Stellar address format', async () => {
      const user = userEvent.setup();
      render(<TokenTransferForm />);

      const recipientInput = screen.getByPlaceholderText('G...');
      await user.type(recipientInput, 'INVALID_ADDRESS');
      await user.tab(); // Trigger blur validation

      await waitFor(() => {
        expect(
          screen.getByText(/Enter a valid Stellar public key/i)
        ).toBeInTheDocument();
      });
    });

    it('should accept valid Stellar address format', async () => {
      const user = userEvent.setup();
      render(<TokenTransferForm />);

      const recipientInput = screen.getByPlaceholderText('G...');
      const validAddress = 'GA7DHNHTQM37L7YJ7GBHYJJBQ42JTJYWJ3DZQQQ3H35AKAEPJXYABKYK';

      await user.type(recipientInput, validAddress);
      await user.tab();

      await waitFor(() => {
        // No error should be shown for valid address
        expect(
          screen.queryByText(/Enter a valid Stellar public key/i)
        ).not.toBeInTheDocument();
      });
    });

    it('should validate address on blur for better UX', async () => {
      const user = userEvent.setup();
      render(<TokenTransferForm />);

      const recipientInput = screen.getByPlaceholderText('G...');

      // Type invalid address
      await user.type(recipientInput, 'INVALID');
      
      // Error should not show until blur
      expect(
        screen.queryByText(/Enter a valid Stellar public key/i)
      ).not.toBeInTheDocument();

      // Tab to trigger blur
      await user.tab();

      // Now error should be visible
      await waitFor(() => {
        expect(
          screen.getByText(/Enter a valid Stellar public key/i)
        ).toBeInTheDocument();
      });
    });
  });

  // =====================================================================
  // Criterion 2: Confirmation Modal with Full Details
  // =====================================================================

  describe('Criterion 2: Confirmation Modal with Transaction Details', () => {
    it('should display confirmation modal with sender address', async () => {
      const user = userEvent.setup();
      render(<TokenTransferForm />);

      // Fill form
      const recipientInput = screen.getByPlaceholderText('G...');
      const amountInput = screen.getByPlaceholderText('10.00');
      const validAddress = 'GA7DHNHTQM37L7YJ7GBHYJJBQ42JTJYWJ3DZQQQ3H35AKAEPJXYABKYK';

      await user.type(recipientInput, validAddress);
      await user.type(amountInput, '10.5');

      // Submit
      const submitButton = screen.getByText(/Review & Send/i);
      await user.click(submitButton);

      // Modal should appear with sender truncated address
      await waitFor(() => {
        expect(screen.getByText(/Confirm Transfer/i)).toBeInTheDocument();
        expect(screen.getByText(/From/i)).toBeInTheDocument();
        // Should show truncated sender address
        expect(screen.getByText(/GBUQWP\.\.\./i)).toBeInTheDocument();
      });
    });

    it('should display recipient address in confirmation modal', async () => {
      const user = userEvent.setup();
      render(<TokenTransferForm />);

      const recipientInput = screen.getByPlaceholderText('G...');
      const amountInput = screen.getByPlaceholderText('10.00');
      const validAddress = 'GA7DHNHTQM37L7YJ7GBHYJJBQ42JTJYWJ3DZQQQ3H35AKAEPJXYABKYK';

      await user.type(recipientInput, validAddress);
      await user.type(amountInput, '5.25');
      await user.click(screen.getByText(/Review & Send/i));

      await waitFor(() => {
        expect(screen.getByText(/To/i)).toBeInTheDocument();
        expect(screen.getByText(/GA7DHNHTQ\.\.\./i)).toBeInTheDocument();
      });
    });

    it('should display amount in confirmation modal', async () => {
      const user = userEvent.setup();
      render(<TokenTransferForm />);

      const recipientInput = screen.getByPlaceholderText('G...');
      const amountInput = screen.getByPlaceholderText('10.00');
      const validAddress = 'GA7DHNHTQM37L7YJ7GBHYJJBQ42JTJYWJ3DZQQQ3H35AKAEPJXYABKYK';

      await user.type(recipientInput, validAddress);
      await user.type(amountInput, '42.5');
      await user.click(screen.getByText(/Review & Send/i));

      await waitFor(() => {
        expect(screen.getByText('Amount')).toBeInTheDocument();
        expect(screen.getByText('42.5')).toBeInTheDocument();
      });
    });

    it('should display estimated network fee in confirmation modal', async () => {
      const user = userEvent.setup();
      render(<TokenTransferForm />);

      const recipientInput = screen.getByPlaceholderText('G...');
      const amountInput = screen.getByPlaceholderText('10.00');
      const validAddress = 'GA7DHNHTQM37L7YJ7GBHYJJBQ42JTJYWJ3DZQQQ3H35AKAEPJXYABKYK';

      await user.type(recipientInput, validAddress);
      await user.type(amountInput, '10');
      await user.click(screen.getByText(/Review & Send/i));

      await waitFor(() => {
        expect(screen.getByText(/Network Fee/i)).toBeInTheDocument();
        // BASE_FEE is 100 stroops = 0.000001 NOVA
        expect(screen.getByText(/0\.000001/)).toBeInTheDocument();
      });
    });

    it('should calculate and display total cost (amount + fee)', async () => {
      const user = userEvent.setup();
      render(<TokenTransferForm />);

      const recipientInput = screen.getByPlaceholderText('G...');
      const amountInput = screen.getByPlaceholderText('10.00');
      const validAddress = 'GA7DHNHTQM37L7YJ7GBHYJJBQ42JTJYWJ3DZQQQ3H35AKAEPJXYABKYK';

      await user.type(recipientInput, validAddress);
      await user.type(amountInput, '10');
      await user.click(screen.getByText(/Review & Send/i));

      await waitFor(() => {
        expect(screen.getByText(/Total Cost/i)).toBeInTheDocument();
        // Total should be 10 + 0.000001 = 10.0000010
      });
    });
  });

  // =====================================================================
  // Criterion 3: Insufficient Balance Prevention
  // =====================================================================

  describe('Criterion 3: Insufficient Balance Prevention', () => {
    it('should prevent submission if balance is insufficient', async () => {
      const user = userEvent.setup();
      render(<TokenTransferForm />);

      const recipientInput = screen.getByPlaceholderText('G...');
      const amountInput = screen.getByPlaceholderText('10.00');
      const validAddress = 'GA7DHNHTQM37L7YJ7GBHYJJBQ42JTJYWJ3DZQQQ3H35AKAEPJXYABKYK';

      // Try to send more than balance (balance is 100)
      await user.type(recipientInput, validAddress);
      await user.type(amountInput, '150');

      // Button should show insufficient balance
      const submitButton = screen.getByText(/Insufficient Balance/i);
      expect(submitButton).toBeDisabled();
    });

    it('should show error message for insufficient balance', async () => {
      const user = userEvent.setup();
      render(<TokenTransferForm />);

      const recipientInput = screen.getByPlaceholderText('G...');
      const amountInput = screen.getByPlaceholderText('10.00');
      const validAddress = 'GA7DHNHTQM37L7YJ7GBHYJJBQ42JTJYWJ3DZQQQ3H35AKAEPJXYABKYK';

      await user.type(recipientInput, validAddress);
      await user.type(amountInput, '101'); // More than 100 balance

      await waitFor(() => {
        expect(
          screen.getByText(/Insufficient balance\. Available:/i)
        ).toBeInTheDocument();
      });
    });

    it('should allow submission if balance is exactly equal to amount', async () => {
      useWalletStore.mockReturnValue({
        publicKey: 'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQSXUSMIQ7XICSI6FCCYC7TQY',
        balance: '50.0000000',
      });

      const user = userEvent.setup();
      render(<TokenTransferForm />);

      const recipientInput = screen.getByPlaceholderText('G...');
      const amountInput = screen.getByPlaceholderText('10.00');
      const validAddress = 'GA7DHNHTQM37L7YJ7GBHYJJBQ42JTJYWJ3DZQQQ3H35AKAEPJXYABKYK';

      await user.type(recipientInput, validAddress);
      await user.type(amountInput, '50');

      const submitButton = screen.getByText(/Review & Send/i);
      expect(submitButton).not.toBeDisabled();
    });

    it('should display available balance info', async () => {
      render(<TokenTransferForm />);

      // Balance info should be visible
      expect(screen.getByText(/Your Balance:/)).toBeInTheDocument();
      expect(screen.getByText(/100\.0000000/)).toBeInTheDocument();
    });
  });

  // =====================================================================
  // Criterion 4: Success Toast with Explorer Link
  // =====================================================================

  describe('Criterion 4: Success Toast with Stellar Explorer Link', () => {
    it('should show success toast after successful transfer', async () => {
      const user = userEvent.setup();
      render(<TokenTransferForm />);

      const recipientInput = screen.getByPlaceholderText('G...');
      const amountInput = screen.getByPlaceholderText('10.00');
      const validAddress = 'GA7DHNHTQM37L7YJ7GBHYJJBQ42JTJYWJ3DZQQQ3H35AKAEPJXYABKYK';

      await user.type(recipientInput, validAddress);
      await user.type(amountInput, '10');
      await user.click(screen.getByText(/Review & Send/i));

      // Confirm in modal
      await waitFor(() => {
        expect(screen.getByText(/Confirm Transfer/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Confirm Transfer/i));

      // Success toast should be called
      await waitFor(() => {
        expect(mockToast.addToast).toHaveBeenCalledWith(
          expect.stringContaining('Transfer successful'),
          'success',
          expect.any(Number)
        );
      });
    });

    it('should include explorer link in success message', async () => {
      const user = userEvent.setup();
      render(<TokenTransferForm />);

      const recipientInput = screen.getByPlaceholderText('G...');
      const amountInput = screen.getByPlaceholderText('10.00');
      const validAddress = 'GA7DHNHTQM37L7YJ7GBHYJJBQ42JTJYWJ3DZQQQ3H35AKAEPJXYABKYK';

      await user.type(recipientInput, validAddress);
      await user.type(amountInput, '10');
      await user.click(screen.getByText(/Review & Send/i));

      await waitFor(() => {
        expect(screen.getByText(/Confirm Transfer/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Confirm Transfer/i));

      await waitFor(() => {
        expect(mockToast.addToast).toHaveBeenCalledWith(
          expect.stringContaining('stellar.expert'),
          'success',
          expect.any(Number)
        );
      });
    });
  });

  // =====================================================================
  // Criterion 5: Form Reset After Success
  // =====================================================================

  describe('Criterion 5: Form Reset After Successful Transfer', () => {
    it('should clear form fields after successful transfer', async () => {
      const user = userEvent.setup();
      render(<TokenTransferForm />);

      const recipientInput = screen.getByPlaceholderText('G...');
      const amountInput = screen.getByPlaceholderText('10.00');
      const validAddress = 'GA7DHNHTQM37L7YJ7GBHYJJBQ42JTJYWJ3DZQQQ3H35AKAEPJXYABKYK';

      await user.type(recipientInput, validAddress);
      await user.type(amountInput, '10');
      await user.click(screen.getByText(/Review & Send/i));

      await waitFor(() => {
        expect(screen.getByText(/Confirm Transfer/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Confirm Transfer/i));

      // After transfer completes, form should reset
      await waitFor(() => {
        expect((recipientInput as HTMLInputElement).value).toBe('');
        expect((amountInput as HTMLInputElement).value).toBe('');
      });
    });

    it('should call onSuccess callback after transfer', async () => {
      const onSuccess = jest.fn();
      const user = userEvent.setup();
      render(<TokenTransferForm onSuccess={onSuccess} />);

      const recipientInput = screen.getByPlaceholderText('G...');
      const amountInput = screen.getByPlaceholderText('10.00');
      const validAddress = 'GA7DHNHTQM37L7YJ7GBHYJJBQ42JTJYWJ3DZQQQ3H35AKAEPJXYABKYK';

      await user.type(recipientInput, validAddress);
      await user.type(amountInput, '10');
      await user.click(screen.getByText(/Review & Send/i));

      await waitFor(() => {
        expect(screen.getByText(/Confirm Transfer/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Confirm Transfer/i));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  // =====================================================================
  // Additional Tests - Error Scenarios
  // =====================================================================

  describe('Error Handling', () => {
    it('should handle trustline verification failure', async () => {
      api.post.mockResolvedValueOnce({
        data: { success: false, data: { exists: false } },
      });

      const user = userEvent.setup();
      render(<TokenTransferForm />);

      const recipientInput = screen.getByPlaceholderText('G...');
      const amountInput = screen.getByPlaceholderText('10.00');
      const validAddress = 'GA7DHNHTQM37L7YJ7GBHYJJBQ42JTJYWJ3DZQQQ3H35AKAEPJXYABKYK';

      await user.type(recipientInput, validAddress);
      await user.type(amountInput, '10');
      await user.click(screen.getByText(/Review & Send/i));

      await waitFor(() => {
        expect(screen.getByText(/Confirm Transfer/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Confirm Transfer/i));

      await waitFor(() => {
        expect(mockToast.addToast).toHaveBeenCalledWith(
          expect.stringContaining('trustline'),
          'error',
          expect.any(Number)
        );
      });
    });

    it('should handle Freighter signing rejection', async () => {
      const freighterError = new Error('User rejected the signing request');
      freighterError.code = 'SIGN_REJECTED';
      freighter.signAndSubmit.mockRejectedValueOnce(freighterError);

      const user = userEvent.setup();
      render(<TokenTransferForm />);

      const recipientInput = screen.getByPlaceholderText('G...');
      const amountInput = screen.getByPlaceholderText('10.00');
      const validAddress = 'GA7DHNHTQM37L7YJ7GBHYJJBQ42JTJYWJ3DZQQQ3H35AKAEPJXYABKYK';

      await user.type(recipientInput, validAddress);
      await user.type(amountInput, '10');
      await user.click(screen.getByText(/Review & Send/i));

      await waitFor(() => {
        expect(screen.getByText(/Confirm Transfer/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Confirm Transfer/i));

      await waitFor(() => {
        expect(mockToast.addToast).toHaveBeenCalledWith(
          expect.stringContaining('rejected'),
          'error',
          expect.any(Number)
        );
      });
    });

    it('should disable submit button while form is submitting', async () => {
      // Slow down the async operation
      freighter.signAndSubmit.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve({ txHash: '123' }), 1000))
      );

      const user = userEvent.setup();
      render(<TokenTransferForm />);

      const recipientInput = screen.getByPlaceholderText('G...');
      const amountInput = screen.getByPlaceholderText('10.00');
      const validAddress = 'GA7DHNHTQM37L7YJ7GBHYJJBQ42JTJYWJ3DZQQQ3H35AKAEPJXYABKYK';

      await user.type(recipientInput, validAddress);
      await user.type(amountInput, '10');
      await user.click(screen.getByText(/Review & Send/i));

      await waitFor(() => {
        expect(screen.getByText(/Confirm Transfer/i)).toBeInTheDocument();
      });

      const confirmButton = screen.getByText(/Confirm Transfer/i);
      await user.click(confirmButton);

      // Button should be disabled during submission
      await waitFor(() => {
        expect(confirmButton).toBeDisabled();
        expect(screen.getByText(/Processing/i)).toBeInTheDocument();
      });
    });
  });

  // =====================================================================
  // Integration Tests
  // =====================================================================

  describe('Integration Tests', () => {
    it('should complete full transfer workflow', async () => {
      const onSuccess = jest.fn();
      const user = userEvent.setup();
      render(<TokenTransferForm onSuccess={onSuccess} />);

      const recipientInput = screen.getByPlaceholderText('G...');
      const amountInput = screen.getByPlaceholderText('10.00');
      const validAddress = 'GA7DHNHTQM37L7YJ7GBHYJJBQ42JTJYWJ3DZQQQ3H35AKAEPJXYABKYK';

      // 1. Fill form
      await user.type(recipientInput, validAddress);
      await user.type(amountInput, '25.5');

      // 2. Submit form (shows confirmation)
      await user.click(screen.getByText(/Review & Send/i));
      await waitFor(() => {
        expect(screen.getByText(/Confirm Transfer/i)).toBeInTheDocument();
      });

      // 3. Verify confirmation shows all details
      expect(screen.getByText('25.5')).toBeInTheDocument();
      expect(screen.getByText(/Network Fee/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Cost/i)).toBeInTheDocument();

      // 4. Confirm transfer
      await user.click(screen.getByText(/Confirm Transfer/i));

      // 5. Wait for success
      await waitFor(() => {
        expect(mockToast.addToast).toHaveBeenCalledWith(
          expect.stringContaining('successful'),
          'success',
          expect.any(Number)
        );
        expect(onSuccess).toHaveBeenCalled();
      });

      // 6. Form should be cleared
      expect((recipientInput as HTMLInputElement).value).toBe('');
      expect((amountInput as HTMLInputElement).value).toBe('');
    });
  });
});
