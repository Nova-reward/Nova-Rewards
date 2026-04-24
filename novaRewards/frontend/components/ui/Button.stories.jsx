 feat/storybook-components-setup
import React from 'react';
import Button from './Button';

import { Button } from './Button';
 main

export default {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'ghost', 'danger'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
 feat/storybook-components-setup
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },

    disabled: { control: 'boolean' },
    onClick: { action: 'clicked' },
 main
  },
};

const Template = (args) => <Button {...args}>Button</Button>;

export const Primary = Template.bind({});
Primary.args = { variant: 'primary', size: 'md' };

export const Secondary = Template.bind({});
Secondary.args = { variant: 'secondary', size: 'md' };

 feat/storybook-components-setup
export const Ghost = Template.bind({});
Ghost.args = { variant: 'ghost', size: 'md' };

export const Outline = Template.bind({});
Outline.args = { variant: 'outline', size: 'md' };
 main

export const Danger = Template.bind({});
Danger.args = { variant: 'danger', size: 'md' };

export const Small = Template.bind({});
Small.args = { variant: 'primary', size: 'sm' };

export const Large = Template.bind({});
Large.args = { variant: 'primary', size: 'lg' };
 feat/storybook-components-setup

export const Loading = Template.bind({});
Loading.args = { variant: 'primary', size: 'md', loading: true };

 main

export const Disabled = Template.bind({});
Disabled.args = { variant: 'primary', size: 'md', disabled: true };

 feat/storybook-components-setup
export const AllVariants = () => (
  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
    <Button variant="primary">Primary</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="ghost">Ghost</Button>

export const DisabledDanger = Template.bind({});
DisabledDanger.args = { variant: 'danger', size: 'md', disabled: true };

export const Loading = (args) => (
  <Button {...args} disabled aria-busy="true">
    <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
    Loading…
  </Button>
);
Loading.args = { variant: 'primary', size: 'md' };

export const AllVariants = () => (
  <div className="flex flex-wrap gap-3">
    <Button variant="primary">Primary</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="outline">Outline</Button>
 main
    <Button variant="danger">Danger</Button>
  </div>
);

export const AllSizes = () => (
 feat/storybook-components-setup
  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>

  <div className="flex flex-wrap items-center gap-3">
 main
    <Button variant="primary" size="sm">Small</Button>
    <Button variant="primary" size="md">Medium</Button>
    <Button variant="primary" size="lg">Large</Button>
  </div>
);
