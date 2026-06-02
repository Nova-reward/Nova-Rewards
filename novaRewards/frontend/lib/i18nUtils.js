import { useTranslation } from 'next-i18next';
import { DateTime } from 'luxon';

export function useDateFormatter() {
  const { i18n } = useTranslation();
  const locale = i18n.language || 'en';

  const formatDate = (dateString, format = 'medium') => {
    const date = DateTime.fromISO(dateString);
    return date.setLocale(locale).toLocaleString(DateTime[format + 'DateTime']);
  };

  const formatCurrency = (amount, currency = 'NOVA') => {
    const locale = i18n.language || 'en';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2
    }).format(amount);
  };

  return { formatDate, formatCurrency };
}

// Global date formatter for non-component use
export function formatDateGlobal(dateString, locale = 'en', format = 'medium') {
  const date = DateTime.fromISO(dateString);
  return date.setLocale(locale).toLocaleString(DateTime[format + 'DateTime']);
}

