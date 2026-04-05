import React from 'react';
import { View, Text, FlatList, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import MenuCard from './MenuCard';

export default function MenuVisualizer({ mentionedItems, allMenuItems, categories, activeCategory, onCategorySelect, onItemClick, onOpenDetail }) {
    const { width, height } = useWindowDimensions();
    const numColumns = width > height ? 3 : 2;
    const isSuggested = activeCategory === 'Suggested';
    const allTabs = ['Suggested', ...categories];

    const displayItems = isSuggested
        ? (mentionedItems && mentionedItems.length > 0
            ? Array.from(new Map(mentionedItems.map(i => [i.item_name, i])).values())
            : [])
        : allMenuItems.filter(i => i.category === activeCategory);

    return (
        <View style={styles.container}>
            {/* Category tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
                {allTabs.map(cat => (
                    <TouchableOpacity
                        key={cat}
                        style={[styles.tab, activeCategory === cat && styles.tabActive]}
                        onPress={() => onCategorySelect(cat)}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabText, activeCategory === cat && styles.tabTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{isSuggested ? 'Concierge Suggestions' : activeCategory}</Text>
            </View>

            {/* Grid */}
            {displayItems.length === 0 ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>
                        {isSuggested ? 'Ask Kristin a question to see suggested dishes here.' : 'No items in this category.'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={displayItems}
                    keyExtractor={(item, idx) => `${item.item_name}-${idx}`}
                    key={numColumns}
                    numColumns={numColumns}
                    columnWrapperStyle={styles.row}
                    contentContainerStyle={styles.grid}
                    renderItem={({ item }) => (
                        <View style={styles.cardWrap}>
                            <MenuCard item={item} onAddToCart={onItemClick} onOpenDetail={onOpenDetail} />
                        </View>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#faf8f2' },
    tabBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0d8c8', flexGrow: 0, flexShrink: 0 },
    tabBarContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
    tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f0ece1', borderWidth: 1, borderColor: 'transparent' },
    tabActive: { backgroundColor: '#5a7a3a', borderColor: '#5a7a3a' },
    tabText: { fontSize: 13, color: '#555', fontWeight: '600' },
    tabTextActive: { color: '#fff' },
    header: { paddingHorizontal: 16, paddingVertical: 10 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#2c2c2c' },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    emptyText: { textAlign: 'center', color: '#888', fontStyle: 'italic', fontSize: 14, lineHeight: 22 },
    grid: { padding: 10, paddingBottom: 20 },
    row: { gap: 10 },
    cardWrap: { flex: 1 },
});
