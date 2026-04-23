import React from 'react';
import { Button } from './Button';

export default {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'outline', 'danger'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    disabled: {
      control: 'boolean',
    },
  },
};

const Template = (args) => <Button {...args}>Button Text</Button>;

export const Primary = Template.bind({});
Primary.args = {
  variant: 'primary',
  size: 'md',
};

export const Secondary = Template.bind({});
Secondary.args = {
  variant: 'secondary',
  size: 'md',
};

export const Outline = Template.bind({});
Outline.args = {
  variant: 'outline',
  size: 'md',
};

export const Danger = Template.bind({});
Danger.args = {
  variant: 'danger',
  size: 'md',
};

export const Small = Template.bind({});
Small.args = {
  variant: 'primary',
  size: 'sm',
};

export const Large = Template.bind({});
Large.args = {
  variant: 'primary',
  size: 'lg',
};

export const Disabled = Template.bind({});
Disabled.args = {
  variant: 'primary',
  size: 'md',
  disabled: true,
};
