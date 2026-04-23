import Badge from './Badge';

export default {
  title: 'UI/Badge',
  component: Badge,
  argTypes: { variant: { control: 'select', options: ['success', 'warning', 'error', 'info'] } },
};

const T = (args) => <Badge {...args}>{args.variant}</Badge>;

export const Success = T.bind({});
Success.args = { variant: 'success' };

export const Warning = T.bind({});
Warning.args = { variant: 'warning' };

export const Error = T.bind({});
Error.args = { variant: 'error' };

export const Info = T.bind({});
Info.args = { variant: 'info' };
