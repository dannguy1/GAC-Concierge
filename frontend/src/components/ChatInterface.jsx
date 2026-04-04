import React, { useState, useRef, useEffect } from 'react';
import { fetchTTS } from '../services/api';

export default function ChatInterface({ messages, onSendMessage, isLoading }) {
    const [input, setInput] = useState('');
    const endOfMessagesRef = useRef(null);

    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        onSendMessage(input);
        setInput('');
    };

    const playTTS = async (text) => {
        try {
            const data = await fetchTTS(text);
            if (data.audio_base64) {
                const audio = new Audio("data:audio/wav;base64," + data.audio_base64);
                audio.play();
            }
        } catch (e) {
            console.error("TTS Error:", e);
        }
    };

    return (
        <div className="chat-section">
            <div className="panel-header">
                <h2>Garlic & Chives Concierge</h2>
            </div>
            <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '40px' }}>
                        <p style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif)', fontSize: '1.2rem' }}>
                            "Welcome to Garlic & Chives. How may I assist you today?"
                        </p>
                    </div>
                )}

                {messages.filter(msg => msg.role !== 'system').map((msg, idx) => (
                    <div key={idx} style={{
                        alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        backgroundColor: msg.role === 'user' ? '#f0ece1' : 'var(--color-card-bg)',
                        padding: '16px 20px',
                        borderRadius: msg.role === 'user' ? '16px 16px 0 16px' : '16px 16px 16px 0',
                        border: msg.role === 'assistant' ? '1px solid var(--color-border)' : 'none',
                        boxShadow: 'var(--shadow-sm)'
                    }}>
                        <strong style={{
                            display: 'block', marginBottom: '4px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px',
                            color: msg.role === 'user' ? 'var(--color-text-muted)' : 'var(--color-brand-green)'
                        }}>
                            {msg.role === 'user' ? 'Guest' : 'Concierge'}
                        </strong>
                        <div style={{ whiteSpace: 'pre-wrap', color: 'var(--color-text-main)' }}>{msg.content}</div>

                        {msg.role === 'assistant' && (
                            <button onClick={() => playTTS(msg.content)} style={{
                                marginTop: '12px', fontSize: '0.8rem', color: 'var(--color-brand-gold)', textDecoration: 'underline', fontWeight: 500
                            }}>
                                ▶ Play Voice
                            </button>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div style={{ alignSelf: 'flex-start', fontStyle: 'italic', color: 'var(--color-text-muted)', padding: '10px 20px' }}>
                        Drafting response...
                    </div>
                )}
                <div ref={endOfMessagesRef} />
            </div>

            <div style={{ padding: '24px', borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-card-bg)', zIndex: 20 }}>
                <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px' }}>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your question or order..."
                        disabled={isLoading}
                        style={{
                            flex: 1, padding: '16px 20px', borderRadius: '30px', border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-bg-paper)', fontSize: '1rem'
                        }}
                    />
                    <button
                        type="submit"
                        disabled={isLoading}
                        style={{
                            padding: '0 32px', borderRadius: '30px', backgroundColor: 'var(--color-brand-green)', color: 'white', fontWeight: 600,
                            opacity: isLoading ? 0.7 : 1
                        }}
                    >
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
}
