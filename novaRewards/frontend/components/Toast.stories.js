import React, { useEffect } from 'react';
import { ToastProvider, useToast } from './Toast';

export default {
  title: 'Components/Toast',
  component: ToastProvider,
  parameters: {
    docs: {
      description: {
        component: 'Toast notification system. Wrap your app in `ToastProvider` and call `useToast()` to show notifications.',
      },
    },
  },
};

function ToastDemo({ message, type, duration }) {
  const { addToast } = useToast();
  useEffect(() => {
    addToast(message, type, duration);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

const Template = ({ message, type, duration }) => (
  <ToastProvider>
    <ToastDemo message={message} type={type} duration={duration} />
    <p style={{ padding: '1rem', color: 'var(--muted, #64748b)' }}>Toast appears in the bottom-right corner.</p>
  </ToastProvider>
);

export const Success = Template.bind({});
Success.args = { message: 'Campaign created successfully!', type: 'success', duration: 0 };

export const Error = Template.bind({});
Error.args = { message: 'Failed to connect to Stellar network.', type: 'error', duration: 0 };

export const Warning = Template.bind({});
Warning.args = { message: 'Your session is about to expire.', type: 'warning', duration: 0 };

export const Info = Template.bind({});
Info.args = { message: 'Syncing on-chain data…', type: 'info', duration: 0 };

export const AutoDismiss = Template.bind({});
AutoDismiss.args = { message: 'This toast auto-dismisses in 3 seconds.', type: 'success', duration: 3000 };
AutoDismiss.parameters = {
  docs: {
    description: { story: 'Toast disappears automatically after the specified duration.' },
  },
};

export const MultipleToasts = () => {
  function Inner() {
    const { addToast } = useToast();
    useEffect(() => {
      addToast('Reward issued to wallet.', 'success', 0);
      addToast('Rate limit approaching.', 'warning', 0);
      addToast('New campaign available.', 'info', 0);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return <p style={{ padding: '1rem', color: 'var(--muted, #64748b)' }}>Three toasts stacked (max 3).</p>;
  }
  return (
    <ToastProvider>
      <Inner />
    </ToastProvider>
  );
};
