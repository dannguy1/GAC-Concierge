import React, { useState, useRef } from 'react';
import { sendCheckout } from '../services/api';

export default function OrderPad({ cart, generalNotes, orderConfirmed, tableNumber, guestCount, onUpdateItemQty, onRemoveItem, onClose }) {
    const [checkoutStatus, setCheckoutStatus] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const statusTimerRef = useRef(null);

    const calculateTotal = () => {
        return cart.reduce((total, item) => total + (item.price || 0) * (item.qty || 1), 0).toFixed(2);
    };

    const handleCheckout = async () => {
        try {
            setIsSubmitting(true);
            setCheckoutStatus('Submitting to kitchen...');
            const result = await sendCheckout(cart, generalNotes);
            const msg = result.message || 'Order Successfully Placed!';
            setCheckoutStatus(msg);
            clearTimeout(statusTimerRef.current);
            statusTimerRef.current = setTimeout(() => setCheckoutStatus(''), 5000);
        } catch (e) {
            console.error(e);
            setCheckoutStatus('Failed to submit order. Please alert staff.');
            clearTimeout(statusTimerRef.current);
            statusTimerRef.current = setTimeout(() => setCheckoutStatus(''), 5000);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="order-pad-section">
            <div className="panel-header" style={{ borderBottom: '2px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ color: 'var(--color-text-main)', margin: 0 }}>Waitstaff Pad</h2>
                {onClose && (
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', fontSize: '1.8rem', cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1, padding: '0 8px' }}
                        title="Hide Pad"
                    >×</button>
                )}
            </div>

            <div className="panel-content" style={{ fontFamily: 'monospace', fontSize: '0.95rem' }}>
                {/* Table/Ticket Info */}
                <div style={{ borderBottom: '1px dashed var(--color-border)', paddingBottom: '16px', marginBottom: '16px' }}>
                    <div><strong>DATE:</strong> {new Date().toLocaleDateString()}</div>
                    <div><strong>TABLE:</strong> {tableNumber || '—'}</div>
                    <div><strong>GUESTS:</strong> {guestCount || '—'}</div>
                    <div><strong>SERVER:</strong> Kristin (AI)</div>
                </div>

                {/* Global Notes / Allergies */}
                {generalNotes && (
                    <div style={{
                        backgroundColor: 'var(--color-bg-paper)', padding: '12px', borderRadius: '4px', borderLeft: '4px solid #d32f2f',
                        marginBottom: '20px', color: '#d32f2f', fontWeight: 600
                    }}>
                        WARNING NOTES:
                        <div style={{ fontWeight: 'normal', marginTop: '4px' }}>{generalNotes}</div>
                    </div>
                )}

                {/* Cart Items */}
                <div style={{ minHeight: '200px' }}>
                    {cart.length === 0 ? (
                        <div style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>No items penciled in yet...</div>
                    ) : (
                        cart.map((item, idx) => (
                            <div key={idx} style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button
                                            onClick={() => onRemoveItem && onRemoveItem(item.name)}
                                            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '0', fontSize: '1.2rem', lineHeight: 1 }}
                                            title="Remove item"
                                        >×</button>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <button onClick={() => onUpdateItemQty && onUpdateItemQty(item.name, -1)} style={{ cursor: 'pointer', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '2px', width: '20px' }}>-</button>
                                            <span style={{ display: 'inline-block', width: '20px', textAlign: 'center' }}>{item.qty}</span>
                                            <button onClick={() => onUpdateItemQty && onUpdateItemQty(item.name, 1)} style={{ cursor: 'pointer', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '2px', width: '20px' }}>+</button>
                                        </span>
                                        <span style={{ marginLeft: '4px' }}>x {item.name}</span>
                                    </div>
                                    <span>${((item.price || 0) * (item.qty || 1)).toFixed(2)}</span>
                                </div>
                                {item.notes && (
                                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginLeft: '24px' }}>
                                        - {item.notes}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Totals & Checkout */}
                {cart.length > 0 && (
                    <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '2px dashed var(--color-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 700, marginBottom: '24px' }}>
                            <span>Subtotal:</span>
                            <span>${calculateTotal()}</span>
                        </div>

                        <button
                            onClick={handleCheckout}
                            disabled={!orderConfirmed || isSubmitting}
                            style={{
                                width: '100%',
                                padding: '16px',
                                backgroundColor: orderConfirmed ? 'var(--color-text-main)' : 'var(--color-border)',
                                color: orderConfirmed ? 'white' : 'var(--color-text-muted)',
                                borderRadius: 'var(--radius-md)',
                                fontWeight: 600,
                                fontSize: '1.1rem',
                                cursor: orderConfirmed ? 'pointer' : 'not-allowed',
                                transition: 'background-color 0.2s'
                            }}
                        >
                            {checkoutStatus || (orderConfirmed ? 'Send to Kitchen' : 'Confirm Order First')}
                        </button>
                        {!orderConfirmed && (
                            <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                                Please confirm the readback with your concierge to unlock.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
