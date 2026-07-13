import {getRequestConfig} from 'next-intl/server';
import {cookies, headers} from 'next/headers';

export default getRequestConfig(async () => {
  // Determine locale from cookie or header, defaulting to 'zh-CN'
  const cookieStore = await cookies();
  let locale = cookieStore.get('NEXT_LOCALE')?.value;

  if (!locale) {
    const headersList = await headers();
    const acceptLanguage = headersList.get('accept-language');
    if (acceptLanguage && acceptLanguage.includes('en')) {
      locale = 'en-US';
    } else {
      locale = 'zh-CN';
    }
  }

  // Ensure locale is one of the supported ones
  if (locale !== 'en-US' && locale !== 'zh-CN') {
    locale = 'zh-CN';
  }

  // Load the corresponding messages
  let messages = {};
  try {
    if (locale === 'en-US') {
      messages = (await import('./locales/en-US.json')).default;
    } else {
      messages = (await import('./locales/zh-CN.json')).default;
    }
  } catch (error) {
    console.warn(`Failed to load messages for locale ${locale}`);
    messages = (await import('./locales/zh-CN.json')).default;
  }

  return {
    locale,
    messages
  };
});
