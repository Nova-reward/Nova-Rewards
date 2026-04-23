import React from 'react';
import { Input } from './Input';

export default {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
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

export const WithValue = Template.bind({});
WithValue.args = {
  value: 'Prefilled value',
  readOnly: true,
};

export const Password = Template.bind({});
Password.args = {
  type: 'password',
  placeholder: 'Enter password',
};

export const AllStates = () => (
  <div className="flex flex-col gap-4 w-72">
    <Input placeholder="Default" />
    <Input placeholder="With error" error="This field is required" />
    <Input placeholder="Disabled" disabled />
    <Input value="Read only" readOnly />
  </div>
);
