import '../styles/globals.css';

/** @type { import('@storybook/react').Preview } */
const preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      config: {},
      options: {
 feat/storybook-components-setup
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa'],
        },

        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
 main
      },
    },
  },
};

export default preview;
