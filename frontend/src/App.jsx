import React, { useState } from 'react';
import './App.css';
import { sendChat } from './services/api';

import ChatInterface from './components/ChatInterface';
import MenuVisualizer from './components/MenuVisualizer';
import OrderPad from './components/OrderPad';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [mentionedItems, setMentionedItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOrderPadOpen, setIsOrderPadOpen] = useState(false);

  const handleItemClick = (item) => {
    // Deterministic UI Update: Directly append to cart state securely
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

    // Send a passive context message to the LLM so it is aware of the user's action
    handleSendMessage(`[System Event] User explicitly clicked a button to add 1x ${item.item_name} to their order cart.`);
  };

  const handleUpdateItemQty = (item_name, delta) => {
    const newCart = [...cart];
    const index = newCart.findIndex(i => i.name === item_name);
    if (index >= 0) {
      newCart[index].qty += delta;
      if (newCart[index].qty <= 0) {
        newCart.splice(index, 1);
        handleSendMessage(`[System Event] User explicitly removed ${item_name} from their order cart.`);
      } else {
        handleSendMessage(`[System Event] User explicitly updated quantity of ${item_name} to ${newCart[index].qty}.`);
      }
      setCart(newCart);
    }
  };

  const handleRemoveItem = (item_name) => {
    const newCart = cart.filter(i => i.name !== item_name);
    setCart(newCart);
    handleSendMessage(`[System Event] User explicitly removed ${item_name} from their order cart.`);
  };

  const handleSendMessage = async (text) => {
    // Optimistic user update
    const newUserMsg = { role: 'user', content: text };
    const newMessages = [...messages, newUserMsg];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const data = await sendChat(newMessages);

      setMessages([...newMessages, { role: 'assistant', content: data.text }]);

      // Update contextual visualizer
      if (data.mentioned_items && data.mentioned_items.length > 0) {
        setMentionedItems(data.mentioned_items);
      }

      // Process cart updates (simple merge logic)
      if (data.cart_updates && data.cart_updates.length > 0) {
        let newCart = [...cart];

        data.cart_updates.forEach(update => {
          // Find price from currently visualised items, or default to 0 (checkout handles real calculation)
          const priceLookup = (data.mentioned_items || mentionedItems).find(i => i.item_name === update.name);
          const price = priceLookup ? priceLookup.price : 0;

          const existingIndex = newCart.findIndex(i => i.name === update.name);

          if (existingIndex >= 0) {
            const existing = newCart[existingIndex];
            // Merge qty & notes
            const merged = { ...existing, qty: existing.qty + update.qty };
            if (update.notes) {
              merged.notes = existing.notes ? `${existing.notes}, ${update.notes}` : update.notes;
            }
            newCart[existingIndex] = merged;
          } else {
            newCart.push({
              item_name: update.name, // The backend API expects `item_name` during checkout
              name: update.name,      // For UI display convenience
              qty: update.qty,
              notes: update.notes,
              price: price
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
      setMessages([...newMessages, { role: 'assistant', content: 'Apologies, I am experiencing a connection issue.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <ChatInterface
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
      />
      <MenuVisualizer
        mentionedItems={mentionedItems}
        onItemClick={handleItemClick}
      />
      {isOrderPadOpen && (
        <OrderPad
          cart={cart}
          generalNotes={generalNotes}
          orderConfirmed={orderConfirmed}
          onUpdateItemQty={handleUpdateItemQty}
          onRemoveItem={handleRemoveItem}
          onClose={() => setIsOrderPadOpen(false)}
        />
      )}
      {!isOrderPadOpen && (
        <button
          onClick={() => setIsOrderPadOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            padding: '16px 28px',
            backgroundColor: 'var(--color-brand-green)',
            color: 'white',
            borderRadius: '30px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            border: 'none',
            fontSize: '1.1rem',
            fontWeight: 600,
            cursor: 'pointer',
            zIndex: 100,
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
      )}
    </div>
  );
}
