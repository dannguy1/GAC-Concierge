import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform, StatusBar,
    useWindowDimensions, Alert,
} from 'react-native';
import { sendChat, fetchMenu, loadServerHost } from './services/api';
import ChatInterface from './components/ChatInterface';
import MenuVisualizer from './components/MenuVisualizer';
import OrderPad from './components/OrderPad';
import ItemDetailModal from './components/ItemDetailModal';
import SettingsModal from './components/SettingsModal';
import TableSetupModal from './components/TableSetupModal';

const TABS = [
    { key: 'chat', label: '💬 Chat' },
    { key: 'menu', label: '🍽 Menu' },
    { key: 'order', label: '📋 Order' },
];

export default function App() {
    const [activeTab, setActiveTab] = useState('chat');
    const [messages, setMessages] = useState([]);
    const [mentionedItems, setMentionedItems] = useState([]);
    const [cart, setCart] = useState([]);
    const [generalNotes, setGeneralNotes] = useState('');
    const [orderConfirmed, setOrderConfirmed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [thinkingSeconds, setThinkingSeconds] = useState(0);
    const [language, setLanguage] = useState('English');
    const [allMenuItems, setAllMenuItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeCategory, setActiveCategory] = useState('Suggested');
    const [selectedItem, setSelectedItem] = useState(null);
    const abortControllerRef = useRef(null);

    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;
    const [rightTab, setRightTab] = useState('menu');
    const [showSettings, setShowSettings] = useState(false);
    const [showTableSetup, setShowTableSetup] = useState(false);
    const [tableNumber, setTableNumber] = useState('');
    const [guestCount, setGuestCount] = useState(1);

    const [menuError, setMenuError] = useState(false);

    // Load saved server host, then fetch menu
    useEffect(() => {
        loadServerHost().then(() => {
            fetchMenu()
                .then(({ items, categories }) => { setAllMenuItems(items); setCategories(categories); setMenuError(false); })
                .catch(err => { console.error('Failed to load menu:', err); setMenuError(true); });
        });
    }, []);

    useEffect(() => {
        if (!isLoading) { setThinkingSeconds(0); return; }
        const interval = setInterval(() => setThinkingSeconds(s => s + 1), 1000);
        return () => clearInterval(interval);
    }, [isLoading]);

    const handleCancel = () => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
    };

    const handleNewSession = () => {
        Alert.alert(
            'Start New Session?',
            'This will clear the current conversation, cart, and order.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'New Session',
                    style: 'destructive',
                    onPress: () => {
                        abortControllerRef.current?.abort();
                        abortControllerRef.current = null;
                        setMessages([]);
                        setCart([]);
                        setMentionedItems([]);
                        setGeneralNotes('');
                        setOrderConfirmed(false);
                        setActiveCategory('Suggested');
                        setActiveTab('chat');
                        setRightTab('menu');
                        setIsLoading(false);
                        setTableNumber('');
                        setGuestCount(1);
                    },
                },
            ]
        );
    };

    const handleTableSave = (table, guests) => {
        setTableNumber(table);
        setGuestCount(guests);
        const info = [table ? `Table ${table}` : '', `${guests} guest${guests !== 1 ? 's' : ''}`].filter(Boolean).join(', ');
        addSilentSystemEvent(`[System Event] Table setup: ${info}.`);
    };

    const addSilentSystemEvent = (text) => {
        setMessages(prev => [...prev, { role: 'user', content: text, hidden: true }]);
    };

    const findMenuItemByName = (name) => {
        const search = (name || '').toLowerCase().trim();
        const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return allMenuItems.find(i => {
            const en = i.item_name.toLowerCase();
            const viet = (i.item_viet || '').toLowerCase();
            return en === search || viet === search
                || normalize(viet) === normalize(search)
                || en.includes(search) || search.includes(en);
        });
    };

    const handleItemClick = (item) => {
        const newCart = [...cart];
        const idx = newCart.findIndex(i => i.name === item.item_name);
        if (idx >= 0) {
            newCart[idx].qty += 1;
        } else {
            newCart.push({ item_name: item.item_name, name: item.item_name, qty: 1, notes: '', price: item.price || 0 });
        }
        setCart(newCart);
        addSilentSystemEvent(`[System Event] User explicitly clicked a button to add 1x ${item.item_name} to their order cart.`);
    };

    const handleUpdateItemQty = (item_name, delta) => {
        const newCart = [...cart];
        const idx = newCart.findIndex(i => i.name === item_name);
        if (idx >= 0) {
            newCart[idx].qty += delta;
            if (newCart[idx].qty <= 0) {
                newCart.splice(idx, 1);
                addSilentSystemEvent(`[System Event] User explicitly removed ${item_name} from their order cart.`);
            } else {
                addSilentSystemEvent(`[System Event] User explicitly updated quantity of ${item_name} to ${newCart[idx].qty}.`);
            }
            setCart(newCart);
        }
    };

    const handleRemoveItem = (item_name) => {
        setCart(cart.filter(i => i.name !== item_name));
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

            if (data.mentioned_items?.length > 0) {
                setMentionedItems(data.mentioned_items);
                setActiveCategory('Suggested');
            }
            if (data.cart_updates?.length > 0) {
                let newCart = [...cart];
                data.cart_updates.forEach(update => {
                    const menuItem = findMenuItemByName(update.name);
                    const price = menuItem ? menuItem.price : 0;
                    const existing = newCart.findIndex(i => i.name === update.name);
                    if (existing >= 0) {
                        newCart[existing].qty += update.qty;
                        if (update.notes) newCart[existing].notes = [newCart[existing].notes, update.notes].filter(Boolean).join(', ');
                    } else {
                        newCart.push({ item_name: update.name, name: update.name, qty: update.qty, notes: update.notes || '', price });
                    }
                });
                setCart(newCart);
            }
            if (data.general_note) setGeneralNotes(data.general_note);
            if (data.order_confirmed) setOrderConfirmed(true);
        } catch (error) {
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

    const renderScreen = () => {
        switch (activeTab) {
            case 'chat':
                return (
                    <ChatInterface
                        messages={messages}
                        onSendMessage={handleSendMessage}
                        isLoading={isLoading}
                        thinkingSeconds={thinkingSeconds}
                        onCancel={handleCancel}
                        language={language}
                        setLanguage={setLanguage}
                    />
                );
            case 'menu':
                return menuError ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                        <Text style={{ fontSize: 32, marginBottom: 12 }}>⚠️</Text>
                        <Text style={{ fontSize: 15, color: '#888', textAlign: 'center' }}>
                            Could not load menu.{'\n'}Check server settings (⚙️) and try again.
                        </Text>
                    </View>
                ) : (
                    <MenuVisualizer
                        mentionedItems={mentionedItems}
                        allMenuItems={allMenuItems}
                        categories={categories}
                        activeCategory={activeCategory}
                        onCategorySelect={setActiveCategory}
                        onItemClick={handleItemClick}
                        onOpenDetail={setSelectedItem}
                    />
                );
            case 'order':
                return (
                    <OrderPad
                        cart={cart}
                        generalNotes={generalNotes}
                        orderConfirmed={orderConfirmed}
                        onUpdateItemQty={handleUpdateItemQty}
                        onRemoveItem={handleRemoveItem}
                    />
                );
        }
    };

    const chatProps = {
        messages,
        onSendMessage: handleSendMessage,
        isLoading,
        thinkingSeconds,
        onCancel: handleCancel,
        language,
        setLanguage,
    };

    const menuProps = {
        mentionedItems,
        allMenuItems,
        categories,
        activeCategory,
        onCategorySelect: setActiveCategory,
        onItemClick: handleItemClick,
        onOpenDetail: setSelectedItem,
    };

    const orderProps = {
        cart,
        generalNotes,
        orderConfirmed,
        tableNumber,
        guestCount,
        onUpdateItemQty: handleUpdateItemQty,
        onRemoveItem: handleRemoveItem,
    };

    if (isLandscape) {
        return (
            <SafeAreaView style={styles.safe}>
                <StatusBar barStyle="dark-content" backgroundColor="#fff" />

                {/* Slim full-width title — spans both panels so they start at the same Y */}
                <View style={styles.lsTitleBar}>
                    <TouchableOpacity style={styles.newSessionBtn} onPress={handleNewSession}>
                        <Text style={styles.newSessionIcon}>↺</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowTableSetup(true)} style={styles.tableBadge}>
                        <Text style={styles.tableBadgeText}>
                            {tableNumber ? `🪑 T${tableNumber} · ${guestCount}👥` : '🪑 Set Table'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.gearBtn} onPress={() => setShowSettings(true)}>
                        <Text style={styles.gearIcon}>⚙️</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.lsContainer}>
                    {/* Left panel: Chat (picker is the top bar) */}
                    <View style={styles.lsLeft}>
                        <ChatInterface {...chatProps} />
                    </View>

                    <View style={styles.lsDivider} />

                    {/* Right panel: Menu / Order */}
                    <View style={styles.lsRight}>
                        <View style={styles.lsRightTabBar}>
                            <TouchableOpacity
                                style={[styles.lsRightTab, rightTab === 'menu' && styles.lsRightTabActive]}
                                onPress={() => setRightTab('menu')}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.lsRightTabText, rightTab === 'menu' && styles.lsRightTabTextActive]}>
                                    🍽 Menu
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.lsRightTab, rightTab === 'order' && styles.lsRightTabActive]}
                                onPress={() => setRightTab('order')}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.lsRightTabText, rightTab === 'order' && styles.lsRightTabTextActive]}>
                                    📋 Order{cart.length > 0 ? ` (${cart.length})` : ''}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        {rightTab === 'menu'
                            ? <MenuVisualizer {...menuProps} />
                            : <OrderPad {...orderProps} />
                        }
                    </View>
                </View>

                {selectedItem && (
                    <ItemDetailModal
                        item={selectedItem}
                        onClose={() => setSelectedItem(null)}
                        onAddToCart={handleItemClick}
                    />
                )}

                <TableSetupModal
                    visible={showTableSetup}
                    tableNumber={tableNumber}
                    guestCount={guestCount}
                    onSave={handleTableSave}
                    onClose={() => setShowTableSetup(false)}
                />

                <SettingsModal
                    visible={showSettings}
                    onClose={(hostChanged) => {
                        setShowSettings(false);
                        if (hostChanged) {
                            fetchMenu()
                                .then(({ items, categories }) => { setAllMenuItems(items); setCategories(categories); setMenuError(false); })
                                .catch(err => { console.error('Failed to reload menu:', err); setMenuError(true); });
                        }
                    }}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safe}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />

            {/* Screen title bar */}
            <View style={styles.titleBar}>
                <TouchableOpacity style={styles.newSessionBtn} onPress={handleNewSession}>
                    <Text style={styles.newSessionIcon}>↺</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowTableSetup(true)} style={styles.tableBadge}>
                    <Text style={styles.tableBadgeText}>
                        {tableNumber ? `🪑 T${tableNumber} · ${guestCount}👥` : '🪑 Set Table'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.gearBtn} onPress={() => setShowSettings(true)}>
                    <Text style={styles.gearIcon}>⚙️</Text>
                </TouchableOpacity>
            </View>

            {/* Main content */}
            <View style={styles.content}>{renderScreen()}</View>

            {/* Bottom tab bar */}
            <View style={styles.tabBar}>
                {TABS.map(tab => {
                    const isActive = activeTab === tab.key;
                    const badge = tab.key === 'order' && cart.length > 0 ? cart.length : null;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={styles.tabItem}
                            onPress={() => setActiveTab(tab.key)}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
                            {badge && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{badge}</Text>
                                </View>
                            )}
                            {isActive && <View style={styles.tabIndicator} />}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {selectedItem && (
                <ItemDetailModal
                    item={selectedItem}
                    onClose={() => setSelectedItem(null)}
                    onAddToCart={handleItemClick}
                />
            )}

            <TableSetupModal
                visible={showTableSetup}
                tableNumber={tableNumber}
                guestCount={guestCount}
                onSave={handleTableSave}
                onClose={() => setShowTableSetup(false)}
            />

            <SettingsModal
                visible={showSettings}
                onClose={(hostChanged) => {
                    setShowSettings(false);
                    if (hostChanged) {
                        fetchMenu()
                            .then(({ items, categories }) => { setAllMenuItems(items); setCategories(categories); })
                            .catch(err => console.error('Failed to reload menu:', err));
                    }
                }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },

    // ── Portrait ──────────────────────────────────────────────────────────────
    titleBar: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e0d8c8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    titleText: { fontSize: 17, fontWeight: '700', color: '#2c2c2c', textAlign: 'center', flex: 1 },
    tableBadge: { flex: 1, alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#f0ece1', borderRadius: 16 },
    tableBadgeText: { fontSize: 13, fontWeight: '700', color: '#5a7a3a' },
    gearBtn: { position: 'absolute', right: 16, padding: 4 },
    gearIcon: { fontSize: 20 },
    newSessionBtn: { position: 'absolute', left: 16, padding: 4 },
    newSessionIcon: { fontSize: 22, color: '#5a7a3a', fontWeight: '700' },
    content: { flex: 1 },
    tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0d8c8', paddingBottom: Platform.OS === 'ios' ? 20 : 4 },
    tabItem: { flex: 1, alignItems: 'center', paddingVertical: 10, position: 'relative' },
    tabLabel: { fontSize: 13, color: '#888', fontWeight: '600' },
    tabLabelActive: { color: '#5a7a3a' },
    tabIndicator: { position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 3, backgroundColor: '#5a7a3a', borderRadius: 2 },
    badge: { position: 'absolute', top: 4, right: '18%', backgroundColor: '#c8a84b', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

    // ── Landscape ─────────────────────────────────────────────────────────────
    lsTitleBar: { backgroundColor: '#fff', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#e0d8c8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    lsTitleText: { fontSize: 14, fontWeight: '700', color: '#2c2c2c', textAlign: 'center', flex: 1 },
    lsContainer: { flex: 1, flexDirection: 'row' },
    lsLeft: { flex: 1, borderRightWidth: 1, borderRightColor: '#e0d8c8' },
    lsDivider: { width: 1, backgroundColor: '#e0d8c8' },
    lsRight: { flex: 1 },
    lsRightTabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0d8c8', height: 56, alignItems: 'center' },
    lsRightTab: { flex: 1, height: 56, justifyContent: 'center', alignItems: 'center' },
    lsRightTabActive: { borderBottomWidth: 3, borderBottomColor: '#5a7a3a' },
    lsRightTabText: { fontSize: 13, fontWeight: '600', color: '#888' },
    lsRightTabTextActive: { color: '#5a7a3a' },
});

