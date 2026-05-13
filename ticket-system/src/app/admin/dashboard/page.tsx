"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
    getAllTickets,
    updateTicketStatus,
    addTicketComment,
    updateTicketCategory,
    updateTicketSupplier
} from '@/app/actions/tickets';
import { supabase } from '@/lib/supabase';
import { SignatureModal } from '@/components/SignatureModal';
import HeicViewerModal from '@/components/HeicViewerModal';
// Phase 2B (12-05-2026): canonical lists moved to @/lib so dashboard, technician
// portal, and any future surface stay in sync. ARC-11..15 wire-up follows.
import { TICKET_STATUSES, ADMIN_SELECTABLE_STATUSES, STATUS_TH, STATUS_COLOR } from '@/lib/statuses';
import { TECHNICIANS } from '@/lib/technicians';
import { JOB_CATEGORIES } from '@/lib/jobCategories';
import { SUPPLIERS, OTHER_SUPPLIER_SENTINEL, requiresSupplier } from '@/lib/suppliers';

const statuses = TICKET_STATUSES;
const adminSelectableStatuses = ADMIN_SELECTABLE_STATUSES;
const technicians = TECHNICIANS;

const translateStatus = (status: string) => STATUS_TH[status as keyof typeof STATUS_TH] ?? status;
const statusColor = (status: string) => STATUS_COLOR[status as keyof typeof STATUS_COLOR] ?? '#64748b';

// ARC-14: derive technician names from the join table (preferred) and fall back to
// the legacy comma-joined Technician string for any ticket that hasn't been re-saved
// since MON-13 dual-write went live. Empty string + "ทีมช่างรับเหมา" are filtered
// because the contractor sentinel is a JobCategory signal, not a person.
const getTicketTechs = (t: any): string[] => {
    const fromRelation = Array.isArray(t?.Technicians)
        ? t.Technicians.map((tt: any) => tt.TechnicianName).filter((n: string) => !!n && n !== 'ทีมช่างรับเหมา')
        : [];
    if (fromRelation.length > 0) return fromRelation;
    const legacy: string = typeof t?.Technician === 'string' ? t.Technician : '';
    return legacy.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0 && s !== 'ทีมช่างรับเหมา');
};
const formatTechs = (t: any): string => {
    const techs = getTicketTechs(t);
    return techs.length > 0 ? techs.join(', ') : '-';
};

export default function AdminDashboard() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'list' | 'overview'>('overview');
    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
    const [techNote, setTechNote] = useState('');
    // ARC-14 (12-05-2026): selectedTechs replaces single selectedTech. The save flow
    // calls assignTechnicians() with the full array; updateTicketStatus dual-writes
    // a comma-joined string for the legacy column.
    const [selectedTechs, setSelectedTechs] = useState<string[]>([]);
    const [actualDate, setActualDate] = useState('');
    const [pendingStatus, setPendingStatus] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [showSignPad, setShowSignPad] = useState(false);
    const [heicUrlToView, setHeicUrlToView] = useState<string | null>(null);
    // ARC-12 (12-05-2026): inline JobCategory editor state (admin only).
    const [pendingJobCategory, setPendingJobCategory] = useState<string>('');
    const [isSavingCategory, setIsSavingCategory] = useState(false);
    // ARC-15 (12-05-2026): conditional Supplier dropdown state.
    // pendingSupplier holds either a known SUPPLIERS value or the sentinel "อื่นๆ".
    // customSupplier holds the free-text input shown when sentinel is selected.
    const [pendingSupplier, setPendingSupplier] = useState<string>('');
    const [customSupplier, setCustomSupplier] = useState<string>('');
    const [isSavingSupplier, setIsSavingSupplier] = useState(false);
    // ARC-11 (12-05-2026): wrong-category confirm modal toggle.
    const [showWrongCategoryConfirm, setShowWrongCategoryConfirm] = useState(false);
    const [isMarkingWrongCategory, setIsMarkingWrongCategory] = useState(false);

    // Timeline/Chat states
    const [replyMessage, setReplyMessage] = useState('');
    const [replyFiles, setReplyFiles] = useState<File[]>([]);
    const [isReplying, setIsReplying] = useState(false);

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterSymptom, setFilterSymptom] = useState('');
    const [filterBranch, setFilterBranch] = useState('');
    const [filterTechnician, setFilterTechnician] = useState('');
    const [filterJobCategory, setFilterJobCategory] = useState(''); // ARC-12 filter
    const [searchQuery, setSearchQuery] = useState('');
    // ARC-11: WrongCategory tickets are hidden by default; toggle reveals them.
    const [showWrongCategory, setShowWrongCategory] = useState(false);

    const getSLAColor = (ticket: any) => {
        if (ticket.CurrentStatus === 'Completed' || ticket.CurrentStatus === 'Closed') {
            return '#10b981'; // Green
        }

        const lastUpdate = ticket.History && ticket.History.length > 0
            ? new Date(ticket.History[0].Timestamp)
            : new Date(ticket.CreatedAt);

        const now = new Date();
        const diffDays = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 3600 * 24));

        if (diffDays > 7) return '#ef4444'; // Red
        if (diffDays > 3) return '#f59e0b'; // Yellow
        return null; // None
    };

    const getLastUpdateInfo = (ticket: any) => {
        const history = ticket.History?.[0];
        const comment = ticket.Comments?.[0];

        let last: { date: Date, msg: string } | null = null;
        if (history && comment) {
            last = new Date(history.Timestamp) > new Date(comment.Timestamp) 
                ? { date: new Date(history.Timestamp), msg: history.Note || `อัปเดตสถานะ: ${translateStatus(history.Status)}` } 
                : { date: new Date(comment.Timestamp), msg: comment.Message || 'แนบรูปภาพ' };
        } else if (history) {
            last = { date: new Date(history.Timestamp), msg: history.Note || `อัปเดตสถานะ: ${translateStatus(history.Status)}` };
        } else if (comment) {
            last = { date: new Date(comment.Timestamp), msg: comment.Message || 'แนบรูปภาพ' };
        }
        return last;
    };

    const fetchTickets = async (isInitial = false) => {
        if (isInitial) setIsLoading(true);
        try {
            const data = await getAllTickets(Date.now());
            // Only update state if data length or content actually changed (simplified check)
            setTickets(data);
        } catch (error) {
            console.error("Fetch error:", error);
        } finally {
            if (isInitial) setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets(true);
        const interval = setInterval(() => fetchTickets(false), 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleOpenTicket = (e: any) => {
            const tkId = e.detail?.ticketId;
            if (tkId) {
                const tk = tickets.find((t: any) => t.TicketID === tkId);
                if (tk) setSelectedTicket(tk);
            }
        };
        window.addEventListener('OPEN_TICKET', handleOpenTicket);
        return () => window.removeEventListener('OPEN_TICKET', handleOpenTicket);
    }, [tickets]);

    // Keep currently opened ticket modal synced with live data
    useEffect(() => {
        if (selectedTicket && tickets.length > 0) {
            const freshTk = tickets.find(t => t.TicketID === selectedTicket.TicketID);
            if (freshTk) {
                if (freshTk.Comments?.length !== selectedTicket.Comments?.length ||
                    freshTk.History?.length !== selectedTicket.History?.length ||
                    freshTk.CurrentStatus !== selectedTicket.CurrentStatus) {
                    setSelectedTicket(freshTk);
                }
            }
        }
    }, [tickets]);

    useEffect(() => {
        if (selectedTicket) {
            // setTechNote(lastNote || ''); // Option: do not prefill tech notes so it's only active notes
            setTechNote('');
            setSelectedTechs(getTicketTechs(selectedTicket));
            setActualDate(selectedTicket.ActualDate ? new Date(selectedTicket.ActualDate).toISOString().split('T')[0] : '');
            setPendingStatus(selectedTicket.CurrentStatus);
            // ARC-12 + ARC-15: hydrate category & supplier UI state from current row.
            setPendingJobCategory(selectedTicket.JobCategory || '');
            const supplierVal = selectedTicket.SupplierName || '';
            const isKnown = (SUPPLIERS as readonly string[]).includes(supplierVal) && supplierVal !== OTHER_SUPPLIER_SENTINEL;
            if (supplierVal && !isKnown) {
                setPendingSupplier(OTHER_SUPPLIER_SENTINEL);
                setCustomSupplier(supplierVal);
            } else {
                setPendingSupplier(supplierVal);
                setCustomSupplier('');
            }
            setShowWrongCategoryConfirm(false);
        } else {
            setReplyMessage('');
            setReplyFiles([]);
        }
    }, [selectedTicket]);

    // Unique values for filters
    const branches = useMemo(() => Array.from(new Set(tickets.map(t => t.Branch?.BranchName || t.BranchID))).filter(Boolean).sort(), [tickets]);
    const symptoms = useMemo(() => Array.from(new Set(tickets.map(t => t.Symptom))).filter(Boolean).sort(), [tickets]);

    const filteredTickets = useMemo(() => {
        return tickets.filter(t => {
            const ticketTime = new Date(t.CreatedAt).getTime();
            if (startDate && ticketTime < new Date(startDate).setHours(0, 0, 0, 0)) return false;
            if (endDate && ticketTime > new Date(endDate).setHours(23, 59, 59, 999)) return false;
            // ARC-11: hide WrongCategory by default; show only when toggled or explicitly filtered to it.
            if (!showWrongCategory && t.CurrentStatus === 'WrongCategory' && filterStatus !== 'WrongCategory') return false;
            if (filterStatus && t.CurrentStatus !== filterStatus) return false;
            if (filterSymptom && t.Symptom !== filterSymptom) return false;
            if (filterBranch && (t.Branch?.BranchName || t.BranchID) !== filterBranch) return false;
            // ARC-14: tech filter now matches against the join-table set (with legacy fallback via getTicketTechs).
            if (filterTechnician && !getTicketTechs(t).includes(filterTechnician)) return false;
            // ARC-12: optional JobCategory filter.
            if (filterJobCategory && t.JobCategory !== filterJobCategory) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return t.TicketID.toLowerCase().includes(q) || (t.Product || '').toLowerCase().includes(q) || (t.Description || '').toLowerCase().includes(q);
            }
            return true;
        });
    }, [tickets, startDate, endDate, filterStatus, filterSymptom, filterBranch, filterTechnician, filterJobCategory, searchQuery, showWrongCategory]);

    const handleSaveUpdate = async (overrideSignature?: string) => {
        if (!selectedTicket || !pendingStatus) return;

        if (pendingStatus === 'Completed' && !overrideSignature) {
            setShowSignPad(true);
            return;
        }

        setShowSignPad(false);
        setIsUpdating(true);

        const previousTicket = selectedTicket;
        const currentPendingStatus = pendingStatus;
        const currentTechNote = techNote;
        const currentSelectedTechs = [...selectedTechs];
        const currentActualDate = actualDate;

        // Optimistic update — close modal immediately for snappy feeling.
        // We mirror the new tech array onto BOTH the legacy Technician string AND the
        // Technicians[] relation so list/detail views render consistently before the
        // next poll lands the canonical state.
        setTickets(prev => prev.map(t => t.TicketID === previousTicket.TicketID ? {
            ...t,
            CurrentStatus: currentPendingStatus,
            Technician: currentSelectedTechs.join(', '),
            Technicians: currentSelectedTechs.map(name => ({ TechnicianName: name })),
            ActualDate: currentActualDate ? new Date(currentActualDate).toISOString() : t.ActualDate,
            AdminSignature: overrideSignature || t.AdminSignature
        } : t));
        setSelectedTicket(null);

        try {
            await updateTicketStatus(
                previousTicket.TicketID,
                currentPendingStatus,
                currentTechNote,
                currentSelectedTechs, // ARC-14: pass array; server normalises legacy string + join-table sync
                currentActualDate,
                overrideSignature
            );
            // State will naturally refresh on next polling cycle
        } catch (err) {
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
            fetchTickets(); // Revert on failure
        } finally {
            setIsUpdating(false);
        }
    };

    // ARC-12: persist JobCategory edit. Inline (does not require pressing the main save button).
    const handleSaveCategory = async (newCategory: string) => {
        if (!selectedTicket) return;
        setIsSavingCategory(true);
        const value = newCategory.trim() === '' ? null : newCategory;
        const previousValue = selectedTicket.JobCategory ?? null;
        // Optimistic update
        setTickets(prev => prev.map(t => t.TicketID === selectedTicket.TicketID
            ? { ...t, JobCategory: value }
            : t));
        setSelectedTicket((prev: any) => prev ? { ...prev, JobCategory: value } : prev);
        try {
            const result = await updateTicketCategory(selectedTicket.TicketID, value);
            if (!result.success) {
                alert(result.error || 'ไม่สามารถอัปเดตหมวดหมู่ได้');
                // Revert
                setPendingJobCategory(previousValue || '');
                setTickets(prev => prev.map(t => t.TicketID === selectedTicket.TicketID
                    ? { ...t, JobCategory: previousValue }
                    : t));
                setSelectedTicket((prev: any) => prev ? { ...prev, JobCategory: previousValue } : prev);
            }
        } catch (err) {
            console.error('updateTicketCategory error:', err);
            alert('เกิดข้อผิดพลาดในการบันทึกหมวดหมู่');
        } finally {
            setIsSavingCategory(false);
        }
    };

    // ARC-15: persist SupplierName edit. Resolves the "อื่นๆ" sentinel to free-text.
    const handleSaveSupplier = async (raw: string) => {
        if (!selectedTicket) return;
        const isOther = raw === OTHER_SUPPLIER_SENTINEL;
        const value = isOther ? customSupplier.trim() : raw.trim();
        if (isOther && value === '') {
            // Wait for the operator to actually type a custom name before saving.
            return;
        }
        setIsSavingSupplier(true);
        const previousValue = selectedTicket.SupplierName ?? null;
        const finalValue = value === '' ? null : value;
        // Optimistic
        setTickets(prev => prev.map(t => t.TicketID === selectedTicket.TicketID
            ? { ...t, SupplierName: finalValue }
            : t));
        setSelectedTicket((prev: any) => prev ? { ...prev, SupplierName: finalValue } : prev);
        try {
            const result = await updateTicketSupplier(selectedTicket.TicketID, finalValue);
            if (!result.success) {
                alert(result.error || 'ไม่สามารถอัปเดต supplier ได้');
                setTickets(prev => prev.map(t => t.TicketID === selectedTicket.TicketID
                    ? { ...t, SupplierName: previousValue }
                    : t));
                setSelectedTicket((prev: any) => prev ? { ...prev, SupplierName: previousValue } : prev);
            }
        } catch (err) {
            console.error('updateTicketSupplier error:', err);
            alert('เกิดข้อผิดพลาดในการบันทึก supplier');
        } finally {
            setIsSavingSupplier(false);
        }
    };

    // ARC-11: terminal "WrongCategory" mark — used when admin determines the ticket
    // doesn't belong to the repair team at all (e.g., IT). Closes the modal on success.
    const handleMarkWrongCategory = async () => {
        if (!selectedTicket) return;
        setIsMarkingWrongCategory(true);
        const previousTicket = selectedTicket;
        const noteText = (techNote && techNote.trim().length > 0)
            ? techNote
            : 'แจ้งงานผิดประเภท: ไม่ใช่งานช่าง';
        // Optimistic
        setTickets(prev => prev.map(t => t.TicketID === previousTicket.TicketID
            ? { ...t, CurrentStatus: 'WrongCategory' }
            : t));
        setSelectedTicket(null);
        setShowWrongCategoryConfirm(false);
        try {
            // Pass undefined for technician so server preserves whatever was already set
            // (we're flagging classification, not reassigning).
            await updateTicketStatus(previousTicket.TicketID, 'WrongCategory', noteText);
        } catch (err) {
            alert('ไม่สามารถบันทึกสถานะได้ กรุณาลองใหม่');
            fetchTickets();
        } finally {
            setIsMarkingWrongCategory(false);
        }
    };

    // ARC-14: chip toggle helper for the multi-select.
    const toggleTechChip = (name: string) => {
        setSelectedTechs(prev => prev.includes(name)
            ? prev.filter(n => n !== name)
            : [...prev, name]);
    };

    const handleAddComment = async () => {
        if (!replyMessage && replyFiles.length === 0) return;
        setIsReplying(true);
        try {
            let publicUrls: string[] = [];
            for (const file of replyFiles) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('tickets').upload(fileName, file);
                if (uploadError) throw new Error('Upload failed');
                const { data } = supabase.storage.from('tickets').getPublicUrl(fileName);
                publicUrls.push(data.publicUrl);
            }
            const finalImageUrl = publicUrls.join(',');
            await addTicketComment(selectedTicket.TicketID, replyMessage, finalImageUrl);
            setReplyMessage('');
            setReplyFiles([]);

            const updatedTickets = await getAllTickets(Date.now());
            setTickets(updatedTickets);
            const newT = updatedTickets.find(t => t.TicketID === selectedTicket.TicketID);
            if (newT) setSelectedTicket(newT);

        } catch (err) {
            alert('ไม่สามารถส่งข้อความได้');
            console.error(err);
        } finally {
            setIsReplying(false);
        }
    };

    const handleReplyFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const processedFiles: File[] = [];
        for (const file of files) {
            const isHeic = file.name.match(/\.(heic|heif)$/i);
            if (isHeic) {
                try {
                    const heic2any = (await import('heic2any')).default;
                    const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
                    const blobArray = Array.isArray(convertedBlob) ? convertedBlob : [convertedBlob];
                    const newFile = new File([blobArray[0]], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
                    processedFiles.push(newFile);
                } catch (err) {
                    console.error("HEIC conversion failed", err);
                    processedFiles.push(file);
                }
            } else {
                processedFiles.push(file);
            }
        }
        setReplyFiles(prev => [...prev, ...processedFiles]);
    };

    const handleExport = () => {
        // ARC-12/14/15 \u2014 added JobCategory + Supplier columns; Tech now joins the array.
        const headers = ["TicketID", "Status", "JobCategory", "Supplier", "Product", "Symptom", "Branch", "Techs", "Created", "ActualDate"];
        const csv = ["\uFEFF" + headers.join(",")];
        filteredTickets.forEach(t => csv.push([
            t.TicketID.toUpperCase(),
            translateStatus(t.CurrentStatus),
            (t.JobCategory || "-").replace(/,/g, " "),
            (t.SupplierName || "-").replace(/,/g, " "),
            (t.Product || "-").replace(/,/g, " "),
            (t.Symptom || "-").replace(/,/g, " "),
            (t.Branch?.BranchName || t.BranchID).replace(/,/g, " "),
            formatTechs(t).replace(/,/g, " | "),
            new Date(t.CreatedAt).toLocaleString('th-TH'),
            t.ActualDate ? new Date(t.ActualDate).toLocaleDateString('th-TH') : "-"
        ].join(",")));
        const blob = new Blob([csv.join("\n")], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const symptomStats = filteredTickets.reduce((acc: any, t) => { acc[t.Symptom] = (acc[t.Symptom] || 0) + 1; return acc; }, {});
    const sortedSymptoms = Object.entries(symptomStats).sort((a: any, b: any) => b[1] - a[1]);
    const chartColors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'];
    let curAngle = 0;
    const conicGradient = sortedSymptoms.map(([_, count]: any, i) => {
        const angle = (count / (filteredTickets.length || 1)) * 360;
        const res = `${chartColors[i % chartColors.length]} ${curAngle}deg ${curAngle + angle}deg`;
        curAngle += angle;
        return res;
    }).join(', ');

    const statusStats = filteredTickets.reduce((acc: any, t) => { acc[t.CurrentStatus] = (acc[t.CurrentStatus] || 0) + 1; return acc; }, {});
    const sortedStatuses = Object.entries(statusStats).sort((a: any, b: any) => b[1] - a[1]);
    let curStatusAngle = 0;
    const conicGradientStatus = sortedStatuses.map(([status, count]: any) => {
        const angle = (count / (filteredTickets.length || 1)) * 360;
        const res = `${statusColor(status)} ${curStatusAngle}deg ${curStatusAngle + angle}deg`;
        curStatusAngle += angle;
        return res;
    }).join(', ');

    const combinedTimeline = selectedTicket ? [
        ...(selectedTicket.History || []).map((h: any) => ({ type: 'history', date: h.Timestamp, user: h.UpdatedBy, msg: h.Note, status: h.Status })),
        ...(selectedTicket.Comments || []).map((c: any) => ({ type: 'comment', date: c.Timestamp, user: c.User?.Role === 'Admin' ? 'แอดมิน' : 'สาขา', msg: c.Message, img: c.ImageURL }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) : [];

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '6rem 2rem 2rem' }} className="mobile-padded">
            <style jsx global>{`
                .filter-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
                .modal-wrapper { display: flex; flex-direction: row; }
                .header-actions { display: flex; gap: 0.8rem; }
                
                @media (max-width: 768px) { 
                    .mobile-padded { padding: 4.5rem 0.5rem 1rem !important; }
                    .filter-grid { grid-template-columns: 1fr; } 
                    
                    .table-container { 
                        overflow-x: auto !important; 
                        width: 100%; 
                        -webkit-overflow-scrolling: touch; 
                    }
                    
                    .modal-wrapper { 
                        flex-direction: column !important; 
                        overflow-y: auto !important; 
                        max-height: 90vh !important; 
                    }
                    .modal-col-left { 
                        border-right: none !important; 
                        border-bottom: 1px solid #e2e8f0; 
                        flex: none !important; 
                        max-height: none !important; 
                        padding: 1.5rem !important; 
                    }
                    .modal-col-right { 
                        flex: none !important; 
                        padding: 1.5rem !important; 
                    }
                    
                    .header-actions { flex-direction: column; width: 100%; }
                    .header-actions > button, .header-actions > div { width: 100%; justify-content: center; }
                    .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
                    .stats-overall { grid-template-columns: 1fr !important; }
                }

                @media print {
                    main, nav, header, footer { display: none !important; }
                    .modal-backdrop { position: absolute !important; inset: 0 !important; background: white !important; padding: 0 !important; align-items: flex-start !important; justify-content: flex-start !important; display: block !important; }
                    .modal-wrapper { width: 100% !important; max-width: none !important; border-radius: 0 !important; box-shadow: none !important; flex-direction: column !important; display: block !important; overflow: visible !important; }
                    .modal-col-left { width: 100% !important; max-height: none !important; overflow: visible !important; background: white !important; padding: 1rem 2rem !important; border: none !important; }
                    .modal-col-right, .no-print { display: none !important; }
                }
            `}</style>

            <main style={{ maxWidth: '1600px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: '900', color: '#1e293b' }}>Admin Dashboard</h1>
                        <p style={{ color: '#64748b' }}>ระบบจัดการงานซ่อมบำรุง</p>
                    </div>
                    <div className="header-actions">
                        <button onClick={handleExport} style={{ padding: '0.6rem 1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: '700' }}>📥 Export</button>
                        <div style={{ background: '#e2e8f0', padding: '0.3rem', borderRadius: '12px', display: 'flex', gap: '0.2rem' }}>
                            {['overview', 'list'].map((m: any) => (
                                <button key={m} onClick={() => setViewMode(m)} style={{ flex: 1, padding: '0.5rem 1rem', borderRadius: '10px', border: 'none', background: viewMode === m ? '#1e293b' : 'transparent', color: viewMode === m ? '#fff' : '#475569', fontWeight: '700', cursor: 'pointer' }}>{m === 'overview' ? 'สรุป' : 'ตาราง'}</button>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ padding: '1.5rem', borderRadius: '20px', background: '#fff', marginBottom: '2.5rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                    <div className="filter-grid">
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '900', display: 'block', marginBottom: '0.4rem' }}>ค้นหา (ID/อุปกรณ์)</label>
                            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="ระบุคำค้นหา..." style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '900', display: 'block', marginBottom: '0.4rem' }}>สถานะ</label>
                            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                                <option value="">ทั้งหมด</option>
                                {statuses.map(s => <option key={s} value={s}>{translateStatus(s)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '900', display: 'block', marginBottom: '0.4rem' }}>หมวดหมู่</label>
                            <select value={filterSymptom} onChange={e => setFilterSymptom(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                                <option value="">ทั้งหมด</option>
                                {symptoms.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '900', display: 'block', marginBottom: '0.4rem' }}>สาขา</label>
                            <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                                <option value="">ทั้งหมด</option>
                                {branches.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '900', display: 'block', marginBottom: '0.4rem' }}>ช่าง</label>
                            <select value={filterTechnician} onChange={e => setFilterTechnician(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                                <option value="">ทั้งหมด</option>
                                {technicians.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        {/* ARC-12: JobCategory filter (admin-curated list) */}
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '900', display: 'block', marginBottom: '0.4rem' }}>หมวดหมู่งาน</label>
                            <select value={filterJobCategory} onChange={e => setFilterJobCategory(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                                <option value="">ทั้งหมด</option>
                                {JOB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        {/* ARC-11: WrongCategory chip — hidden by default; click to reveal "ไม่ใช่งานช่าง" tickets */}
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => setShowWrongCategory(prev => !prev)}
                                style={{
                                    padding: '0.6rem 0.8rem',
                                    borderRadius: '10px',
                                    border: `2px solid ${showWrongCategory ? STATUS_COLOR.WrongCategory : '#cbd5e1'}`,
                                    background: showWrongCategory ? STATUS_COLOR.WrongCategory : '#fff',
                                    color: showWrongCategory ? '#fff' : '#475569',
                                    cursor: 'pointer',
                                    fontWeight: '800',
                                    fontSize: '0.85rem',
                                    transition: 'all 0.2s'
                                }}
                                title="แสดง/ซ่อนใบงานที่ถูก mark ว่าไม่ใช่งานช่าง"
                            >
                                {showWrongCategory ? '🚫 ซ่อน "ไม่ใช่งานช่าง"' : '🚫 แสดง "ไม่ใช่งานช่าง"'}
                            </button>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '900', display: 'block', marginBottom: '0.4rem' }}>จากวันที่แจ้ง</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid #cbd5e1' }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button onClick={() => { setStartDate(''); setEndDate(''); setFilterStatus(''); setFilterSymptom(''); setFilterBranch(''); setFilterTechnician(''); setSearchQuery(''); }} style={{ background: '#f1f5f9', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '10px', cursor: 'pointer', fontWeight: '800', width: '100%', color: '#64748b' }}>ล้างตัวกรองทั้งหมด</button>
                        </div>
                    </div>
                    
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.75rem', fontWeight: '800' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></span>
                            <span style={{ color: '#475569' }}>เขียว: งานเสร็จสิ้น</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}></span>
                            <span style={{ color: '#475569' }}>เหลือง: ไม่ขยับเกิน 3 วัน</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></span>
                            <span style={{ color: '#475569' }}>แดง: ไม่ขยับเกิน 7 วัน</span>
                        </div>
                    </div>
                </div>

                {viewMode === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                            {[
                                { l: 'รวม', c: filteredTickets.length, cl: '#1e293b' },
                                { l: 'แจ้งซ่อมใหม่', c: filteredTickets.filter(t => t.CurrentStatus === 'Open').length, cl: '#3b82f6' },
                                { l: 'รับเรื่องแล้ว', c: filteredTickets.filter(t => t.CurrentStatus === 'On Process').length, cl: '#8b5cf6' },
                                { l: 'กำลังเข้าซ่อม', c: filteredTickets.filter(t => t.CurrentStatus === 'Repairing').length, cl: '#f59e0b' },
                                { l: 'รออะไหล่', c: filteredTickets.filter(t => t.CurrentStatus === 'Waiting Parts').length, cl: '#ef4444' },
                                { l: 'ซ่อมเรียบร้อย', c: filteredTickets.filter(t => t.CurrentStatus === 'Completed').length, cl: '#10b981' },
                                { l: 'ปิดงานถาวร', c: filteredTickets.filter(t => t.CurrentStatus === 'Closed').length, cl: '#64748b' }
                            ].map((s, i) => (
                                <div key={i} style={{ padding: '1.2rem', textAlign: 'center', background: '#fff', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                    <h4 style={{ fontSize: '2rem', fontWeight: '900', color: s.cl }}>{s.c}</h4>
                                    <p style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b' }}>{s.l}</p>
                                </div>
                            ))}
                        </div>

                        <div className="stats-overall" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
                            <div style={{ padding: '2rem', borderRadius: '24px', background: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
                                <h3 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>📊 ภาระงานรายช่าง</h3>
                                {technicians.map(tech => {
                                    const tks = filteredTickets.filter(t => t.Technician === tech);
                                    if (tks.length === 0 && !filterTechnician) return null;
                                    return (
                                        <div key={tech} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem 0', borderBottom: '1px solid #f1f5f9' }}>
                                            <span style={{ fontWeight: '800', color: '#1e293b' }}>ช่าง {tech}</span>
                                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                <span style={{ background: '#f1f5f9', padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', color: '#475569' }}>รวม {tks.length}</span>
                                                <span style={{ background: '#dbeafe', padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', color: '#1d4ed8' }}>ใหม่ {tks.filter(t => t.CurrentStatus === 'Open').length}</span>
                                                <span style={{ background: '#ede9fe', padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', color: '#6d28d9' }}>รับเรื่องแล้ว {tks.filter(t => t.CurrentStatus === 'On Process').length}</span>
                                                <span style={{ background: '#fef3c7', padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', color: '#b45309' }}>กำลังซ่อม {tks.filter(t => t.CurrentStatus === 'Repairing').length}</span>
                                                <span style={{ background: '#fee2e2', padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', color: '#b91c1c' }}>รออะไหล่ {tks.filter(t => t.CurrentStatus === 'Waiting Parts').length}</span>
                                                <span style={{ background: '#dcfce7', padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', color: '#15803d' }}>ซ่อมเสร็จ {tks.filter(t => t.CurrentStatus === 'Completed').length}</span>
                                                <span style={{ background: '#e2e8f0', padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', color: '#334155' }}>ปิดงาน {tks.filter(t => t.CurrentStatus === 'Closed').length}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ padding: '2rem', borderRadius: '24px', background: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <h3 style={{ marginBottom: '1.5rem', width: '100%', color: '#1e293b' }}>🧩 สัดส่วนประเภทปัญหา</h3>
                                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', width: '100%', flexWrap: 'wrap', justifyContent: 'center' }}>
                                    <div style={{ width: '200px', height: '200px', borderRadius: '50%', background: filteredTickets.length > 0 ? `conic-gradient(${conicGradient})` : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ width: '120px', height: '120px', background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', color: '#64748b', fontSize: '1.2rem' }}>{filteredTickets.length}</div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', minWidth: '150px' }}>
                                        {sortedSymptoms.map(([symp, count]: any, i) => (
                                            <div key={symp} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: chartColors[i % chartColors.length] }}></span>
                                                <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '800' }}>{symp}</span>
                                                <span style={{ fontSize: '0.85rem', fontWeight: '900', color: '#1e293b', marginLeft: 'auto', paddingLeft: '1rem' }}>{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div style={{ padding: '2rem', borderRadius: '24px', background: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <h3 style={{ marginBottom: '1.5rem', width: '100%', color: '#1e293b' }}>📈 สัดส่วนสถานะการซ่อม</h3>
                                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', width: '100%', flexWrap: 'wrap', justifyContent: 'center' }}>
                                    <div style={{ width: '200px', height: '200px', borderRadius: '50%', background: filteredTickets.length > 0 ? `conic-gradient(${conicGradientStatus})` : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ width: '120px', height: '120px', background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', color: '#64748b', fontSize: '1.2rem' }}>{filteredTickets.length}</div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', minWidth: '150px' }}>
                                        {sortedStatuses.map(([status, count]: any) => (
                                            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: statusColor(status) }}></span>
                                                <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '800' }}>{translateStatus(status)}</span>
                                                <span style={{ fontSize: '0.85rem', fontWeight: '900', color: '#1e293b', marginLeft: 'auto', paddingLeft: '1rem' }}>{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'list' && (
                    <div className="table-container" style={{ borderRadius: '20px', background: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}>
                        <div style={{ padding: '1rem', background: '#fef3c7', color: '#92400e', fontSize: '0.85rem', fontWeight: '800', borderRadius: '20px 20px 0 0', textAlign: 'center' }} className="d-block d-md-none">
                            👈 ปัดซ้าย-ขวา เพื่อดูข้อมูลเพิ่มเติม 👉
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                            <thead style={{ background: '#f8fafc' }}>
                                <tr>
                                    <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900', color: '#475569' }}>สถานะ</th>
                                    <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900', color: '#475569' }}>อุปกรณ์</th>
                                    <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900', color: '#475569' }}>หมวดหมู่</th>
                                    <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900', color: '#475569' }}>สาขา</th>
                                    <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900', color: '#475569' }}>ช่าง</th>
                                    <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900', color: '#475569' }}>อัปเดตล่าสุด</th>
                                    <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900', color: '#475569', width: '250px' }}>ข้อความล่าสุด</th>
                                    <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900', color: '#475569' }}>วันที่แจ้ง</th>
                                    <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900', color: '#475569' }}>วันที่สาขาขอเข้า</th>
                                    <th style={{ padding: '1.2rem', textAlign: 'left', fontWeight: '900', color: '#475569' }}>วันที่เข้าจริง</th>
                                    <th style={{ padding: '1.2rem' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTickets.map(t => (
                                    <tr key={t.TicketID} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => setSelectedTicket(t)}>
                                        <td style={{ padding: '1rem 1.2rem' }}>
                                            <span style={{ 
                                                display: 'inline-block', 
                                                whiteSpace: 'nowrap', 
                                                padding: '0.4rem 0.8rem', 
                                                borderRadius: '8px', 
                                                fontSize: '0.8rem', 
                                                fontWeight: '800', 
                                                background: getSLAColor(t) || `${statusColor(t.CurrentStatus)}20`, 
                                                color: getSLAColor(t) ? '#fff' : statusColor(t.CurrentStatus), 
                                                border: getSLAColor(t) ? 'none' : `1px solid ${statusColor(t.CurrentStatus)}` 
                                            }}>{translateStatus(t.CurrentStatus)}</span>
                                        </td>
                                        <td style={{ padding: '1rem 1.2rem', fontWeight: '800', color: '#1e293b' }}>{t.Product || "-"}</td>
                                        <td style={{ padding: '1rem 1.2rem' }}>
                                            {t.JobCategory ? (
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: '800', color: '#4338ca' }}>{t.JobCategory}</span>
                                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>สาขาระบุ: {t.Symptom}</span>
                                                </div>
                                            ) : (
                                                <span style={{ color: '#475569' }}>{t.Symptom}</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem 1.2rem', color: '#475569', fontSize: '0.9rem' }}>{t.Branch?.BranchName || t.BranchID}</td>
                                        <td style={{ padding: '1rem 1.2rem', fontWeight: '700' }}>{formatTechs(t)}</td>
                                        <td style={{ padding: '1rem 1.2rem', fontSize: '0.85rem', color: '#64748b' }}>
                                            {getLastUpdateInfo(t) ? getLastUpdateInfo(t)?.date.toLocaleString('th-TH', { day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : "-"}
                                        </td>
                                        <td style={{ padding: '1rem 1.2rem', fontSize: '0.85rem', color: '#475569', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {getLastUpdateInfo(t)?.msg || "-"}
                                        </td>
                                        <td style={{ padding: '1rem 1.2rem', fontSize: '0.9rem' }}>{new Date(t.CreatedAt).toLocaleDateString('th-TH')}</td>
                                        <td style={{ padding: '1rem 1.2rem', fontWeight: '800', color: '#4338ca', fontSize: '0.9rem' }}>{t.RequestDate ? new Date(t.RequestDate).toLocaleDateString('th-TH') : "-"}</td>
                                        <td style={{ padding: '1rem 1.2rem', fontWeight: '800', color: '#3b82f6', fontSize: '0.9rem' }}>{t.ActualDate ? new Date(t.ActualDate).toLocaleDateString('th-TH') : "-"}</td>
                                        <td style={{ padding: '1rem 1.2rem' }}>
                                            <button onClick={(e) => { e.stopPropagation(); setSelectedTicket(t); }} style={{ background: '#1e293b', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '10px', cursor: 'pointer', fontWeight: '800' }}>จัดการ</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>

            {/* Modal */}
            {selectedTicket && (
                <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }} onClick={() => setSelectedTicket(null)}>
                    <div className="modal-wrapper" style={{ background: '#fff', width: '100%', maxWidth: '1100px', borderRadius: '25px', display: 'flex', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>

                        <div className="modal-col-left print-area" style={{ flex: 1.2, padding: '2.5rem', overflowY: 'auto', maxHeight: '85vh', borderRight: '1px solid #f1f5f9', background: '#fafafa' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.6rem', fontWeight: '900', color: '#1e293b' }}>{selectedTicket.Product || 'ไม่ระบุอุปกรณ์'}</h2>
                                    {/* ARC-13 (12-05-2026): show branch name in detail popup so admin doesn't have
                                        to flip back to the list to know whose ticket this is. */}
                                    <p style={{ color: '#0f766e', fontWeight: '800', marginTop: '0.4rem', fontSize: '0.95rem' }}>
                                        🏬 สาขา: {selectedTicket.Branch?.BranchName || selectedTicket.BranchID || 'ไม่ระบุสาขา'}
                                    </p>
                                    {/* ARC-12: JobCategory now shown here read-only; full editor lives in modal-col-right.
                                        Symptom (สาขากรอก) shown beneath as the original report. */}
                                    <p style={{ color: '#6366f1', fontWeight: '800', marginTop: '0.4rem' }}>
                                        หมวดหมู่: {selectedTicket.JobCategory || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>ยังไม่ระบุ</span>}
                                    </p>
                                    {selectedTicket.Symptom && (
                                        <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                                            สาขากรอกอาการ: <span style={{ color: '#1e293b', fontWeight: '700' }}>{selectedTicket.Symptom}</span>
                                        </p>
                                    )}
                                    {/* ARC-15: surface SupplierName when set (admin can edit in right column). */}
                                    {selectedTicket.SupplierName && (
                                        <p style={{ color: '#c2410c', fontWeight: '800', marginTop: '0.2rem', fontSize: '0.85rem' }}>
                                            🏗️ Supplier: {selectedTicket.SupplierName}
                                        </p>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }} className="no-print">
                                    <button onClick={() => window.print()} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>🖨️ ปริ้นใบงาน</button>
                                    <button onClick={() => setSelectedTicket(null)} style={{ background: '#f1f5f9', border: 'none', width: '40px', height: '40px', borderRadius: '50%', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>×</button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                                <span style={{ padding: '0.4rem 0.8rem', background: '#e2e8f0', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '800' }}>#{selectedTicket.TicketID.substring(0, 8).toUpperCase()}</span>
                                <span style={{ display: 'inline-block', whiteSpace: 'nowrap', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '800', background: statusColor(selectedTicket.CurrentStatus) + '20', color: statusColor(selectedTicket.CurrentStatus) }}>{translateStatus(selectedTicket.CurrentStatus)}</span>
                                <span style={{ padding: '0.4rem 0.8rem', background: '#e0e7ff', color: '#4338ca', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '800' }}>📅 วันที่สาขาขอเข้า: {selectedTicket.RequestDate ? new Date(selectedTicket.RequestDate).toLocaleDateString('th-TH') : 'ไม่ได้ระบุ'}</span>
                            </div>

                            <div style={{ marginTop: '1rem', background: '#fff', padding: '1.5rem', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                                <p style={{ fontWeight: '900', marginBottom: '0.5rem', color: '#475569' }}>รายละเอียดจากผู้แจ้ง:</p>
                                <p style={{ color: '#1e293b', lineHeight: '1.6' }}>{selectedTicket.Description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                                {selectedTicket.ImageURL && selectedTicket.ImageURL.split(',').map((url: string, idx: number) => {
                                    const isVideo = url.match(/\.(mp4|webm|mov|ogg)$/i);
                                    const isHeic = url.match(/\.(heic|heif)$/i);
                                    return (
                                        <div key={idx} style={{ marginTop: '1rem' }}>
                                            {isVideo ? (
                                                <div style={{ position: 'relative' }}>
                                                    <video src={url} controls style={{ width: '100%', borderRadius: '15px', border: '2px solid #f1f5f9', background: '#0f172a' }} />
                                                    {url.match(/\.(mov)$/i) && (
                                                        <div style={{ padding: '0.8rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                            <span style={{ fontSize: '0.8rem', color: '#991b1b', fontWeight: '800' }}>⚠️ วิดีโอ iPhone (.mov) อาจมีแต่เสียง ให้กดดาวน์โหลดเพื่อดูภาพครับ</span>
                                                            <button onClick={() => window.open(url, '_blank')} style={{ padding: '0.4rem 0.8rem', background: '#ef4444', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '0.75rem' }}>ดาวน์โหลด</button>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : isHeic ? (
                                                <div style={{ padding: '1rem', background: '#f1f5f9', borderRadius: '15px', border: '2px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: '800' }}>🖼️ รูปภาพ (HEIC จาก iPhone)</span>
                                                    <button onClick={() => setHeicUrlToView(url)} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '800' }}>แปลงไฟล์ / เปิดดู</button>
                                                </div>
                                            ) : (
                                                <img src={url} alt={`Evidence ${idx}`} loading="lazy" style={{ width: '100%', borderRadius: '15px', border: '2px solid #f1f5f9', cursor: 'pointer' }} onClick={() => window.open(url, '_blank')} />
                                            )}
                                        </div>
                                    );
                                })}

                                {selectedTicket.AdminSignature && (
                                    <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                        <label style={{ fontWeight: '900', fontSize: '0.85rem', color: '#475569', display: 'block', marginBottom: '0.5rem' }}>ลายเซ็นผู้มอบงาน (Admin)</label>
                                        <img src={selectedTicket.AdminSignature} alt="Admin Signature" loading="lazy" style={{ maxHeight: '80px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
                                    </div>
                                )}
                                {selectedTicket.UserSignature && (
                                    <div style={{ marginTop: '0.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                        <label style={{ fontWeight: '900', fontSize: '0.85rem', color: '#475569', display: 'block', marginBottom: '0.5rem' }}>ลายเซ็นผู้รับมอบงาน (สาขา)</label>
                                        <img src={selectedTicket.UserSignature} alt="Branch Signature" loading="lazy" style={{ maxHeight: '80px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
                                    </div>
                                )}
                            </div>

                            <hr style={{ margin: '2rem 0', borderColor: '#e2e8f0' }} />
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#1e293b', marginBottom: '1rem' }}>💬 ไทม์ไลน์ & แชทโต้ตอบ</h3>

                            {/* Timeline display */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                                {combinedTimeline.length > 0 ? combinedTimeline.map((item, idx) => (
                                    <div key={idx} style={{ padding: '1rem', background: item.type === 'history' ? '#f1f5f9' : '#e0e7ff', borderRadius: '15px', borderLeft: `4px solid ${item.type === 'history' ? '#94a3b8' : '#6366f1'}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem', fontWeight: '800', color: '#64748b' }}>
                                            <span>{item.type === 'history' ? '🛠️ อัปเดตงาน' : '👤 ' + (item.user || '')}</span>
                                            <span>{new Date(item.date).toLocaleString('th-TH')}</span>
                                        </div>
                                        {item.type === 'history' && item.status && (
                                            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: '#fff', borderRadius: '6px', fontWeight: '800', border: '1px solid #cbd5e1', marginRight: '0.5rem' }}>เปลี่ยนสถานะ: {translateStatus(item.status)}</span>
                                        )}
                                        {item.msg && <p style={{ color: '#1e293b', fontSize: '0.95rem', marginTop: '0.5rem' }}>{item.msg}</p>}
                                        {item.img && (
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                                                {item.img.split(',').map((url: string, idx: number) => {
                                                    const isVideo = url.match(/\.(mp4|webm|mov|ogg)$/i);
                                                    const isHeic = url.match(/\.(heic|heif)$/i);
                                                    return isVideo ? (
                                                        <div key={idx} style={{ position: 'relative', maxWidth: '250px' }}>
                                                            <video src={url} controls style={{ width: '100%', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#0f172a' }} />
                                                            {url.match(/\.(mov)$/i) && (
                                                                <button onClick={() => window.open(url, '_blank')} style={{ width: '100%', padding: '0.5rem', background: '#fef2f2', color: '#991b1b', borderRadius: '8px', border: '1px solid #fca5a5', cursor: 'pointer', fontWeight: '800', fontSize: '0.7rem', marginTop: '0.3rem' }}>⚠️ โหลดวิดีโอ (.mov)</button>
                                                            )}
                                                        </div>
                                                    ) : isHeic ? (
                                                        <button key={idx} onClick={() => setHeicUrlToView(url)} style={{ padding: '0.5rem 1rem', background: '#f1f5f9', color: '#475569', borderRadius: '10px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: '800', fontSize: '0.8rem' }}>🖼️ ดูรูป HEIC</button>
                                                    ) : (
                                                        <img key={idx} src={url} loading="lazy" style={{ maxWidth: '200px', borderRadius: '10px', border: '1px solid #cbd5e1', cursor: 'pointer' }} onClick={() => window.open(url, '_blank')} />
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )) : (
                                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>ยังไม่มีการพูดคุยหรือการอัปเดต</p>
                                )}
                            </div>

                            {/* Reply Input */}
                            <div className="no-print" style={{ background: '#fff', padding: '1.5rem', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                                <label style={{ fontWeight: '900', fontSize: '0.85rem', color: '#475569', marginBottom: '0.5rem', display: 'block' }}>ส่งข้อความ / ตอบกลับ</label>
                                <textarea value={replyMessage} onChange={e => setReplyMessage(e.target.value)} placeholder="พิมพ์ข้อความตอบกลับสาขา..." style={{ width: '100%', height: '80px', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1', resize: 'none', marginBottom: '1rem' }} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                    <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        {replyFiles.map((file, idx) => (
                                            <div key={idx} style={{ padding: '0.4rem 0.8rem', background: '#f1f5f9', borderRadius: '8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                📎 {file.name}
                                                <button onClick={() => setReplyFiles(prev => prev.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'transparent', color: 'red', fontWeight: '800', cursor: 'pointer', padding: '0' }}>✕</button>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                                        <input type="file" accept="image/*,video/*" multiple id="replyImg" style={{ display: 'none' }} onChange={handleReplyFileChange} />
                                        <label htmlFor="replyImg" style={{ padding: '0.6rem 1rem', background: '#f1f5f9', cursor: 'pointer', borderRadius: '10px', fontSize: '0.8rem', fontWeight: '800' }}>📎 แนบรูปภาพ/วิดีโอ</label>
                                        <button onClick={handleAddComment} disabled={isReplying || (!replyMessage && replyFiles.length === 0)} style={{ marginLeft: 'auto', background: '#6366f1', color: '#fff', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}>{isReplying ? 'ส่ง...' : 'ส่งข้อความ'}</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* BUG-04 (13-05-2026): mirror modal-col-left's maxHeight + scroll so the
                            taller Phase 2B content (JobCategory editor + conditional Supplier card +
                            multi-tech chips + WrongCategory button) doesn't push the modal past the viewport. */}
                        <div className="modal-col-right" style={{ flex: 0.8, background: '#fff', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '85vh', overflowY: 'auto' }}>
                            <div style={{ paddingBottom: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#1e293b', marginBottom: '1.5rem' }}>⚙️ จัดการงานแจ้งซ่อม</h3>

                                {/* ARC-12 (12-05-2026): inline JobCategory editor — admin can re-classify a ticket
                                    when the branch picked the wrong type. Saves on change (no extra save button). */}
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ fontWeight: '900', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem', color: '#475569' }}>
                                        หมวดหมู่งาน (admin แก้ไขได้){isSavingCategory && <span style={{ color: '#94a3b8', marginLeft: '0.5rem', fontSize: '0.75rem' }}>กำลังบันทึก…</span>}
                                    </label>
                                    <select
                                        value={pendingJobCategory}
                                        onChange={e => { const v = e.target.value; setPendingJobCategory(v); handleSaveCategory(v); }}
                                        style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '700' }}
                                    >
                                        <option value="">-- ไม่ระบุ --</option>
                                        {JOB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    {selectedTicket.Symptom && (
                                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                                            สาขากรอกอาการ: <span style={{ color: '#475569', fontWeight: '700' }}>{selectedTicket.Symptom}</span>
                                        </p>
                                    )}
                                </div>

                                {/* ARC-15 (12-05-2026): conditional Supplier dropdown — only when JobCategory = "ช่างรับเหมา".
                                    "อื่นๆ" reveals a free-text input. Save is gated on non-empty custom value. */}
                                {requiresSupplier(pendingJobCategory) && (
                                    <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#fff7ed', borderRadius: '12px', border: '1px solid #fed7aa' }}>
                                        <label style={{ fontWeight: '900', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem', color: '#c2410c' }}>
                                            🏗️ Supplier (จำเป็นสำหรับช่างรับเหมา){isSavingSupplier && <span style={{ color: '#94a3b8', marginLeft: '0.5rem', fontSize: '0.75rem' }}>กำลังบันทึก…</span>}
                                        </label>
                                        <select
                                            value={pendingSupplier}
                                            onChange={e => {
                                                const v = e.target.value;
                                                setPendingSupplier(v);
                                                if (v !== OTHER_SUPPLIER_SENTINEL) {
                                                    setCustomSupplier('');
                                                    handleSaveSupplier(v);
                                                }
                                            }}
                                            style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #fdba74', background: '#fff', fontWeight: '700' }}
                                        >
                                            <option value="">-- เลือก supplier --</option>
                                            {SUPPLIERS.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        {pendingSupplier === OTHER_SUPPLIER_SENTINEL && (
                                            <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem' }}>
                                                <input
                                                    type="text"
                                                    value={customSupplier}
                                                    onChange={e => setCustomSupplier(e.target.value)}
                                                    placeholder="ระบุชื่อ supplier..."
                                                    style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid #fdba74', background: '#fff', fontWeight: '700' }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveSupplier(OTHER_SUPPLIER_SENTINEL)}
                                                    disabled={customSupplier.trim() === '' || isSavingSupplier}
                                                    style={{ padding: '0.6rem 1rem', background: '#ea580c', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: customSupplier.trim() === '' ? 'not-allowed' : 'pointer', opacity: customSupplier.trim() === '' ? 0.5 : 1 }}
                                                >
                                                    บันทึก
                                                </button>
                                            </div>
                                        )}
                                        {selectedTicket.SupplierName && (
                                            <p style={{ fontSize: '0.75rem', color: '#7c2d12', marginTop: '0.4rem' }}>
                                                ปัจจุบัน: <span style={{ fontWeight: '900' }}>{selectedTicket.SupplierName}</span>
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* ARC-14 (12-05-2026): multi-technician chip selector. "ทีมช่างรับเหมา" intentionally
                                    NOT in TECHNICIANS — it's a JobCategory above. Tap to toggle. */}
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ fontWeight: '900', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem', color: '#475569' }}>
                                        ช่างผู้รับผิดชอบ <span style={{ color: '#94a3b8', fontWeight: '700' }}>(เลือกได้หลายคน)</span>
                                    </label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                        {technicians.map(t => {
                                            const active = selectedTechs.includes(t);
                                            return (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    onClick={() => toggleTechChip(t)}
                                                    style={{
                                                        padding: '0.5rem 0.9rem',
                                                        borderRadius: '9999px',
                                                        border: `2px solid ${active ? '#1e293b' : '#cbd5e1'}`,
                                                        background: active ? '#1e293b' : '#fff',
                                                        color: active ? '#fff' : '#475569',
                                                        fontWeight: '800',
                                                        fontSize: '0.8rem',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s'
                                                    }}
                                                >
                                                    {active ? '✓ ' : ''}{t}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {selectedTechs.length === 0 && (
                                        <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.5rem' }}>ยังไม่มีช่างมอบหมาย — แตะเพื่อเลือก</p>
                                    )}
                                </div>

                                <div>
                                    <label style={{ fontWeight: '900', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem', color: '#475569' }}>วันที่เข้าซ่อมจริง</label>
                                    <input type="date" value={actualDate} onChange={e => setActualDate(e.target.value)} style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '700' }} />
                                </div>
                            </div>

                            <div>
                                <label style={{ fontWeight: '900', fontSize: '0.85rem', display: 'block', marginBottom: '0.8rem', color: '#475569' }}>เปลี่ยนสถานะงาน</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
                                    {adminSelectableStatuses.map(s => (
                                        <button key={s} onClick={() => setPendingStatus(s)} style={{ padding: '0.8rem', borderRadius: '12px', border: '2px solid', borderColor: pendingStatus === s ? '#10b981' : '#e2e8f0', background: pendingStatus === s ? '#10b981' : '#fff', color: pendingStatus === s ? '#fff' : '#475569', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s', boxShadow: pendingStatus === s ? '0 4px 6px rgba(16, 185, 129, 0.2)' : 'none' }}>{translateStatus(s)}</button>
                                    ))}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.8rem', fontWeight: '800' }}>* สถานะ "ปิดงานถาวร" สาขาจะเป็นผู้กดเพื่อประเมินผลช่าง</p>
                            </div>

                            <div>
                                <label style={{ fontWeight: '900', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem', color: '#475569' }}>บันทึกภายในสำหรับแอดมิน</label>
                                <textarea value={techNote} onChange={e => setTechNote(e.target.value)} placeholder="บันทึกข้อความภายในเมื่ออัปเดต..." style={{ width: '100%', height: '80px', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff', resize: 'none' }} />
                                <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.3rem' }}>* บันทึกนี้จะลงในประวัติไทม์ไลน์</p>
                            </div>

                            <button onClick={() => handleSaveUpdate()} disabled={isUpdating} style={{ marginTop: 'auto', width: '100%', padding: '1.2rem', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: '900', fontSize: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                                {isUpdating ? 'กำลังบันทึก...' : '💾 อัปเดตงานแจ้งซ่อม'}
                            </button>

                            {/* ARC-11 (12-05-2026): "แจ้งงานผิดประเภท" — terminal mark for tickets that are not
                                a repair-team job at all (e.g., IT). Hidden once the ticket is already in a
                                terminal state. Two-step (confirm) to prevent accidental clicks. */}
                            {selectedTicket.CurrentStatus !== 'WrongCategory' && selectedTicket.CurrentStatus !== 'Closed' && (
                                <div style={{ borderTop: '1px dashed #fee2e2', paddingTop: '1rem' }}>
                                    {!showWrongCategoryConfirm ? (
                                        <button
                                            type="button"
                                            onClick={() => setShowWrongCategoryConfirm(true)}
                                            style={{ width: '100%', padding: '0.8rem', background: '#fff', color: '#b91c1c', border: '2px solid #fca5a5', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', fontSize: '0.85rem' }}
                                        >
                                            🚫 แจ้งงานผิดประเภท (ไม่ใช่งานช่าง)
                                        </button>
                                    ) : (
                                        <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: '12px', border: '1px solid #fca5a5' }}>
                                            <p style={{ fontSize: '0.85rem', color: '#7f1d1d', fontWeight: '800', marginBottom: '0.8rem' }}>
                                                ⚠️ งานนี้จะถูก mark ว่า <b>ไม่ใช่งานช่าง</b> และซ่อนจากรายการหลัก สาขาต้องสร้างใบงานใหม่ถ้าต้องการแจ้งซ่อม
                                            </p>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button
                                                    type="button"
                                                    onClick={handleMarkWrongCategory}
                                                    disabled={isMarkingWrongCategory}
                                                    style={{ flex: 1, padding: '0.7rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}
                                                >
                                                    {isMarkingWrongCategory ? 'กำลังบันทึก…' : 'ยืนยัน'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowWrongCategoryConfirm(false)}
                                                    disabled={isMarkingWrongCategory}
                                                    style={{ flex: 1, padding: '0.7rem', background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}
                                                >
                                                    ยกเลิก
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <SignatureModal
                isOpen={showSignPad}
                title="กรุณาลงลายมือชื่อรับรองการซ่อมเสร็จสิ้น (Admin)"
                onClose={() => setShowSignPad(false)}
                onConfirm={(sig) => handleSaveUpdate(sig)}
            />
            {heicUrlToView && (
                <HeicViewerModal url={heicUrlToView} onClose={() => setHeicUrlToView(null)} />
            )}
        </div>
    );
}
