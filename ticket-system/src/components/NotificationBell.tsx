"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/app/actions/auth';
import { getUserNotifications, markNotificationRead, markAllNotificationsRead } from '@/app/actions/tickets';

const playNotificationSound = () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
        osc.stop(ctx.currentTime + 0.5);
    } catch (e) { }
};

export function NotificationBell() {
    const router = useRouter();
    const [notifs, setNotifs] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [user, setUser] = useState<any>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const isFirstLoad = useRef(true);

    useEffect(() => {
        let prevUnreadCount = 0;
        const init = async () => {
            const session = await getSession();
            if (session) {
                setUser(session);
                const data = await getUserNotifications(session.branchId, session.role, Date.now());
                setNotifs(data);

                const currentUnread = data.filter((n: any) => !n.IsRead).length;
                if (!isFirstLoad.current && currentUnread > prevUnreadCount) {
                    playNotificationSound();
                }
                prevUnreadCount = currentUnread;
                isFirstLoad.current = false;
            }
        };
        init();
        const interval = setInterval(init, 5000); // refresh every 5s
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

    const handleReadClick = async (notif: any) => {
        if (!notif.IsRead) {
            await markNotificationRead(notif.NotifID);
            setNotifs(notifs.map(n => n.NotifID === notif.NotifID ? { ...n, IsRead: true } : n));
        }
        setIsOpen(false);
        if (notif.TicketID) {
            window.dispatchEvent(new CustomEvent('OPEN_TICKET', { detail: { ticketId: notif.TicketID } }));
        }
    };

    const handleClearAll = async () => {
        if (!user) return;
        await markAllNotificationsRead(user.branchId, user.role);
        setNotifs(notifs.map(n => ({ ...n, IsRead: true })));
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
                    <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', position: 'sticky', top: 0, fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#1e293b', zIndex: 2 }}>
                        <span>การแจ้งเตือน</span>
                        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                            {unreadCount > 0 && <button onClick={handleClearAll} style={{ fontSize: '0.75rem', color: '#3b82f6', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: '800' }}>ล้างทั้งหมด</button>}
                            <button onClick={() => setIsOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b' }}>×</button>
                        </div>
                    </div>
                    {notifs.length === 0 ? (
                        <div style={{ padding: '2rem 1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>ไม่มีการแจ้งเตือน</div>
                    ) : (
                        notifs.map(n => (
                            <div key={n.NotifID} onClick={() => handleReadClick(n)} style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', background: n.IsRead ? '#fff' : '#f0f9ff', cursor: 'pointer', transition: 'background 0.2s', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
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
