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
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      },
    },
  },
};

export default preview;
