import Button from './Button';

export default {
  title: 'UI/Button',
  component: Button,
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
};

const Template = (args) => <Button {...args}>Button</Button>;

export const Primary = Template.bind({});
Primary.args = { variant: 'primary', size: 'md' };

export const Secondary = Template.bind({});
Secondary.args = { variant: 'secondary', size: 'md' };

export const Ghost = Template.bind({});
Ghost.args = { variant: 'ghost', size: 'md' };

export const Danger = Template.bind({});
Danger.args = { variant: 'danger', size: 'md' };

export const Small = Template.bind({});
Small.args = { variant: 'primary', size: 'sm' };

export const Large = Template.bind({});
Large.args = { variant: 'primary', size: 'lg' };

export const Loading = Template.bind({});
Loading.args = { variant: 'primary', size: 'md', loading: true };

export const Disabled = Template.bind({});
Disabled.args = { variant: 'primary', size: 'md', disabled: true };
