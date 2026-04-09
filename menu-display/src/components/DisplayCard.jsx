import React, { useState } from 'react';
import { getImageUrl } from '../services/api';
import './DisplayCard.css';

const PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWExYTFhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjNDQ0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';

export default function DisplayCard({ item }) {
    const [imgSrc, setImgSrc] = useState(getImageUrl(item.image_path) || PLACEHOLDER);

    return (
        <div className="display-card">
            <div className="display-card__image-wrap">
                <img
                    src={imgSrc}
                    alt={item.item_name}
                    className="display-card__image"
                    onError={() => setImgSrc(PLACEHOLDER)}
                />
            </div>
            <div className="display-card__info">
                {item.popular && <span className="display-card__badge">★ Popular</span>}
                <h1 className="display-card__name">{item.item_name}</h1>
                {item.item_viet && (
                    <p className="display-card__viet">{item.item_viet}</p>
                )}
                <p className="display-card__desc">{item.description}</p>
                <p className="display-card__price">${(item.price || 0).toFixed(2)}</p>
            </div>
        </div>
    );
}
