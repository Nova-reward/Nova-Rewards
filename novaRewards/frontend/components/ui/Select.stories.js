import Select from './Select';

export default {
  title: 'UI/Select',
  component: Select,
};

const OPTIONS = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

export const Default = () => <Select label="Choose" options={OPTIONS} />;
export const WithError = () => <Select label="Choose" options={OPTIONS} error="Selection required." />;
export const WithHelper = () => <Select label="Choose" options={OPTIONS} helperText="Pick one option." />;
