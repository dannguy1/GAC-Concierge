import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_HOST = '192.168.10.3:8000';
const STORAGE_KEY = '@gac_server_host';

// Mutable at runtime — updated by loadServerHost() / saveServerHost()
let _host = DEFAULT_HOST;

export const getServerHost = () => _host;

export const loadServerHost = async () => {
    try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) _host = saved;
    } catch (_) {}
    return _host;
};

export const saveServerHost = async (host) => {
    const clean = host.trim().replace(/\/+$/, '');
    _host = clean;
    await AsyncStorage.setItem(STORAGE_KEY, clean);
};

const baseUrl = () => `http://${_host}/v1`;
const serverUrl = () => `http://${_host}`;

export const fetchMenu = async () => {
    const response = await fetch(`${baseUrl()}/menu`);
    if (!response.ok) throw new Error('Failed to fetch menu');
    const items = await response.json();

    const categoryOrder = ['Appetizer', 'Soup', 'Salad', 'Seafood', 'Meat', 'Poultry', 'Vegetarian', 'Noodle', 'Rice', 'Dessert', 'Drink', 'Beverage'];
    const rawCategories = [...new Set(items.map(i => i.category).filter(Boolean))];
    const sortedCategories = rawCategories.sort((a, b) => {
        const ai = categoryOrder.findIndex(c => a.includes(c));
        const bi = categoryOrder.findIndex(c => b.includes(c));
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });

    return { items, categories: sortedCategories };
};

export const sendChat = async (messages, language = 'English', signal = null) => {
    const response = await fetch(`${baseUrl()}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, language }),
        ...(signal ? { signal } : {}),
    });
    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    return response.json();
};

export const sendCheckout = async (cart, generalNotes) => {
    const response = await fetch(`${baseUrl()}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart, general_notes: generalNotes }),
    });
    if (!response.ok) throw new Error('Failed to checkout');
    return response.json();
};

export const fetchTTS = async (text, language) => {
    const response = await fetch(`${baseUrl()}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
    });
    if (!response.ok) throw new Error('Failed to fetch TTS audio');
    return response.json();
};

export const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    let clean = imagePath;
    if (clean.startsWith('./')) clean = clean.slice(2);
    if (clean.startsWith('data/images/')) clean = clean.replace('data/images/', 'images/');
    if (clean.startsWith('data/downloaded_images/')) clean = clean.replace('data/downloaded_images/', 'downloaded_images/');
    if (clean.includes('..')) return null;
    return `${serverUrl()}/${clean}`;
};
