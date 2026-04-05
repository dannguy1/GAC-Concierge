import React from 'react';
import MenuCard from './MenuCard';
import CategoryFilter from './CategoryFilter';

export default function MenuVisualizer({
    mentionedItems,
    allMenuItems,
    categories,
    activeCategory,
    onCategorySelect,
    onItemClick,
    onOpenDetail,
    menuError,
}) {
    if (menuError) {
        return (
            <div className="visualizer-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '2.5rem' }}>⚠️</span>
                <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', fontStyle: 'italic' }}>
                    Could not load menu.<br />Check server connection and refresh.
                </p>
            </div>
        );
    }
    const isSuggested = activeCategory === 'Suggested';

    const displayItems = isSuggested
        ? (mentionedItems && mentionedItems.length > 0
            ? Array.from(new Map(mentionedItems.map(i => [i.item_name, i])).values())
            : [])
        : allMenuItems.filter(i => i.category === activeCategory);

    return (
        <div className="visualizer-section">
            <div className="panel-header">
                <h2>{isSuggested ? 'Concierge Suggestions' : activeCategory}</h2>
            </div>

            <div className="visualizer-tabs">
                <CategoryFilter
                    categories={categories}
                    activeCategory={activeCategory}
                    onSelect={onCategorySelect}
                />
            </div>

            <div className="panel-content">
                {displayItems.length === 0 ? (
                    <div className="visualizer-empty">
                        {isSuggested
                            ? 'Ask Kristin a question to see suggested dishes here.'
                            : 'No items in this category.'}
                    </div>
                ) : (
                    <div className="menu-grid">
                        {displayItems.map((item, idx) => (
                            <MenuCard
                                key={`${item.item_name}-${idx}`}
                                item={item}
                                onAddToCart={onItemClick}
                                onOpenDetail={onOpenDetail}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
