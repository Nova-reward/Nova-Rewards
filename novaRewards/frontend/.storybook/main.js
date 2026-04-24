/** @type { import('@storybook/nextjs').StorybookConfig } */
const config = {
 feat/storybook-components-setup
  stories: ['../components/**/*.stories.@(js|jsx|ts|tsx)', '../stories/**/*.stories.@(js|jsx|ts|tsx)'],

  stories: ['../components/**/*.stories.@(js|jsx|ts|tsx)'],
 main
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
};

module.exports = config;
