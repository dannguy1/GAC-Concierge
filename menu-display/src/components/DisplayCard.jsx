import React, { useState } from 'react';
import { getImageUrl } from '../services/api';
import './DisplayCard.css';

const PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTJkZGQzIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzZXJpZiIgZm9udC1zaXplPSIzMiIgZmlsbD0iIzZiNjY2MSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';

export default function DisplayCard({ item }) {
    const [imgSrc, setImgSrc] = useState(getImageUrl(item.image_path) || PLACEHOLDER);

    return (
        <div className="kiosk-card">
            {/* Left: image */}
            <div className="kiosk-card__image-wrap">
                <img
                    src={imgSrc}
                    alt={item.item_name}
                    className="kiosk-card__image"
                    onError={() => setImgSrc(PLACEHOLDER)}
                />
                {item.popular && (
                    <span className="kiosk-card__badge">POPULAR</span>
                )}
            </div>

            {/* Right: info panel */}
            <div className="kiosk-card__info">
                <div className="kiosk-card__category">{item.category}</div>
                <h1 className="kiosk-card__name">{item.item_name}</h1>
                {item.item_viet && (
                    <p className="kiosk-card__viet">{item.item_viet}</p>
                )}
                <div className="kiosk-card__divider" />
                <p className="kiosk-card__desc">{item.description}</p>
                <div className="kiosk-card__price">${(item.price || 0).toFixed(2)}</div>
            </div>
        </div>
    );
}
