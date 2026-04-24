import { Input } from './Input';

export default {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    error: { control: 'text' },
    label: { control: 'text' },
    placeholder: { control: 'text' },
  },
};

const Template = (args) => <div className="w-72"><Input {...args} /></div>;

export const Default = Template.bind({});
Default.args = { placeholder: 'Enter text…' };

export const WithLabel = Template.bind({});
WithLabel.args = { label: 'Email address', placeholder: 'you@example.com', type: 'email' };

export const WithError = Template.bind({});
WithError.args = { label: 'Email address', placeholder: 'you@example.com', error: 'Please enter a valid email.' };

export const Disabled = Template.bind({});
Disabled.args = { label: 'Username', placeholder: 'Cannot edit', disabled: true };

export const Password = Template.bind({});
Password.args = { label: 'Password', type: 'password', placeholder: '••••••••' };

export const ReadOnly = Template.bind({});
ReadOnly.args = { label: 'Account ID', value: 'G3XK…9F2A', readOnly: true };

export const AllStates = () => (
  <div className="flex flex-col gap-4 w-72">
    <Input label="Default" placeholder="Enter text…" />
    <Input label="With error" placeholder="Invalid" error="This field is required." />
    <Input label="Disabled" placeholder="Cannot edit" disabled />
    <Input label="Read only" value="Read-only value" readOnly />
  </div>
);
