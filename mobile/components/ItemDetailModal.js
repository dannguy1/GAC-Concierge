import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { getImageUrl } from '../services/api';

const PLACEHOLDER = 'https://placehold.co/800x500?text=No+Image';

export default function ItemDetailModal({ item, onClose, onAddToCart }) {
    const [imgSrc, setImgSrc] = useState(getImageUrl(item?.image_path) || PLACEHOLDER);

    if (!item) return null;

    const handleAdd = () => {
        onAddToCart && onAddToCart(item);
        onClose();
    };

    return (
        <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
            <View style={styles.sheet}>
                <View style={styles.handle} />
                <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.imageWrap}>
                        <Image
                            source={{ uri: imgSrc }}
                            style={styles.image}
                            onError={() => setImgSrc(PLACEHOLDER)}
                            resizeMode="cover"
                        />
                        {item.popular && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>POPULAR</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.body}>
                        <View style={styles.titleRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.name}>{item.item_name}</Text>
                                {item.item_viet ? <Text style={styles.viet}>{item.item_viet}</Text> : null}
                            </View>
                            <Text style={styles.price}>${(item.price || 0).toFixed(2)}</Text>
                        </View>
                        <Text style={styles.desc}>{item.description}</Text>
                        <TouchableOpacity style={styles.addBtn} onPress={handleAdd} activeOpacity={0.85}>
                            <Text style={styles.addBtnText}>+ Add to Order</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <Text style={styles.closeBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', overflow: 'hidden' },
    handle: { width: 40, height: 4, backgroundColor: '#ccc', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
    imageWrap: { width: '100%', height: 220, position: 'relative' },
    image: { width: '100%', height: '100%' },
    badge: { position: 'absolute', top: 12, right: 12, backgroundColor: '#c8a84b', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    body: { padding: 20 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    name: { fontSize: 20, fontWeight: '800', color: '#2c2c2c' },
    viet: { fontSize: 14, color: '#888', fontStyle: 'italic', marginTop: 2 },
    price: { fontSize: 20, fontWeight: '800', color: '#5a7a3a' },
    desc: { fontSize: 15, color: '#555', lineHeight: 22, marginBottom: 24 },
    addBtn: { backgroundColor: '#5a7a3a', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    closeBtn: { paddingVertical: 12, alignItems: 'center' },
    closeBtnText: { color: '#888', fontSize: 14 },
});
