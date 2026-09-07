import type { Metadata } from 'next';
import { Outfit, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { I18nProvider } from '../components/I18nProvider';
import { db } from '../lib/db';

// Outfit 设计师英文字体做大标题与强调字
const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
});

// Plus Jakarta Sans 做舒适的可读性正文字体
const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

async function getBrand() {
  try {
    const setting = await db.systemSetting.findUnique({
      where: { configName: 'site_brand' },
    });
    if (setting?.configValue) {
      const parsed = JSON.parse(setting.configValue);
      return { name: parsed?.name || '', icon: parsed?.icon || '' };
    }
  } catch (e) {}
  return { name: '', icon: '' };
}

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return {
    title: brand.name || '布吉岛导航',
    description: '基于 Next.js 与 SQLite 重构的高性能、极速响应、优雅拟态导航面板',
    icons: {
      icon: brand.icon || '/logo.svg',
    },
    referrer: 'same-origin',
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh"
      className={`${outfit.variable} ${plusJakartaSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var saved = localStorage.getItem('bujic-theme');
                if (saved && saved !== 'blueprint') {
                  document.documentElement.setAttribute('data-theme', saved);
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
