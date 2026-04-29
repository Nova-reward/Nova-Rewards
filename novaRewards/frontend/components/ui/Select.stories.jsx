import React from 'react';
import Select from './Select';

export default {
  title: 'UI/Select',
  component: Select,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    error: { control: 'text' },
    helperText: { control: 'text' },
    label: { control: 'text' },
  },
};

const OPTIONS = [
  { value: '', label: 'Choose an option' },
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

const Template = (args) => <Select {...args} options={OPTIONS} />;

export const Default = Template.bind({});
Default.args = { label: 'Category' };

export const WithHelperText = Template.bind({});
WithHelperText.args = { label: 'Category', helperText: 'Select the most relevant category.' };

export const WithError = Template.bind({});
WithError.args = { label: 'Category', error: 'Please select an option.' };

export const Disabled = Template.bind({});
Disabled.args = { label: 'Category', disabled: true };

export const NoLabel = Template.bind({});
NoLabel.args = { 'aria-label': 'Category' };

export const AllStates = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '320px' }}>
    <Select label="Default" options={OPTIONS} />
    <Select label="With helper" options={OPTIONS} helperText="Pick one option." />
    <Select label="With error" options={OPTIONS} error="Selection required." />
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
