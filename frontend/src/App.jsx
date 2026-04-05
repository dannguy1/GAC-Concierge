import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { sendChat, fetchMenu } from './services/api';

import ChatInterface from './components/ChatInterface';
import MenuVisualizer from './components/MenuVisualizer';
import OrderPad from './components/OrderPad';
import ItemDetailModal from './components/ItemDetailModal';
import TableSetupModal from './components/TableSetupModal';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [mentionedItems, setMentionedItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  const abortControllerRef = useRef(null);
  const [isOrderPadOpen, setIsOrderPadOpen] = useState(false);
  const [language, setLanguage] = useState("English");
  const [tableNumber, setTableNumber] = useState('');
  const [guestCount, setGuestCount] = useState(1);
  const [showTableSetup, setShowTableSetup] = useState(false);

  const [allMenuItems, setAllMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('Suggested');
  const [selectedItem, setSelectedItem] = useState(null);
  const [menuError, setMenuError] = useState(false);

  // Fetch full menu on mount
  useEffect(() => {
    fetchMenu()
      .then(({ items, categories }) => {
        setAllMenuItems(items);
        setCategories(categories);
        setMenuError(false);
      })
      .catch(err => {
        console.error('Failed to load menu:', err);
        setMenuError(true);
      });
  }, []);

  // Track elapsed seconds while waiting for LLM
  useEffect(() => {
    if (!isLoading) {
      setThinkingSeconds(0);
      return;
    }
    const interval = setInterval(() => setThinkingSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  // Quietly record a cart event in history so the LLM sees it as context
  // on the next real user message — no API call, no UI output.
  const handleTableSave = (table, guests) => {
    setTableNumber(table);
    setGuestCount(guests);
    const info = [table ? `Table ${table}` : '', `${guests} guest${guests !== 1 ? 's' : ''}`].filter(Boolean).join(', ');
    addSilentSystemEvent(`[System Event] Table setup: ${info}.`);
  };

  const addSilentSystemEvent = (text) => {
    setMessages(prev => [...prev, { role: 'user', content: text, hidden: true }]);
  };

  // Fuzzy match a cart update name to the real menu item
  const findMenuItemByName = (name) => {
    const search = (name || '').toLowerCase().trim();
    const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return allMenuItems.find(i => {
      const en = i.item_name.toLowerCase();
      const viet = (i.item_viet || '').toLowerCase();
      const normViet = normalize(viet);
      const normSearch = normalize(search);
      return en === search || viet === search || normViet === normSearch
        || en.includes(search) || search.includes(en)
        || viet.includes(search) || normViet.includes(normSearch);
    });
  };

  const handleItemClick = (item) => {
    const newCart = [...cart];
    const existingIndex = newCart.findIndex(i => i.name === item.item_name);
    if (existingIndex >= 0) {
      newCart[existingIndex].qty += 1;
    } else {
      newCart.push({
        item_name: item.item_name,
        name: item.item_name,
        qty: 1,
        notes: '',
        price: item.price || 0
      });
    }
    setCart([...newCart]);
    addSilentSystemEvent(`[System Event] User explicitly clicked a button to add 1x ${item.item_name} to their order cart.`);
  };

  const handleUpdateItemQty = (item_name, delta) => {
    const newCart = [...cart];
    const index = newCart.findIndex(i => i.name === item_name);
    if (index >= 0) {
      newCart[index].qty += delta;
      if (newCart[index].qty <= 0) {
        newCart.splice(index, 1);
        addSilentSystemEvent(`[System Event] User explicitly removed ${item_name} from their order cart.`);
      } else {
        addSilentSystemEvent(`[System Event] User explicitly updated quantity of ${item_name} to ${newCart[index].qty}.`);
      }
      setCart(newCart);
      setOrderConfirmed(false);
    }
  };

  const handleRemoveItem = (item_name) => {
    const newCart = cart.filter(i => i.name !== item_name);
    setCart(newCart);
    setOrderConfirmed(false);
    addSilentSystemEvent(`[System Event] User explicitly removed ${item_name} from their order cart.`);
  };

  const handleSendMessage = async (text) => {
    const newUserMsg = { role: 'user', content: text };
    const newMessages = [...messages, newUserMsg];
    setMessages(newMessages);
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    try {
      const data = await sendChat(newMessages, language, controller.signal);

      setMessages([...newMessages, { role: 'assistant', content: data.text, language: data.language }]);

      if (data.mentioned_items && data.mentioned_items.length > 0) {
        setMentionedItems(data.mentioned_items);
        // Auto-switch to Suggested tab when agent mentions items
        setActiveCategory('Suggested');
      }

      if (data.cart_updates && data.cart_updates.length > 0) {
        let newCart = [...cart];

        data.cart_updates.forEach(update => {
          // Fuzzy-match against the full menu to get the real price
          const menuItem = findMenuItemByName(update.name);
          const price = menuItem ? menuItem.price : 0;

          const existingIndex = newCart.findIndex(i => i.name === update.name);
          if (existingIndex >= 0) {
            const existing = newCart[existingIndex];
            const merged = { ...existing, qty: existing.qty + update.qty };
            if (update.notes) {
              merged.notes = existing.notes ? `${existing.notes}, ${update.notes}` : update.notes;
            }
            newCart[existingIndex] = merged;
          } else {
            newCart.push({
              item_name: update.name,
              name: update.name,
              qty: update.qty,
              notes: update.notes,
              price
            });
          }
        });
        setCart(newCart);
      }

      if (data.general_note) {
        setGeneralNotes(data.general_note);
      }

      if (data.order_confirmed !== undefined && data.order_confirmed !== false) {
        setOrderConfirmed(true);
      }

    } catch (error) {
      console.error(error);
      const msg = error.name === 'AbortError'
        ? "I'm sorry, it's taking me longer than usual. Please try asking again."
        : 'Apologies, I am experiencing a connection issue.';
      setMessages([...newMessages, { role: 'assistant', content: msg }]);
    } finally {
      clearTimeout(timeoutId);
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <ChatInterface
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        thinkingSeconds={thinkingSeconds}
        onCancel={handleCancel}
        language={language}
        setLanguage={setLanguage}
      />
      <MenuVisualizer
        mentionedItems={menuError ? [] : mentionedItems}
        allMenuItems={menuError ? [] : allMenuItems}
        categories={menuError ? [] : categories}
        activeCategory={activeCategory}
        onCategorySelect={setActiveCategory}
        onItemClick={handleItemClick}
        onOpenDetail={setSelectedItem}
        menuError={menuError}
      />
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onAddToCart={handleItemClick}
        />
      )}
      {isOrderPadOpen && (
        <OrderPad
          cart={cart}
          generalNotes={generalNotes}
          orderConfirmed={orderConfirmed}
          tableNumber={tableNumber}
          guestCount={guestCount}
          onUpdateItemQty={handleUpdateItemQty}
          onRemoveItem={handleRemoveItem}
          onClose={() => setIsOrderPadOpen(false)}
        />
      )}
      {!isOrderPadOpen && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px', zIndex: 100 }}>
          <button
            onClick={() => setShowTableSetup(true)}
            style={{
              padding: '10px 18px',
              backgroundColor: tableNumber ? '#5a7a3a' : '#f0ece1',
              color: tableNumber ? '#fff' : '#5a7a3a',
              border: '1px solid #c8b98a',
              borderRadius: '20px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {tableNumber ? `🪑 T${tableNumber} · ${guestCount}👥` : '🪑 Set Table'}
          </button>
          <button
            onClick={() => setIsOrderPadOpen(true)}
            style={{
              padding: '16px 28px',
              backgroundColor: 'var(--color-brand-green)',
              color: 'white',
              borderRadius: '30px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              border: 'none',
              fontSize: '1.1rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background-color 0.2s ease'
            }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--color-brand-green-dark)'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = 'var(--color-brand-green)'}
          >
            <span>📋</span>
            <span>Review Order {cart.length > 0 ? `(${cart.length})` : ''}</span>
          </button>
        </div>
      )}
      {showTableSetup && (
        <TableSetupModal
          tableNumber={tableNumber}
          guestCount={guestCount}
          onSave={handleTableSave}
          onClose={() => setShowTableSetup(false)}
        />
      )}
    </div>
  );
}


