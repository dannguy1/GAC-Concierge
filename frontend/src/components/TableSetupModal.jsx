import React, { useState, useEffect } from 'react';

export default function TableSetupModal({ tableNumber, guestCount, onSave, onClose }) {
    const [table, setTable] = useState('');
    const [guests, setGuests] = useState(1);

    useEffect(() => {
        setTable(tableNumber || '');
        setGuests(guestCount || 1);
    }, [tableNumber, guestCount]);

    const adjustGuests = (delta) => setGuests(g => Math.max(1, Math.min(20, g + delta)));

    const handleSave = () => {
        onSave(table.trim(), guests);
        onClose();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') onClose();
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
                <div style={styles.header}>
                    <h3 style={styles.title}>Table Setup</h3>
                    <button style={styles.closeBtn} onClick={onClose}>×</button>
                </div>

                <label style={styles.label}>Table Number</label>
                <input
                    style={styles.input}
                    value={table}
                    onChange={e => setTable(e.target.value)}
                    placeholder="e.g. 5 or B3"
                    autoFocus
                />

                <label style={styles.label}>Number of Guests</label>
                <div style={styles.stepper}>
                    <button style={styles.stepBtn} onClick={() => adjustGuests(-1)}>−</button>
                    <span style={styles.stepValue}>{guests}</span>
                    <button style={styles.stepBtn} onClick={() => adjustGuests(1)}>+</button>
                </div>

                <div style={styles.actions}>
                    <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
                    <button style={styles.saveBtn} onClick={handleSave}>Save</button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modal: { backgroundColor: '#fff', borderRadius: '16px', padding: '28px', width: '320px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    title: { margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#2c2c2c' },
    closeBtn: { background: 'none', border: 'none', fontSize: '1.6rem', cursor: 'pointer', color: '#aaa', lineHeight: 1, padding: '0 4px' },
    label: { display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' },
    input: { width: '100%', boxSizing: 'border-box', border: '1px solid #e0d8c8', borderRadius: '8px', padding: '10px 14px', fontSize: '1rem', color: '#2c2c2c', backgroundColor: '#faf8f2', marginBottom: '20px', outline: 'none' },
    stepper: { display: 'flex', alignItems: 'center', gap: '0', marginBottom: '24px', border: '1px solid #e0d8c8', borderRadius: '8px', overflow: 'hidden' },
    stepBtn: { width: '44px', height: '44px', border: 'none', background: '#faf8f2', cursor: 'pointer', fontSize: '1.3rem', color: '#5a7a3a', fontWeight: 700 },
    stepValue: { flex: 1, textAlign: 'center', fontSize: '1.2rem', fontWeight: 700, color: '#2c2c2c' },
    actions: { display: 'flex', gap: '10px' },
    cancelBtn: { flex: 1, padding: '12px', border: '1px solid #e0d8c8', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '0.95rem', color: '#888' },
    saveBtn: { flex: 1, padding: '12px', border: 'none', borderRadius: '8px', background: '#5a7a3a', color: '#fff', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 700 },
};
