import Link from 'next/link';

export default function Home() {
  return (
    <main className="container animate-fade-in" style={{
      marginTop: '10vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '80vh'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <img
          src="https://www.villamarket.com/static/media/villa-logo.5d120fb3.png"
          alt="Villa Market"
          style={{ width: '220px', marginBottom: '2rem' }}
        />
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem', color: 'var(--accent-primary)' }}>Maintenance System</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>
          ระบบศูนย์แจ้งซ่อมบำรุง วิลล่า มาร์เก็ท
        </p>
      </div>

      <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center' }} className="flex-mobile-col w-full px-4">
        <Link href="/login" style={{ textDecoration: 'none', flex: 1, maxWidth: '350px' }}>
          <div className="glass-panel" style={{ height: '100%', textAlign: 'center', cursor: 'pointer', padding: '2.5rem' }}>
            <h2 style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }}>พนักงานสาขา</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', minHeight: '3em' }}>แจ้งซ่อมอุปกรณ์ และติดตามสถานะงานของสาขาคุณ</p>
            <div style={{ marginTop: '2rem' }}>
              <span className="btn-primary" style={{ display: 'inline-block', width: '100%' }}>เข้าสู่ระบบ</span>
            </div>
          </div>
        </Link>

        <Link href="/login" style={{ textDecoration: 'none', flex: 1, maxWidth: '350px' }}>
          <div className="glass-panel" style={{ height: '100%', textAlign: 'center', cursor: 'pointer', padding: '2.5rem' }}>
            <h2 style={{ color: 'var(--accent-warning)', marginBottom: '1rem' }}>แอดมิน / ทีมช่าง</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', minHeight: '3em' }}>จัดการงานซ่อม, มอบหมายงาน และอัปเดตงานทั่วประเทศ</p>
            <div style={{ marginTop: '2rem' }}>
              <span className="btn-primary" style={{ display: 'inline-block', width: '100%', background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>เข้าสู่ระบบ Admin</span>
            </div>
          </div>
        </Link>
      </div>

      <footer style={{ marginTop: 'auto', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        © 2024 Villa Market JP Co., Ltd. Maintenance Department
      </footer>
    </main>
  );
}
