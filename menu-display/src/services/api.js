const API_BASE = '/v1';
const SERVER_BASE = '';

export const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    let clean = imagePath;
    if (clean.startsWith('./')) clean = clean.slice(2);
    if (clean.startsWith('data/images/')) clean = clean.replace('data/images/', 'images/');
    if (clean.startsWith('data/downloaded_images/')) clean = clean.replace('data/downloaded_images/', 'downloaded_images/');
    if (clean.includes('..')) return null;
    return `${SERVER_BASE}/${clean}`;
};

export const openDisplayStream = (onEvent, onError) => {
    const es = new EventSource(`${API_BASE}/display/stream`);
    es.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            if (data.items) onEvent(data.items);
        } catch (_) {}
    };
    es.onerror = onError || (() => {});
    return es;
};
