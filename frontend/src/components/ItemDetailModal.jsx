import React, { useState } from 'react';
import { getImageUrl } from '../services/api';

const PLACEHOLDER = 'https://placehold.co/800x500?text=No+Image';

export default function ItemDetailModal({ item, onClose, onAddToCart }) {
    const [imgSrc, setImgSrc] = useState(getImageUrl(item?.image_path) || PLACEHOLDER);

    if (!item) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    const handleAdd = () => {
        onAddToCart && onAddToCart(item);
        onClose();
    };

    return (
        <div className="item-modal-backdrop" onClick={handleBackdropClick}>
            <div className="item-modal">
                <button className="item-modal__close" onClick={onClose} aria-label="Close">×</button>

                <div className="item-modal__image-wrap">
                    <img
                        src={imgSrc}
                        alt={item.item_name}
                        className="item-modal__image"
                        onError={() => setImgSrc(PLACEHOLDER)}
                    />
                    {item.popular && (
                        <span className="menu-card__badge">POPULAR</span>
                    )}
                </div>

                <div className="item-modal__body">
                    <div className="item-modal__header">
                        <div>
                            <h2 className="item-modal__name">{item.item_name}</h2>
                            {item.item_viet && (
                                <p className="item-modal__viet">{item.item_viet}</p>
                            )}
                        </div>
                        <span className="item-modal__price">${(item.price || 0).toFixed(2)}</span>
                    </div>

                    <p className="item-modal__desc">{item.description}</p>

                    <button className="item-modal__add-btn" onClick={handleAdd}>
                        + Add to Order
                    </button>
                </div>
            </div>
        </div>
    );
}
