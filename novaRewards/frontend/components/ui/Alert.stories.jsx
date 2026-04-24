import { Alert, AlertTitle, AlertDescription } from './Alert';

export default {
  title: 'UI/Alert',
  component: Alert,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'destructive', 'success'],
    },
  },
};

const Template = (args) => (
  <Alert {...args}>
    <AlertTitle>Alert Title</AlertTitle>
    <AlertDescription>This is the alert description with more detail.</AlertDescription>
  </Alert>
);

export const Default = Template.bind({});
Default.args = { variant: 'default' };

export const Destructive = Template.bind({});
Destructive.args = { variant: 'destructive' };
Destructive.storyName = 'Error / Destructive';

export const Success = Template.bind({});
Success.args = { variant: 'success' };

export const TitleOnly = (args) => (
  <Alert {...args}>
    <AlertTitle>Title only alert</AlertTitle>
  </Alert>
);
TitleOnly.args = { variant: 'default' };

export const DescriptionOnly = (args) => (
  <Alert {...args}>
    <AlertDescription>Description only, no title.</AlertDescription>
  </Alert>
);
DescriptionOnly.args = { variant: 'default' };

export const AllVariants = () => (
  <div className="flex flex-col gap-3 w-96">
    <Alert variant="default">
      <AlertTitle>Info</AlertTitle>
      <AlertDescription>This is an informational alert.</AlertDescription>
    </Alert>
    <Alert variant="success">
      <AlertTitle>Success</AlertTitle>
      <AlertDescription>Your changes have been saved.</AlertDescription>
    </Alert>
    <Alert variant="destructive">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>Something went wrong. Please try again.</AlertDescription>
    </Alert>
  </div>
);
