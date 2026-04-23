import React from 'react';
import { Badge } from './Badge';

export default {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'secondary', 'destructive', 'outline'],
    },
  },
};

const Template = (args) => <Badge {...args}>Badge</Badge>;

export const Default = Template.bind({});
Default.args = { variant: 'default' };

export const Secondary = Template.bind({});
Secondary.args = { variant: 'secondary' };

export const Destructive = Template.bind({});
Destructive.args = { variant: 'destructive' };

export const Outline = Template.bind({});
Outline.args = { variant: 'outline' };

export const LongLabel = (args) => <Badge {...args}>Long Badge Label Text</Badge>;
LongLabel.args = { variant: 'default' };

export const AllVariants = () => (
  <div className="flex gap-2 flex-wrap">
    <Badge variant="default">Default</Badge>
    <Badge variant="secondary">Secondary</Badge>
    <Badge variant="destructive">Destructive</Badge>
    <Badge variant="outline">Outline</Badge>
  </div>
);
