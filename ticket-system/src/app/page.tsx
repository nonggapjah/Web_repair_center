import Link from 'next/link';

export default function Home() {
  return (
    <main className="container animate-fade-in" style={{ marginTop: '10vh' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>ศูนย์แจ้งซ่อมบำรุง วิลล่า มาร์เก็ท</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>
          กรุณาเลือกประเภทการใช้งานเพื่อดำเนินการต่อ
        </p>
      </div>

      <div className="flex justify-center gap-6 flex-mobile-col">
        <Link href="/user/dashboard" style={{ textDecoration: 'none' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '320px', textAlign: 'center', cursor: 'pointer' }}>
            <h2 style={{ color: 'var(--accent-primary)' }}>พนักงานประจำสาขา</h2>
            <p style={{ color: 'var(--text-muted)' }}>แจ้งซ่อมอุปกรณ์, ติดตามสถานะงานซ่อม และประเมินความพึงพอใจ</p>
            <div className="mt-6">
              <span className="btn-primary" style={{ display: 'inline-block' }}>เข้าสู่ระบบสาขา</span>
            </div>
          </div>
        </Link>

        <Link href="/admin/dashboard" style={{ textDecoration: 'none' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '320px', textAlign: 'center', cursor: 'pointer' }}>
            <h2 style={{ color: 'var(--accent-warning)' }}>แอดมิน / ทีมช่าง</h2>
            <p style={{ color: 'var(--text-muted)' }}>จัดการรายการแจ้งซ่อม, มอบหมายงาน และอัปเดตสถานะงานซ่อม</p>
            <div className="mt-6">
              <span className="btn-primary" style={{ display: 'inline-block', background: 'linear-gradient(135deg, var(--accent-warning), #d97706)' }}>เข้าสู่ระบบทีมช่าง</span>
            </div>
          </div>
        </Link>
      </div>
    </main>
  );
}

