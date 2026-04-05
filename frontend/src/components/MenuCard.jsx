import React, { useState } from 'react';
import { getImageUrl } from '../services/api';

const PLACEHOLDER = 'https://placehold.co/400x280?text=No+Image';

export default function MenuCard({ item, onAddToCart, onOpenDetail }) {
    const [imgSrc, setImgSrc] = useState(getImageUrl(item.image_path) || PLACEHOLDER);

    return (
        <div className="menu-card">
            <div
                className="menu-card__image-wrap"
                onClick={() => onOpenDetail && onOpenDetail(item)}
            >
                <img
                    src={imgSrc}
                    alt={item.item_name}
                    className="menu-card__image"
                    onError={() => setImgSrc(PLACEHOLDER)}
                />
                {item.popular && (
                    <span className="menu-card__badge">POPULAR</span>
                )}
            </div>

            <div className="menu-card__body">
                <div className="menu-card__header">
                    <h3 className="menu-card__name">{item.item_name}</h3>
                    <span className="menu-card__price">${(item.price || 0).toFixed(2)}</span>
                </div>
                {item.item_viet && (
                    <p className="menu-card__viet">{item.item_viet}</p>
                )}
                <p className="menu-card__desc">{item.description}</p>

                <button
                    className="menu-card__add-btn"
                    onClick={() => onAddToCart && onAddToCart(item)}
                >
                    + Add to Order
                </button>
            </div>
        </div>
    );
}
