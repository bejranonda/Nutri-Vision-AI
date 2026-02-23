import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  // A list of all locales that are supported
  locales: ['en', 'th', 'de', 'da'],

  // Used when no locale matches
  defaultLocale: 'th'
});

export const config = {
  // Match only internationalized pathnames
  matcher: ['/', '/(th|en|de|da)/:path*']
};
