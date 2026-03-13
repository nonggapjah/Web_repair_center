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

function NavBar() {
  return (
    <nav className="navbar" id="main-nav">
      <div className="container flex justify-between items-center" style={{ padding: 0 }}>
        <span className="nav-brand">ระบบซ่อมบำรุง Villa Market</span>
      </div>
    </nav>
  )
}
