import React from 'react';
import Input from './Input';

export default {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    error: { control: 'text' },
    helperText: { control: 'text' },
    label: { control: 'text' },
    type: {
      control: { type: 'select' },
      options: ['text', 'email', 'password', 'number', 'search'],
    },
  },
};

const Template = (args) => <Input {...args} />;

export const Default = Template.bind({});
Default.args = { label: 'Email', placeholder: 'you@example.com', type: 'email' };

export const WithHelperText = Template.bind({});
WithHelperText.args = {
  label: 'Username',
  placeholder: 'Enter username',
  helperText: 'Must be at least 3 characters.',
};

export const WithError = Template.bind({});
WithError.args = {
  label: 'Email',
  placeholder: 'you@example.com',
  error: 'This field is required.',
};

export const Disabled = Template.bind({});
Disabled.args = { label: 'Disabled field', placeholder: 'Cannot edit', disabled: true };

export const Password = Template.bind({});
Password.args = { label: 'Password', type: 'password', placeholder: 'Enter password' };

export const NoLabel = Template.bind({});
NoLabel.args = { placeholder: 'Search…', type: 'search', 'aria-label': 'Search' };

export const AllStates = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '320px' }}>
    <Input label="Default" placeholder="Enter value" />
    <Input label="With helper" placeholder="Enter value" helperText="Some helpful hint." />
    <Input label="With error" placeholder="Enter value" error="This field is required." />
    <Input label="Disabled" placeholder="Cannot edit" disabled />
  </div>
);
