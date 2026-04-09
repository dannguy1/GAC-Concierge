import React, { useState, useEffect, useRef } from 'react';
import DisplayCard from './components/DisplayCard';
import { openDisplayStream } from './services/api';
import './App.css';

const ITEM_DISPLAY_SECONDS = 8;

export default function App() {
    const [queue, setQueue] = useState([]);
    const [currentItem, setCurrentItem] = useState(null);
    const [connected, setConnected] = useState(false);
    const indexRef = useRef(0);
    const timerRef = useRef(null);

    // Advance to next item in the current queue
    const advanceItem = (items) => {
        if (!items || items.length === 0) return;
        const idx = indexRef.current % items.length;
        setCurrentItem(items[idx]);
        indexRef.current = idx + 1;
    };

    // When a new event arrives, replace the queue and restart cycling
    const handleEvent = (items) => {
        if (!items || items.length === 0) return;
        setQueue(items);
        indexRef.current = 0;
        if (timerRef.current) clearInterval(timerRef.current);
        advanceItem(items);
        timerRef.current = setInterval(() => advanceItem(items), ITEM_DISPLAY_SECONDS * 1000);
    };

    useEffect(() => {
        const es = openDisplayStream(
            (items) => {
                setConnected(true);
                handleEvent(items);
            },
            () => setConnected(false)
        );
        es.addEventListener('ping', () => setConnected(true));
        return () => {
            es.close();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    return (
        <div className="display-root">
            {currentItem ? (
                <DisplayCard key={currentItem.item_name + indexRef.current} item={currentItem} />
            ) : (
                <div className="display-idle">
                    <div className="display-idle__logo">Garlic &amp; Chives</div>
                    <div className="display-idle__divider" />
                    <div className="display-idle__sub">
                        {connected ? 'Featured dishes loading…' : 'Connecting to server…'}
                    </div>
                </div>
            )}
            <div className={`display-status ${connected ? 'display-status--live' : 'display-status--off'}`}>
                {connected ? '● LIVE' : '○ CONNECTING'}
            </div>
        </div>
    );
}
