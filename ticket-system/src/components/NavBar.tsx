"use client";
import Link from 'next/link';
import { logout } from '@/app/actions/auth';
import { useEffect, useState } from 'react';

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
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
            padding: '0.8rem 1rem'
        }}>
            <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1440px', margin: '0 auto' }}>
                <Link href="/" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>🏠</span>
                    <div style={{ lineHeight: '1.1' }}>
                        <div style={{ fontWeight: '800', fontSize: '0.9rem' }}>ระบบซ่อมบำรุง</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>Villa Market</div>
                    </div>
                </Link>
                <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>Logout</button>
            </div>
        </nav>
    );
}
