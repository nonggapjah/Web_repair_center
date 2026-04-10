import type { Metadata } from 'next'
import './globals.css'
import { LiffProvider } from '@/components/LiffProvider';
import { NavBar } from '@/components/NavBar';

export const metadata: Metadata = {
  title: 'Villa Market - ระบบแจ้งซ่อมบำรุง',
  description: 'ระบบจัดการงานซ่อมและดูแลอาคาร วิลล่า มาร์เก็ท',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <LiffProvider>
          <NavBar />
          {children}
        </LiffProvider>
      </body>
    </html>
  )
}
