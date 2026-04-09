import React, { useState, useEffect, useRef, useCallback } from 'react';
import DisplayCard from './components/DisplayCard';
import { openDisplayStream } from './services/api';
import './App.css';

const ITEM_DISPLAY_SECONDS = 8;
const TRANSITION_MS = 700;

export default function App() {
    // slides: [{id, item, exiting}] — may hold two cards during transition
    const [slides, setSlides] = useState([]);
    const [connected, setConnected] = useState(false);
    const queueRef = useRef([]);
    const indexRef = useRef(0);
    const timerRef = useRef(null);
    const exitTimerRef = useRef(null);

    const advance = useCallback((queue) => {
        if (!queue || queue.length === 0) return;
        const idx = indexRef.current % queue.length;
        const next = queue[idx];
        indexRef.current = idx + 1;

        // Mark all current slides as exiting, push the new one as entering
        setSlides(prev => [
            ...prev.map(s => ({ ...s, exiting: true })),
            { id: `${next.item_name}-${Date.now()}`, item: next, exiting: false },
        ]);

        // Remove exited slides after the animation completes
        if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
        exitTimerRef.current = setTimeout(() => {
            setSlides(prev => prev.filter(s => !s.exiting));
        }, TRANSITION_MS + 50);
    }, []);

    const handleEvent = useCallback((items) => {
        if (!items || items.length === 0) return;
        queueRef.current = items;
        indexRef.current = 0;
        if (timerRef.current) clearInterval(timerRef.current);
        advance(items);
        timerRef.current = setInterval(
            () => advance(queueRef.current),
            ITEM_DISPLAY_SECONDS * 1000
        );
    }, [advance]);

    useEffect(() => {
        const es = openDisplayStream(
            (items) => { setConnected(true); handleEvent(items); },
            () => setConnected(false)
        );
        es.addEventListener('ping', () => setConnected(true));
        return () => {
            es.close();
            if (timerRef.current) clearInterval(timerRef.current);
            if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
        };
    }, [handleEvent]);

    return (
        <div className="display-root">
            <div className="display-stage">
                {slides.length === 0 && (
                    <div className="display-idle">
                        <div className="display-idle__logo">Garlic &amp; Chives</div>
                        <div className="display-idle__divider" />
                        <div className="display-idle__sub">
                            {connected ? 'Featured dishes loading…' : 'Connecting to server…'}
                        </div>
                    </div>
                )}
                {slides.map(({ id, item, exiting }) => (
                    <div key={id} className={`display-slot ${exiting ? 'slide-out' : 'slide-in'}`}>
                        <DisplayCard item={item} />
                    </div>
                ))}
            </div>
            <div className={`display-status ${connected ? 'display-status--live' : 'display-status--off'}`}>
                {connected ? '● LIVE' : '○ CONNECTING'}
            </div>
        </div>
    );
}
