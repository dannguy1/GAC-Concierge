import React from 'react';
import { getImageUrl } from '../services/api';

export default function MenuVisualizer({ mentionedItems, onItemClick }) {
    if (!mentionedItems || mentionedItems.length === 0) {
        return (
            <div className="visualizer-section">
                <div className="panel-header">
                    <h2>Menu Visualizer</h2>
                </div>
                <div className="panel-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                    <p style={{ textAlign: 'center', fontFamily: 'var(--font-serif)' }}>No items currently referenced.</p>
                </div>
            </div>
        );
    }

    // Deduplicate items securely based on item_name
    const uniqueItems = Array.from(new Map(mentionedItems.map(item => [item.item_name, item])).values());

    return (
        <div className="visualizer-section">
            <div className="panel-header">
                <h2>Suggested Context</h2>
            </div>
            <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {uniqueItems.map((item, idx) => (
                    <div key={idx} style={{
                        backgroundColor: 'var(--color-bg-paper)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        overflow: 'hidden',
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'transform 0.2s ease',
                        cursor: 'pointer'
                    }}
                        onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        {item.image_path && (
                            <img
                                src={getImageUrl(item.image_path)}
                                alt={item.item_name}
                                style={{ width: '100%', height: '180px', objectFit: 'cover', borderBottom: '1px solid var(--color-border)' }}
                            />
                        )}
                        <div style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--color-brand-green-dark)' }}>{item.item_name}</h3>
                                <span style={{ fontWeight: 600, color: 'var(--color-brand-gold)' }}>
                                    ${(item.price || 0).toFixed(2)}
                                </span>
                            </div>
                            {item.item_viet && (
                                <div style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                                    {item.item_viet}
                                </div>
                            )}
                            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-main)', margin: 0 }}>
                                {item.description}
                            </p>
                            <div style={{ marginTop: '16px', textAlign: 'center' }}>
                                <button
                                    style={{
                                        width: '100%', padding: '8px', borderRadius: '4px',
                                        backgroundColor: 'var(--color-brand-green)', color: 'white',
                                        fontWeight: 600, fontSize: '0.9rem'
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onItemClick) onItemClick(item);
                                    }}
                                >
                                    + Add to Order
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
