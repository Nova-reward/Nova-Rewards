module.exports = {
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es', 'ar'],
    localePath: './public/locales',
    reloadOnPrerender: process.env.NODE_ENV === 'development'
  },
  fallbackLng: 'en',
  saveMissing: process.env.NODE_ENV !== 'production',
  debug: process.env.NODE_ENV === 'development',
  interpolation: {
    escapeValue: false // React already escapes
  },
  react: {
    useSuspense: false
  }
};

