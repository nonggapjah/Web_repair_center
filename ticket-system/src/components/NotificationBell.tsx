"use client";
import React, { useState, useEffect, useRef } from 'react';
import { getSession } from '@/app/actions/auth';
import { getUserNotifications, markNotificationRead } from '@/app/actions/tickets';

export function NotificationBell() {
    const [notifs, setNotifs] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [user, setUser] = useState<any>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const init = async () => {
            const session = await getSession();
            if (session) {
                setUser(session);
                const data = await getUserNotifications(session.branchId, session.role);
                setNotifs(data);
            }
        };
        init();
        const interval = setInterval(init, 30000); // refresh every 30s
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    if (!user) return null;

    const unreadCount = notifs.filter(n => !n.IsRead).length;

    const handleRead = async (notif: any) => {
        if (!notif.IsRead) {
            await markNotificationRead(notif.NotifID);
            setNotifs(notifs.map(n => n.NotifID === notif.NotifID ? { ...n, IsRead: true } : n));
        }
    };

    return (
        <div style={{ position: 'relative' }} ref={popupRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative', fontSize: '1.4rem', padding: '0.4rem', display: 'flex', alignItems: 'center' }}
            >
                🔔
                {unreadCount > 0 && (
                    <span style={{ position: 'absolute', top: 0, right: 0, background: '#ef4444', color: 'white', borderRadius: '50%', minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 'bold' }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div style={{ position: 'absolute', right: 0, top: '45px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '15px', width: '320px', maxHeight: '420px', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', zIndex: 99999 }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', position: 'sticky', top: 0, fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', color: '#1e293b' }}>
                        <span>การแจ้งเตือน</span>
                        <button onClick={() => setIsOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b' }}>×</button>
                    </div>
                    {notifs.length === 0 ? (
                        <div style={{ padding: '2rem 1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>ไม่มีการแจ้งเตือน</div>
                    ) : (
                        notifs.map(n => (
                            <div key={n.NotifID} onClick={() => handleRead(n)} style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', background: n.IsRead ? '#fff' : '#f0f9ff', cursor: 'pointer', transition: 'background 0.2s', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: '800', color: n.IsRead ? '#475569' : '#1e40af' }}>{n.Title} {!n.IsRead && <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%', marginLeft: '5px' }} />}</div>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: '1.4' }}>{n.Message}</div>
                                <div style={{ fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', marginTop: '0.2rem' }}>{new Date(n.CreatedAt).toLocaleString('th-TH')}</div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
