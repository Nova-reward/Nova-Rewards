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
    disabled: { control: 'boolean' },
    onClick: { action: 'clicked' },
  },
};

const Template = (args) => <Button {...args}>Button</Button>;

export const Primary = Template.bind({});
Primary.args = { variant: 'primary', size: 'md' };

export const Secondary = Template.bind({});
Secondary.args = { variant: 'secondary', size: 'md' };

export const Outline = Template.bind({});
Outline.args = { variant: 'outline', size: 'md' };

export const Danger = Template.bind({});
Danger.args = { variant: 'danger', size: 'md' };

export const Small = Template.bind({});
Small.args = { variant: 'primary', size: 'sm' };

export const Large = Template.bind({});
Large.args = { variant: 'primary', size: 'lg' };

export const Disabled = Template.bind({});
Disabled.args = { variant: 'primary', size: 'md', disabled: true };

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
    <Button variant="danger">Danger</Button>
  </div>
);

export const AllSizes = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button variant="primary" size="sm">Small</Button>
    <Button variant="primary" size="md">Medium</Button>
    <Button variant="primary" size="lg">Large</Button>
  </div>
);
