const API_BASE_URL = 'http://127.0.0.1:8000/v1';

export const fetchMenu = async () => {
    const response = await fetch(`${API_BASE_URL}/menu`);
    if (!response.ok) throw new Error('Failed to fetch menu');
    return response.json();
};

export const sendChat = async (messages, language = "English") => {
    const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, language })
    });
    if (!response.ok) throw new Error('Failed to send chat');
    return response.json();
};

export const sendCheckout = async (cart, generalNotes) => {
    const response = await fetch(`${API_BASE_URL}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart: cart, general_notes: generalNotes })
    });
    if (!response.ok) throw new Error('Failed to checkout');
    return response.json();
};

export const fetchTTS = async (text) => {
    const response = await fetch(`${API_BASE_URL}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });
    if (!response.ok) throw new Error('Failed to fetch TTS audio');
    return response.json();
};

// Map backend images nicely
export const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    return `http://127.0.0.1:8000/${imagePath}`;
};
