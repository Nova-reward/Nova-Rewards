import React from 'react';
import Card from './Card';
import Button from './Button';

export default {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'elevated', 'bordered'],
    },
  },
};

const Template = (args) => (
  <Card {...args} style={{ width: '320px', padding: '24px' }}>
    <h3 style={{ marginBottom: '8px', fontWeight: 600 }}>Card Title</h3>
    <p style={{ fontSize: '14px', color: '#64748b' }}>Card body content goes here.</p>
  </Card>
);

export const Default = Template.bind({});
Default.args = { variant: 'default' };

export const Elevated = Template.bind({});
Elevated.args = { variant: 'elevated' };

export const Bordered = Template.bind({});
Bordered.args = { variant: 'bordered' };

export const WithActions = () => (
  <Card style={{ width: '320px', padding: '24px' }}>
    <h3 style={{ marginBottom: '8px', fontWeight: 600 }}>Confirm Action</h3>
    <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
      Are you sure you want to proceed?
    </p>
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button variant="primary" size="sm">Confirm</Button>
      <Button variant="secondary" size="sm">Cancel</Button>
    </div>
  </Card>
);

export const ContentOnly = () => (
  <Card style={{ width: '320px', padding: '24px' }}>
    <p style={{ fontSize: '14px', color: '#64748b' }}>Card with content only, no title.</p>
  </Card>
);

export const AllVariants = () => (
  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
    {['default', 'elevated', 'bordered'].map((v) => (
      <Card key={v} variant={v} style={{ width: '200px', padding: '16px' }}>
        <p style={{ fontWeight: 600, textTransform: 'capitalize' }}>{v}</p>
      </Card>
    ))}
  </div>
);
