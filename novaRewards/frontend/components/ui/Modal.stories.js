import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';

export default { title: 'UI/Modal', component: Modal };

export const Default = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Modal</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Example Modal">
        <p>Modal body content goes here.</p>
        <Button variant="danger" onClick={() => setOpen(false)}>Close</Button>
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
      </Modal>
    </>
  );
};
