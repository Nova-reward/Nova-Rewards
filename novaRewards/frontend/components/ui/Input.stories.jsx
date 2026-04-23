import React from 'react';
import { Input } from './Input';

export default {
  title: 'UI/Input',
  component: Input,
  argTypes: {
    disabled: { control: 'boolean' },
    error: { control: 'text' },
  },
};

const Template = (args) => <Input {...args} />;

export const Default = Template.bind({});
Default.args = {
  placeholder: 'Enter something...',
};

export const WithError = Template.bind({});
WithError.args = {
  placeholder: 'Invalid input',
  error: 'This field is required',
};

export const Disabled = Template.bind({});
Disabled.args = {
  placeholder: 'Cannot edit me',
  disabled: true,
};
