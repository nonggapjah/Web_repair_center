import type { Metadata } from 'next'
import './globals.css'

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
        <NavBar />
        {children}
      </body>
    </html>
  )
}

import Link from 'next/link';
import { logout } from '@/app/actions/auth';

function NavBar() {
  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <nav className="navbar" id="main-nav">
      <div className="container flex justify-between items-center" style={{ padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link href="/" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🏠</span>
            <span style={{ fontWeight: 'bold' }}>หน้าหลัก</span>
          </Link>
          <span className="nav-brand">ระบบซ่อมบำรุง Villa Market</span>
        </div>
      </div>
    </nav>
  )
}
