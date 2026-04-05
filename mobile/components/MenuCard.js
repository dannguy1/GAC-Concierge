import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { getImageUrl } from '../services/api';

const PLACEHOLDER = 'https://placehold.co/400x280?text=No+Image';

export default function MenuCard({ item, onAddToCart, onOpenDetail }) {
    const [imgSrc, setImgSrc] = useState(getImageUrl(item.image_path) || PLACEHOLDER);

    return (
        <View style={styles.card}>
            <TouchableOpacity onPress={() => onOpenDetail && onOpenDetail(item)} activeOpacity={0.85}>
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
            </TouchableOpacity>

            <View style={styles.body}>
                <View style={styles.header}>
                    <Text style={styles.name} numberOfLines={2}>{item.item_name}</Text>
                    <Text style={styles.price}>${(item.price || 0).toFixed(2)}</Text>
                </View>
                {item.item_viet ? <Text style={styles.viet}>{item.item_viet}</Text> : null}
                <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => onAddToCart && onAddToCart(item)} activeOpacity={0.8}>
                    <Text style={styles.addBtnText}>+ Add to Order</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e0d8c8', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 },
    imageWrap: { width: '100%', height: 140, position: 'relative' },
    image: { width: '100%', height: '100%' },
    badge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#c8a84b', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    body: { padding: 12 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
    name: { fontSize: 14, fontWeight: '700', color: '#2c2c2c', flex: 1, marginRight: 8 },
    price: { fontSize: 14, fontWeight: '700', color: '#5a7a3a' },
    viet: { fontSize: 12, color: '#888', fontStyle: 'italic', marginBottom: 4 },
    desc: { fontSize: 12, color: '#666', lineHeight: 17, marginBottom: 10 },
    addBtn: { backgroundColor: '#5a7a3a', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
    addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
