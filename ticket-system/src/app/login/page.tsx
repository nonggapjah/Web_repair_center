"use client";
import React, { useState } from 'react';
import { login } from '@/app/actions/auth';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password) {
            setError('กรุณาระบุชื่อผู้ใช้งานและรหัสผ่าน');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const result = await login(username, password);
            if (result.success && result.redirect) {
                window.location.href = result.redirect;
            } else {
                setError(result.error || 'Login failed');
            }
        } catch (err) {
            setError('System error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            padding: '1rem'
        }}>
            <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '3rem 2rem', textAlign: 'center' }}>
                <img
                    src="https://www.villamarket.com/static/media/villa-logo.5d120fb3.png"
                    alt="Villa Market"
                    style={{ width: '180px', marginBottom: '2rem' }}
                />

                <h1 style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Repair System</h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>เข้าสู่ระบบด้วยรหัสสาขาของคุณ</p>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <div style={{ textAlign: 'left' }}>
                        <label style={{ color: '#fff', fontSize: '0.8rem', display: 'block', marginBottom: '0.4rem' }}>ชื่อผู้ใช้งาน (รหัสสาขา / admin)</label>
                        <input
                            type="text"
                            className="input-glass"
                            placeholder="เช่น 1024 หรือ admin"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }}
                        />
                    </div>

                    <div style={{ textAlign: 'left' }}>
                        <label style={{ color: '#fff', fontSize: '0.8rem', display: 'block', marginBottom: '0.4rem' }}>รหัสผ่าน</label>
                        <input
                            type="password"
                            className="input-glass"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }}
                        />
                    </div>

                    {error && <p style={{ color: 'var(--accent-danger)', fontSize: '0.85rem' }}>{error}</p>}

                    <button
                        type="submit"
                        className="btn-primary"
                        style={{ padding: '0.8rem', fontSize: '1rem', marginTop: '1rem' }}
                        disabled={isLoading}
                    >
                        {isLoading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
                    </button>
                </form>

                <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <p style={{ fontWeight: 'bold', color: '#fff', marginBottom: '0.4rem' }}>คู่มือการเข้าใช้งาน:</p>
                    <p>• Admin: admin / Villa@2026</p>
                    <p>• สาขา: รหัสสาขา / villa@รหัสสาขา (เช่น 1024 / villa@1024)</p>
                    <p style={{ marginTop: '0.4rem', color: 'var(--accent-warning)' }}>* ระบบจะสร้าง User สาขาให้อัตโนมัติเมื่อ Log-in ครั้งแรก</p>
                </div>
            </div>
        </main>
    );
}
