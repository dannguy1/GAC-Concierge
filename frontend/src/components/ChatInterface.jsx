import React, { useState, useRef, useEffect } from 'react';
import { fetchTTS } from '../services/api';

export default function ChatInterface({ messages, onSendMessage, isLoading, thinkingSeconds = 0, onCancel, language, setLanguage }) {
    const [input, setInput] = useState('');
    const [playingIdx, setPlayingIdx] = useState(null);
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

    const playTTS = async (text, msgLanguage, idx) => {
        // AudioContext MUST be created synchronously inside the click handler
        // so the browser's autoplay policy grants permission before the async fetch.
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioCtx();
        setPlayingIdx(idx);
        try {
            const data = await fetchTTS(text, msgLanguage || language);
            if (!data.audio_base64) return;

            const binary = atob(data.audio_base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

            const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);
            const source = audioCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioCtx.destination);
            source.onended = () => { setPlayingIdx(null); audioCtx.close(); };
            source.start(0);
        } catch (e) {
            console.error('TTS Error:', e);
            setPlayingIdx(null);
            audioCtx.close();
        }
    };

    return (
        <div className="chat-section">
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Garlic & Chives Concierge</h2>
                <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-bg-paper)',
                        fontSize: '0.9rem',
                        color: 'var(--color-text-main)',
                        cursor: 'pointer'
                    }}
                >
                    <option value="English">🇬🇧/🇺🇸 English</option>
                    <option value="Spanish">🇪🇸 Spanish</option>
                    <option value="Vietnamese">🇻🇳 Vietnamese</option>
                    <option value="Mandarin Chinese">🇨🇳 Chinese</option>
                    <option value="French">🇫🇷 French</option>
                    <option value="Italian">🇮🇹 Italian</option>
                    <option value="Portuguese">🇧🇷 Portuguese</option>
                    <option value="Hindi">🇮🇳 Hindi</option>
                    <option value="Japanese">🇯🇵 Japanese</option>
                </select>
            </div>
            <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '40px' }}>
                        <p style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif)', fontSize: '1.2rem' }}>
                            "Welcome to Garlic & Chives. How may I assist you today?"
                        </p>
                    </div>
                )}

                {messages.filter(msg => msg.role !== 'system' && !msg.hidden).map((msg, idx) => (
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
                            <button onClick={() => playTTS(msg.content, msg.language, idx)} disabled={playingIdx !== null} style={{
                                marginTop: '12px', fontSize: '0.8rem', color: 'var(--color-brand-gold)', textDecoration: 'underline', fontWeight: 500,
                                background: 'none', border: 'none', cursor: playingIdx !== null ? 'default' : 'pointer', padding: 0,
                                opacity: playingIdx !== null && playingIdx !== idx ? 0.5 : 1
                            }}>
                                {playingIdx === idx ? '🔊 Playing...' : '▶ Play Voice'}
                            </button>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div style={{ alignSelf: 'flex-start', padding: '10px 20px' }}>
                        <span style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                            {thinkingSeconds < 15
                                ? `Drafting response${thinkingSeconds > 4 ? ` (${thinkingSeconds}s)` : ''}...`
                                : `Kristin is taking a moment to think... (${thinkingSeconds}s)`}
                        </span>
                        {thinkingSeconds >= 20 && (
                            <button
                                onClick={onCancel}
                                style={{
                                    marginLeft: '12px', fontSize: '0.8rem', color: 'var(--color-brand-gold)',
                                    textDecoration: 'underline', fontWeight: 500, background: 'none',
                                    border: 'none', cursor: 'pointer', padding: 0
                                }}
                            >
                                Cancel
                            </button>
                        )}
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
