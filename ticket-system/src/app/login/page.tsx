"use client";
import React, { useState } from 'react';
import { login } from '@/app/actions/auth';

import { useLiff } from '@/components/LiffProvider';

export default function LoginPage() {
    const { profile, liff, isReady } = useLiff();
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

    const handleLiffLogin = () => {
        if (liff && !liff.isLoggedIn()) {
            liff.login();
        }
    };

    return (
        <main style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)', // Villa deep blue to dark shade
            padding: '1rem'
        }}>
            <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '3rem 2rem', textAlign: 'center' }}>
                <img
                    src="/logo.png"
                    alt="Villa Market"
                    style={{ width: '180px', marginBottom: '1.5rem', background: 'white', padding: '1rem', borderRadius: '15px' }}
                />

                {profile ? (
                    <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                        <img src={profile.pictureUrl} alt={profile.displayName} style={{ width: '50px', height: '50px', borderRadius: '50%', border: '2px solid #06C755' }} />
                        <div style={{ textAlign: 'left' }}>
                            <p style={{ color: '#1e3a8a', fontSize: '0.9rem', margin: 0, fontWeight: 'bold' }}>สวัสดีคุณ {profile.displayName}</p>
                            <p style={{ color: '#64748b', fontSize: '0.7rem', margin: 0 }}>เข้าใช้งานผ่าน LINE</p>
                        </div>
                    </div>
                ) : (
                    isReady && liff && !liff.isLoggedIn() && (
                        <button
                            onClick={handleLiffLogin}
                            style={{
                                width: '100%',
                                padding: '0.8rem',
                                borderRadius: '10px',
                                background: '#06C755',
                                color: '#fff',
                                border: 'none',
                                marginBottom: '2rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <span style={{ fontSize: '1.2rem' }}>LINE</span> เข้าสู่ระบบด้วย LINE
                        </button>
                    )
                )}

                <h1 style={{ color: '#1e3a8a', fontSize: '1.6rem', marginBottom: '0.5rem', fontWeight: '900' }}>Repair System</h1>
                <p style={{ color: '#64748b', marginBottom: '2rem', fontSize: '0.9rem', fontWeight: 'bold' }}>เข้าสู่ระบบด้วยรหัสสาขาของคุณ</p>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <div style={{ textAlign: 'left' }}>
                        <label style={{ color: '#1e3a8a', fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem', fontWeight: 'bold' }}>ชื่อผู้ใช้งาน (รหัสสาขา / admin)</label>
                        <input
                            type="text"
                            className="input-glass"
                            placeholder="เช่น 1024 หรือ admin"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={{ background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', fontWeight: 'bold' }}
                        />
                    </div>

                    <div style={{ textAlign: 'left' }}>
                        <label style={{ color: '#1e3a8a', fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem', fontWeight: 'bold' }}>รหัสผ่าน</label>
                        <input
                            type="password"
                            className="input-glass"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', fontWeight: 'bold', letterSpacing: '2px' }}
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

                <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'bold' }}>
                    © 2024 Villa Market JP Co., Ltd.
                </div>
            </div>
        </main>
    );
}
