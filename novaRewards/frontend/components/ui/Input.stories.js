import Input from './Input';

export default {
  title: 'UI/Input',
  component: Input,
  argTypes: {
    type: { control: 'select', options: ['text', 'number'] },
    error: { control: 'text' },
    helperText: { control: 'text' },
  },
};

const T = (args) => <Input {...args} />;

export const Default = T.bind({});
Default.args = { label: 'Username', placeholder: 'Enter username' };

export const NumberType = T.bind({});
NumberType.args = { label: 'Amount', type: 'number', placeholder: '0' };

export const WithHelper = T.bind({});
WithHelper.args = { label: 'Email', helperText: 'We will never share your email.' };

export const WithError = T.bind({});
WithError.args = { label: 'Email', error: 'Invalid email address.' };
