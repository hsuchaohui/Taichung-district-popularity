import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '臺中商圈熱門指數｜研究展示雛形',
  description: '以政府資料建構可解釋的臺中商圈熱門指數研究展示網站',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
