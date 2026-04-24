import Link from 'next/link';

export default function Home() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)', // Premium Villa Dark Blue
      position: 'relative',
      overflow: 'hidden'
    }}>

      {/* Decorative Background Elements */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40%', height: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%)', zIndex: 0, borderRadius: '50%' }}></div>
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '60%', height: '60%', background: 'radial-gradient(circle, rgba(220,38,38,0.1) 0%, rgba(0,0,0,0) 70%)', zIndex: 0, borderRadius: '50%' }}></div>

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', marginBottom: '4rem', marginTop: '2rem' }} className="animate-fade-in">
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '25px', display: 'inline-block', marginBottom: '2rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}>
          <img
            src="/logo.png"
            alt="Villa Market Logo"
            style={{ width: '180px', display: 'block' }}
          />
        </div>
        <h1 style={{ fontSize: '3rem', marginBottom: '0.8rem', color: '#ffffff', fontWeight: '900', letterSpacing: '1px' }}>Maintenance System</h1>
        <p style={{ color: '#94a3b8', fontSize: '1.2rem', fontWeight: 'bold' }}>
          ระบบศูนย์แจ้งซ่อมบำรุง วิลล่า มาร์เก็ท
        </p>
      </div>

      <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', position: 'relative', zIndex: 1, flexWrap: 'wrap', width: '100%', maxWidth: '900px', padding: '0 1rem' }}>

        {/* Branch Card */}
        <Link href="/login" style={{ textDecoration: 'none', flex: '1 1 300px', maxWidth: '400px' }}>
          <div style={{
            height: '100%', textAlign: 'center', cursor: 'pointer', padding: '3rem 2.5rem',
            background: 'rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(16px)',
            borderRadius: '24px', border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            transition: 'transform 0.3s ease, background 0.3s ease'
          }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-10px)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏪</div>
            <h2 style={{ color: '#ffffff', marginBottom: '1rem', fontSize: '1.6rem', fontWeight: '800' }}>พนักงานสาขา</h2>
            <p style={{ color: '#cbd5e1', fontSize: '1rem', minHeight: '3em', lineHeight: '1.6' }}>แจ้งซ่อมอุปกรณ์ และติดตามสถานะงานของสาขาคุณแบบเรียลไทม์</p>
            <div style={{ marginTop: '2rem' }}>
              <span style={{
                display: 'inline-block', width: '100%', background: '#3b82f6', color: '#fff',
                padding: '1rem', borderRadius: '12px', fontWeight: '800', fontSize: '1.1rem',
                boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)'
              }}>เข้าสู่ระบบด้วยรหัสสาขา</span>
            </div>
          </div>
        </Link>

        {/* Admin Card */}
        <Link href="/login" style={{ textDecoration: 'none', flex: '1 1 300px', maxWidth: '400px' }}>
          <div style={{
            height: '100%', textAlign: 'center', cursor: 'pointer', padding: '3rem 2.5rem',
            background: 'rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(16px)',
            borderRadius: '24px', border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            transition: 'transform 0.3s ease, background 0.3s ease'
          }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-10px)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛠️</div>
            <h2 style={{ color: '#fcd34d', marginBottom: '1rem', fontSize: '1.6rem', fontWeight: '800' }}>แอดมิน / ทีมช่าง</h2>
            <p style={{ color: '#cbd5e1', fontSize: '1rem', minHeight: '3em', lineHeight: '1.6' }}>จัดการงานซ่อม, มอบหมายงาน และอัปเดตงานทั่วประเทศ</p>
            <div style={{ marginTop: '2rem' }}>
              <span style={{
                display: 'inline-block', width: '100%', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff',
                padding: '1rem', borderRadius: '12px', fontWeight: '800', fontSize: '1.1rem',
                boxShadow: '0 4px 14px 0 rgba(245, 158, 11, 0.39)'
              }}>เข้าสู่ระบบ Admin</span>
            </div>
          </div>
        </Link>
      </div>

      <footer style={{ position: 'absolute', bottom: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem', fontWeight: 'bold' }}>
        © 2024 Villa Market JP Co., Ltd. Maintenance Department
      </footer>
    </main>
  );
}
