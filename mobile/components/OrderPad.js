import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { sendCheckout } from '../services/api';

export default function OrderPad({ cart, generalNotes, orderConfirmed, onUpdateItemQty, onRemoveItem }) {
    const [checkoutStatus, setCheckoutStatus] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const subtotal = cart.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 1), 0).toFixed(2);

    const handleCheckout = async () => {
        try {
            setIsSubmitting(true);
            setCheckoutStatus('Submitting to kitchen...');
            const result = await sendCheckout(cart, generalNotes);
            setCheckoutStatus(result.message || 'Order Successfully Placed!');
        } catch (e) {
            console.error(e);
            setCheckoutStatus('Failed to submit order. Please alert staff.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Header info */}
            <View style={styles.receipt}>
                <Text style={styles.receiptLine}><Text style={styles.receiptLabel}>DATE: </Text>{new Date().toLocaleDateString()}</Text>
                <Text style={styles.receiptLine}><Text style={styles.receiptLabel}>TABLE: </Text>TBD</Text>
                <Text style={styles.receiptLine}><Text style={styles.receiptLabel}>SERVER: </Text>Kristin (AI)</Text>
            </View>

            {/* Allergy / global notes */}
            {!!generalNotes && (
                <View style={styles.allergyBox}>
                    <Text style={styles.allergyTitle}>⚠ WARNING NOTES:</Text>
                    <Text style={styles.allergyText}>{generalNotes}</Text>
                </View>
            )}

            {/* Cart items */}
            {cart.length === 0 ? (
                <Text style={styles.emptyText}>No items penciled in yet...</Text>
            ) : (
                cart.map((item, idx) => (
                    <View key={idx} style={styles.cartItem}>
                        <View style={styles.cartItemTop}>
                            <View style={styles.cartItemLeft}>
                                <TouchableOpacity onPress={() => onRemoveItem && onRemoveItem(item.name)} style={styles.removeBtn}>
                                    <Text style={styles.removeBtnText}>×</Text>
                                </TouchableOpacity>
                                <View style={styles.qtyRow}>
                                    <TouchableOpacity style={styles.qtyBtn} onPress={() => onUpdateItemQty && onUpdateItemQty(item.name, -1)}>
                                        <Text style={styles.qtyBtnText}>−</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.qtyNum}>{item.qty}</Text>
                                    <TouchableOpacity style={styles.qtyBtn} onPress={() => onUpdateItemQty && onUpdateItemQty(item.name, 1)}>
                                        <Text style={styles.qtyBtnText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.cartItemName} numberOfLines={1}>× {item.name}</Text>
                            </View>
                            <Text style={styles.cartItemPrice}>${((item.price || 0) * (item.qty || 1)).toFixed(2)}</Text>
                        </View>
                        {!!item.notes && <Text style={styles.cartItemNotes}>— {item.notes}</Text>}
                    </View>
                ))
            )}

            {/* Subtotal + checkout */}
            {cart.length > 0 && (
                <View style={styles.footer}>
                    <View style={styles.subtotalRow}>
                        <Text style={styles.subtotalLabel}>Subtotal:</Text>
                        <Text style={styles.subtotalValue}>${subtotal}</Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.checkoutBtn, (!orderConfirmed || isSubmitting) && styles.checkoutBtnDisabled]}
                        onPress={handleCheckout}
                        disabled={!orderConfirmed || isSubmitting}
                        activeOpacity={0.85}
                    >
                        {isSubmitting
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.checkoutBtnText}>
                                {checkoutStatus || (orderConfirmed ? '✓ Send to Kitchen' : '🔒 Confirm Order First')}
                              </Text>
                        }
                    </TouchableOpacity>

                    {!orderConfirmed && (
                        <Text style={styles.hint}>Please confirm the readback with your concierge to unlock.</Text>
                    )}
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#faf8f2' },
    content: { padding: 16, paddingBottom: 40 },
    receipt: { backgroundColor: '#fff', borderRadius: 8, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#e0d8c8', fontFamily: 'monospace' },
    receiptLabel: { fontWeight: '700', color: '#2c2c2c' },
    receiptLine: { fontSize: 13, color: '#555', marginBottom: 2 },
    allergyBox: { backgroundColor: '#fff5f5', borderLeftWidth: 4, borderLeftColor: '#d32f2f', borderRadius: 4, padding: 12, marginBottom: 16 },
    allergyTitle: { color: '#d32f2f', fontWeight: '700', fontSize: 13, marginBottom: 4 },
    allergyText: { color: '#d32f2f', fontSize: 13 },
    emptyText: { fontStyle: 'italic', color: '#888', textAlign: 'center', marginTop: 24 },
    cartItem: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e0d8c8' },
    cartItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cartItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 },
    removeBtn: { padding: 4 },
    removeBtnText: { fontSize: 18, color: '#aaa', lineHeight: 20 },
    qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    qtyBtn: { width: 24, height: 24, borderRadius: 4, borderWidth: 1, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center' },
    qtyBtnText: { fontSize: 14, color: '#555', lineHeight: 18 },
    qtyNum: { width: 24, textAlign: 'center', fontSize: 14, fontWeight: '600' },
    cartItemName: { fontSize: 14, fontWeight: '600', color: '#2c2c2c', flex: 1 },
    cartItemPrice: { fontSize: 14, fontWeight: '700', color: '#5a7a3a' },
    cartItemNotes: { fontSize: 12, color: '#888', marginTop: 4, marginLeft: 36 },
    footer: { marginTop: 16, borderTopWidth: 2, borderTopColor: '#e0d8c8', borderStyle: 'dashed', paddingTop: 16 },
    subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    subtotalLabel: { fontSize: 18, fontWeight: '700', color: '#2c2c2c' },
    subtotalValue: { fontSize: 18, fontWeight: '700', color: '#2c2c2c' },
    checkoutBtn: { backgroundColor: '#2c2c2c', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
    checkoutBtnDisabled: { backgroundColor: '#ccc' },
    checkoutBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    hint: { textAlign: 'center', fontSize: 12, color: '#888' },
});
