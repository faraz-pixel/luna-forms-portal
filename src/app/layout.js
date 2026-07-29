import './globals.css';

export const metadata = {
  title: 'Luna Forms Portal',
  description: 'Custom forms management portal for Coffee Cartel',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // maximumScale/userScalable are deliberately not set — blocking pinch-zoom
  // fails WCAG 1.4.4 and makes the product tables unusable for anyone who
  // needs to magnify.
  themeColor: '#0a0e1a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>☕</text></svg>" />
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
