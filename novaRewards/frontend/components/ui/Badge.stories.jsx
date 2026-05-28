 feat/storybook-components-setup
import React from 'react';
import Badge from './Badge';

import { Badge } from './Badge';
 main

export default {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
 feat/storybook-components-setup
      options: ['success', 'warning', 'error', 'info'],

      options: ['default', 'secondary', 'destructive', 'outline'],
 main
    },
  },
};

const Template = (args) => <Badge {...args}>Badge</Badge>;

 feat/storybook-components-setup
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

export const Default = Template.bind({});
Default.args = { variant: 'default' };

export const Secondary = Template.bind({});
Secondary.args = { variant: 'secondary' };

export const Destructive = Template.bind({});
Destructive.args = { variant: 'destructive' };

export const Outline = Template.bind({});
Outline.args = { variant: 'outline' };

export const LongLabel = Template.bind({});
LongLabel.args = { variant: 'default', children: 'Long Badge Label' };

export const AllVariants = () => (
  <div className="flex flex-wrap gap-2">
    <Badge variant="default">Default</Badge>
    <Badge variant="secondary">Secondary</Badge>
    <Badge variant="destructive">Destructive</Badge>
    <Badge variant="outline">Outline</Badge>
 main
  </div>
);
