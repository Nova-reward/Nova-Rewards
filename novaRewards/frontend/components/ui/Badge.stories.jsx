import React from 'react';
import Badge from './Badge';

export default {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['success', 'warning', 'error', 'info'],
    },
  },
};

const Template = (args) => <Badge {...args}>Badge</Badge>;

export const Success = Template.bind({});
Success.args = { variant: 'success' };

export const Warning = Template.bind({});
Warning.args = { variant: 'warning' };

export const Error = Template.bind({});
Error.args = { variant: 'error' };

export const Info = Template.bind({});
Info.args = { variant: 'info' };

export const LongLabel = () => <Badge variant="info">Long Badge Label Text</Badge>;

export const AllVariants = () => (
  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
    <Badge variant="success">Success</Badge>
    <Badge variant="warning">Warning</Badge>
    <Badge variant="error">Error</Badge>
    <Badge variant="info">Info</Badge>
  </div>
);
