import { useTranslation } from 'next-i18next';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const languages = [
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'es', name: 'Español', dir: 'ltr' },
  { code: 'ar', name: 'العربية', dir: 'rtl' }
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation('common');
  const router = useRouter();
  const pathname = usePathname();
  const [currentLocale, setCurrentLocale] = useState(i18n.language || 'en');

  useEffect(() => {
    setCurrentLocale(i18n.language || 'en');
  }, [i18n.language]);

  const handleChange = (locale) => {
    const newPath = pathname.replace(`/${currentLocale}`, `/${locale}`) || `/${locale}${pathname}`;
    i18n.changeLanguage(locale);
    router.push(newPath);
    localStorage.setItem('preferredLocale', locale);
    document.documentElement.dir = languages.find(l => l.code === locale)?.dir || 'ltr';
  };

  return (
    <select 
      value={currentLocale} 
      onChange={(e) => handleChange(e.target.value)}
      className="language-select"
      style={{ padding: '0.4rem', borderRadius: '4px' }}
    >
      {languages.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.name}
        </option>
      ))}
    </select>
  );
}

