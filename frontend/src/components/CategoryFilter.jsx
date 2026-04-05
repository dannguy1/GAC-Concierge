import React from 'react';

export default function CategoryFilter({ categories, activeCategory, onSelect }) {
    const allTabs = ['Suggested', ...categories];

    return (
        <div className="category-filter">
            {allTabs.map(cat => (
                <button
                    key={cat}
                    className={`category-filter__tab${activeCategory === cat ? ' category-filter__tab--active' : ''}`}
                    onClick={() => onSelect(cat)}
                >
                    {cat}
                </button>
            ))}
        </div>
    );
}
