import React, { useState } from 'react';
import Modal from './Modal';
import { Button } from './Button';

export default {
  title: 'UI/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};

export const Default = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Modal</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Example Modal">
        <p className="type-body-sm text-neutral-600 dark:text-neutral-400">
          Modal body content goes here.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="primary" size="sm" onClick={() => setOpen(false)}>Confirm</Button>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
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
        <p className="type-body-sm text-neutral-600 dark:text-neutral-400">
          Modal without a title.
        </p>
        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Dismiss</Button>
        </div>
      </Modal>
    </>
  );
};

export const DestructiveAction = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>Delete Account</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Confirm Deletion">
        <p className="type-body-sm text-neutral-600 dark:text-neutral-400">
          This action cannot be undone. Are you sure?
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="danger" size="sm" onClick={() => setOpen(false)}>Delete</Button>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </Modal>
    </>
  );
};

export const WithLongContent = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open (long content)</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Terms of Service">
        {Array.from({ length: 8 }).map((_, i) => (
          <p key={i} className="type-body-sm text-neutral-600 dark:text-neutral-400 mb-3">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam. Paragraph {i + 1}.
          </p>
        ))}
        <Button variant="primary" size="sm" onClick={() => setOpen(false)}>Accept</Button>
      </Modal>
    </>
  );
};
