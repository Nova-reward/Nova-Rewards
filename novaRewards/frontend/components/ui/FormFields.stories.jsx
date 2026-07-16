import React, { useState } from 'react';
import { TextInput } from './TextInput';
import { Textarea } from './Textarea';
import { FormSelect } from './FormSelect';
import { Checkbox } from './Checkbox';
import { RadioGroup } from './RadioGroup';
import { DatePicker } from './DatePicker';

export default {
  title: 'Form Fields',
  parameters: { layout: 'padded' },
};

const selectOptions = [
  { value: 'nova', label: 'NOVA Token' },
  { value: 'xlm', label: 'XLM' },
  { value: 'usdc', label: 'USDC' },
];

const radioOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

// ─── TextInput ────────────────────────────────────────────────────────────────

export const TextInputDefault = () => <TextInput label="Wallet address" placeholder="G..." />;
TextInputDefault.storyName = 'TextInput / Default';

export const TextInputError = () => (
  <TextInput label="Amount" value="abc" error="Must be a positive number" />
);
TextInputError.storyName = 'TextInput / Error';

export const TextInputDisabled = () => (
  <TextInput label="Email" value="user@nova.app" disabled />
);
TextInputDisabled.storyName = 'TextInput / Disabled';

export const TextInputReadOnly = () => (
  <TextInput label="Token ID" value="NOVA-001" readOnly />
);
TextInputReadOnly.storyName = 'TextInput / ReadOnly';

export const TextInputWithHint = () => (
  <TextInput label="Username" hint="3–20 characters, letters and numbers only." placeholder="nova_user" />
);
TextInputWithHint.storyName = 'TextInput / With Hint';

// ─── Textarea ─────────────────────────────────────────────────────────────────

export const TextareaDefault = () => <Textarea label="Campaign description" placeholder="Describe your campaign…" />;
TextareaDefault.storyName = 'Textarea / Default';

export const TextareaError = () => (
  <Textarea label="Notes" value="x" error="Must be at least 10 characters" />
);
TextareaError.storyName = 'Textarea / Error';

export const TextareaDisabled = () => (
  <Textarea label="Terms" value="Read-only legal text." disabled />
);
TextareaDisabled.storyName = 'Textarea / Disabled';

export const TextareaReadOnly = () => (
  <Textarea label="Contract hash" value="0xabc…def" readOnly />
);
TextareaReadOnly.storyName = 'Textarea / ReadOnly';

// ─── FormSelect ───────────────────────────────────────────────────────────────

export const FormSelectDefault = () => (
  <FormSelect label="Asset" options={selectOptions} placeholder="Choose asset…" />
);
FormSelectDefault.storyName = 'FormSelect / Default';

export const FormSelectError = () => (
  <FormSelect label="Asset" options={selectOptions} value="" error="Please select an asset" />
);
FormSelectError.storyName = 'FormSelect / Error';

export const FormSelectDisabled = () => (
  <FormSelect label="Asset" options={selectOptions} value="nova" disabled />
);
FormSelectDisabled.storyName = 'FormSelect / Disabled';

export const FormSelectReadOnly = () => (
  <FormSelect label="Asset" options={selectOptions} value="xlm" readOnly />
);
FormSelectReadOnly.storyName = 'FormSelect / ReadOnly';

// ─── Checkbox ─────────────────────────────────────────────────────────────────

export const CheckboxDefault = () => <Checkbox label="I agree to the terms and conditions" />;
CheckboxDefault.storyName = 'Checkbox / Default';

export const CheckboxChecked = () => <Checkbox label="Receive notifications" defaultChecked />;
CheckboxChecked.storyName = 'Checkbox / Checked';

export const CheckboxError = () => (
  <Checkbox label="Agree to terms" error="You must accept the terms to continue" />
);
CheckboxError.storyName = 'Checkbox / Error';

export const CheckboxDisabled = () => (
  <Checkbox label="Feature unavailable" disabled />
);
CheckboxDisabled.storyName = 'Checkbox / Disabled';

export const CheckboxReadOnly = () => (
  <Checkbox label="Completed onboarding" defaultChecked readOnly />
);
CheckboxReadOnly.storyName = 'Checkbox / ReadOnly';

// ─── RadioGroup ───────────────────────────────────────────────────────────────

export const RadioGroupDefault = () => {
  const [val, setVal] = useState('weekly');
  return <RadioGroup legend="Payout frequency" name="freq" options={radioOptions} value={val} onChange={setVal} />;
};
RadioGroupDefault.storyName = 'RadioGroup / Default';

export const RadioGroupError = () => (
  <RadioGroup
    legend="Payout frequency"
    name="freq-err"
    options={radioOptions}
    value=""
    onChange={() => {}}
    error="Please select a frequency"
  />
);
RadioGroupError.storyName = 'RadioGroup / Error';

export const RadioGroupDisabled = () => (
  <RadioGroup
    legend="Payout frequency"
    name="freq-dis"
    options={radioOptions}
    value="daily"
    onChange={() => {}}
    disabled
  />
);
RadioGroupDisabled.storyName = 'RadioGroup / Disabled';

export const RadioGroupReadOnly = () => (
  <RadioGroup
    legend="Payout frequency"
    name="freq-ro"
    options={radioOptions}
    value="monthly"
    onChange={() => {}}
    readOnly
  />
);
RadioGroupReadOnly.storyName = 'RadioGroup / ReadOnly';

// ─── DatePicker ───────────────────────────────────────────────────────────────

export const DatePickerDefault = () => <DatePicker label="Start date" />;
DatePickerDefault.storyName = 'DatePicker / Default';

export const DatePickerError = () => (
  <DatePicker label="End date" error="End date must be after start date" />
);
DatePickerError.storyName = 'DatePicker / Error';

export const DatePickerDisabled = () => (
  <DatePicker label="Locked date" value="2025-01-01" disabled />
);
DatePickerDisabled.storyName = 'DatePicker / Disabled';

export const DatePickerReadOnly = () => (
  <DatePicker label="Created at" value="2025-06-01" readOnly />
);
DatePickerReadOnly.storyName = 'DatePicker / ReadOnly';

// ─── All States Gallery ───────────────────────────────────────────────────────

export const AllStatesGallery = () => {
  const [radio, setRadio] = useState('weekly');
  return (
    <div className="grid gap-8 max-w-lg">
      <TextInput label="TextInput (default)" placeholder="Enter value…" />
      <TextInput label="TextInput (error)" value="bad" error="Invalid value" />
      <TextInput label="TextInput (disabled)" value="disabled" disabled />
      <TextInput label="TextInput (readOnly)" value="read only" readOnly />

      <Textarea label="Textarea (default)" placeholder="Type here…" />
      <Textarea label="Textarea (error)" value="x" error="Too short" />
      <Textarea label="Textarea (disabled)" value="disabled" disabled />

      <FormSelect label="FormSelect (default)" options={selectOptions} placeholder="Choose…" />
      <FormSelect label="FormSelect (error)" options={selectOptions} value="" error="Required" />
      <FormSelect label="FormSelect (disabled)" options={selectOptions} value="nova" disabled />

      <Checkbox label="Checkbox (default)" />
      <Checkbox label="Checkbox (error)" error="Required" />
      <Checkbox label="Checkbox (disabled)" disabled />

      <RadioGroup legend="RadioGroup (default)" name="rg1" options={radioOptions} value={radio} onChange={setRadio} />
      <RadioGroup legend="RadioGroup (error)" name="rg2" options={radioOptions} value="" onChange={() => {}} error="Required" />
      <RadioGroup legend="RadioGroup (disabled)" name="rg3" options={radioOptions} value="daily" onChange={() => {}} disabled />

      <DatePicker label="DatePicker (default)" />
      <DatePicker label="DatePicker (error)" error="Invalid date" />
      <DatePicker label="DatePicker (disabled)" disabled />
    </div>
  );
};
AllStatesGallery.storyName = 'All Components / States Gallery';
