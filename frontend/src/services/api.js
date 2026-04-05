const API_BASE_URL = '/v1';

export const fetchMenu = async () => {
    const response = await fetch(`${API_BASE_URL}/menu`);
    if (!response.ok) throw new Error('Failed to fetch menu');
    const items = await response.json();

    // Extract and sort unique categories
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

export const sendChat = async (messages, language = "English", signal = null) => {
    const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, language }),
        ...(signal ? { signal } : {})
    });
    if (!response.ok) throw new Error(`Server error: ${response.status}`);
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

export const fetchTTS = async (text, language) => {
    const response = await fetch(`${API_BASE_URL}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language })
    });
    if (!response.ok) throw new Error('Failed to fetch TTS audio');
    return response.json();
};

// Map backend images nicely
export const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    let clean = imagePath;
    // Strip leading ./
    if (clean.startsWith('./')) clean = clean.slice(2);
    // Normalize data/ prefix that the backend doesn't serve at root
    if (clean.startsWith('data/images/')) clean = clean.replace('data/images/', 'images/');
    if (clean.startsWith('data/downloaded_images/')) clean = clean.replace('data/downloaded_images/', 'downloaded_images/');
    // Block directory traversal
    if (clean.includes('..')) return null;
    return `/${clean}`;
};
