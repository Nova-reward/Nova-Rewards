import Select from './Select';

export default {
  title: 'UI/Select',
  component: Select,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    error: { control: 'text' },
    helperText: { control: 'text' },
  },
};

const OPTIONS = [
  { value: '', label: 'Choose an option' },
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

const Template = (args) => <div className="w-72"><Select {...args} options={OPTIONS} /></div>;

export const Default = Template.bind({});
Default.args = { label: 'Choose' };

export const WithError = Template.bind({});
WithError.args = { label: 'Choose', error: 'Selection is required.' };

export const WithHelperText = Template.bind({});
WithHelperText.args = { label: 'Choose', helperText: 'Pick one of the options above.' };

export const Disabled = Template.bind({});
Disabled.args = { label: 'Choose', disabled: true };

export const AllStates = () => (
  <div className="flex flex-col gap-4 w-72">
    <Select label="Default" options={OPTIONS} />
    <Select label="With error" options={OPTIONS} error="Selection is required." />
    <Select label="With helper" options={OPTIONS} helperText="Pick one option." />
    <Select label="Disabled" options={OPTIONS} disabled />
  </div>
);
