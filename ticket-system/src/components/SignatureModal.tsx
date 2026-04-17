"use client";
import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';

interface SignatureModalProps {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    onConfirm: (signatureBase64: string) => void;
}

export function SignatureModal({ isOpen, title, onClose, onConfirm }: SignatureModalProps) {
    const sigPad = useRef<SignatureCanvas>(null);

    if (!isOpen) return null;

    const handleClear = () => {
        sigPad.current?.clear();
    };

    const handleConfirm = () => {
        if (sigPad.current?.isEmpty()) {
            alert('กรุณาเซ็นชื่อก่อนกดยืนยัน');
            return;
        }
        const dataUrl = sigPad.current?.getTrimmedCanvas().toDataURL('image/png');
        if (dataUrl) {
            onConfirm(dataUrl);
        }
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
            <div style={{ background: 'white', padding: '2rem', borderRadius: '15px', width: '90%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                <h3 style={{ marginTop: 0, fontSize: '1.25rem', color: '#1e293b', marginBottom: '1rem' }}>{title}</h3>

                <div style={{ border: '2px dashed #cbd5e1', borderRadius: '10px', background: '#f8fafc', marginBottom: '1rem' }}>
                    <SignatureCanvas
                        ref={sigPad}
                        penColor="black"
                        canvasProps={{ width: 500, height: 200, className: 'sigCanvas', style: { width: '100%', height: '200px', cursor: 'crosshair', borderRadius: '10px' } }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <button onClick={handleClear} style={{ padding: '0.75rem 1.5rem', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>ล้างลายเซ็น</button>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={onClose} style={{ padding: '0.75rem 1.5rem', background: 'transparent', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>ยกเลิก</button>
                        <button onClick={handleConfirm} style={{ padding: '0.75rem 1.5rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>ยืนยันลายเซ็น</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
