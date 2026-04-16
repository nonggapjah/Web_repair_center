"use client";
import Link from 'next/link';
import { logout } from '@/app/actions/auth';
import { useEffect, useState } from 'react';

import { NotificationBell } from './NotificationBell';

export function NavBar() {
    const [showHeader, setShowHeader] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY > lastScrollY && currentScrollY > 80) {
                setShowHeader(false); // Scrolling down
            } else {
                setShowHeader(true); // Scrolling up
            }
            setLastScrollY(currentScrollY);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    const handleLogout = async () => {
        await logout();
        window.location.href = '/login';
    };

    return (
        <nav className="navbar" style={{
            position: 'fixed',
            width: '100%',
            top: showHeader ? '0' : '-100px',
            transition: 'top 0.3s ease-in-out',
            zIndex: 1000,
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            padding: '0 1rem',
            height: '70px',
            display: 'flex',
            alignItems: 'center'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
                <Link href="/" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>🏠</span>
                    <div style={{ lineHeight: '1.1' }}>
                        <div style={{ fontWeight: '800', fontSize: '0.9rem' }}>ระบบซ่อมบำรุง</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>Villa Market</div>
                    </div>
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <NotificationBell />
                    <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>Logout</button>
                </div>
            </div>
        </nav>
    );
}
