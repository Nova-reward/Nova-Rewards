import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';

export default {
  title: 'UI/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: {
    // Modals render in a portal — show them open by default in Storybook
    layout: 'centered',
  },
};

export const Default = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Modal</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Example Modal">
        <p>Modal body content goes here.</p>
        <div style={{ marginTop: '16px' }}>
          <Button variant="danger" size="sm" onClick={() => setOpen(false)}>Close</Button>
        </div>
      </Modal>
    </>
  );
};

export const NoTitle = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open (no title)</Button>
      <Modal open={open} onClose={() => setOpen(false)}>
        <p>Modal without a title.</p>
        <div style={{ marginTop: '16px' }}>
          <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Dismiss</Button>
        </div>
      </Modal>
    </>
  );
};

export const WithForm = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Form Modal</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Confirm Action">
        <p style={{ marginBottom: '16px', fontSize: '14px', color: '#64748b' }}>
          Are you sure you want to delete this item? This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="danger" size="sm" onClick={() => setOpen(false)}>Delete</Button>
          <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </Modal>
    </>
  );
};

export const LongContent = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Long Modal</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Terms of Service">
        {Array.from({ length: 10 }, (_, i) => (
          <p key={i} style={{ marginBottom: '12px', fontSize: '14px' }}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua. Paragraph {i + 1}.
          </p>
        ))}
        <Button variant="primary" size="sm" onClick={() => setOpen(false)}>Accept</Button>
      </Modal>
    </>
  );
};
