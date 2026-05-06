'use client';
import React, { useState, useEffect } from 'react';

export default function HeicViewerModal({ url, onClose }: { url: string, onClose: () => void }) {
    const [imgData, setImgData] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const processHeic = async () => {
            try {
                // Fetch the HEIC file via proxy to bypass CORS
                const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error('Failed to fetch HEIC file via proxy');
                const blob = await response.blob();

                // Convert using heic2any
                const heic2any = (await import('heic2any')).default;
                const convertedBlob = await heic2any({ blob, toType: 'image/jpeg', quality: 0.8 });
                const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

                if (isMounted) {
                    const objectUrl = URL.createObjectURL(finalBlob);
                    setImgData(objectUrl);
                    setLoading(false);
                }
            } catch (err) {
                console.error("Failed to convert HEIC to JPG", err);
                if (isMounted) {
                    setError(true);
                    setLoading(false);
                }
            }
        };

        processHeic();

        return () => {
            isMounted = false;
        };
    }, [url]);

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '2rem' }} onClick={onClose}>
            <div style={{ background: '#fff', padding: '2rem', borderRadius: '25px', maxWidth: '800px', width: '100%', position: 'relative', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '20px', background: '#f1f5f9', border: 'none', width: '40px', height: '40px', borderRadius: '50%', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>×</button>
                <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontWeight: '900', color: '#1e293b' }}>🖼️ โปรแกรมแปลงรูปภาพ HEIC</h3>
                
                {loading && (
                    <div style={{ padding: '4rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '50px', height: '50px', border: '5px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                        <p style={{ color: '#64748b', fontWeight: '800' }}>กำลังประมวลผลแปลงไฟล์ให้อ่านได้...</p>
                    </div>
                )}

                {error && (
                    <div style={{ padding: '2rem', background: '#fef2f2', borderRadius: '15px', border: '1px solid #fca5a5' }}>
                        <p style={{ color: '#991b1b', fontWeight: '800', margin: 0 }}>❌ ไม่สามารถแปลงไฟล์ได้ อาจเป็นไฟล์วิดีโอ หรือไฟล์เสีย</p>
                        <button onClick={() => window.open(url, '_blank')} style={{ marginTop: '1rem', padding: '0.6rem 1.2rem', background: '#ef4444', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '800' }}>โหลดไฟล์ต้นฉบับแทน</button>
                    </div>
                )}

                {imgData && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                        <img src={imgData} alt="Converted HEIC" style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: '15px', border: '2px solid #e2e8f0' }} />
                        <a href={imgData} download={`converted_${Date.now()}.jpg`} style={{ textDecoration: 'none', padding: '0.8rem 2rem', background: '#3b82f6', color: '#fff', borderRadius: '12px', fontWeight: '900', fontSize: '1rem', display: 'inline-block', boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)' }}>
                            📥 ดาวน์โหลดเป็น JPG
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
