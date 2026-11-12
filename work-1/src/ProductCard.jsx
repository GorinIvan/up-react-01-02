import { useState } from 'react';

export default function ProductCard({ name, price, image }) {
  const [quantity, setQuantity] = useState(0);

  return (
    <article>
      <div className="product-image" role="img" aria-label={name}>{image}</div>
      <h2>{name}</h2>
      <p className="price">{price} ₽</p>
      <button onClick={() => setQuantity((previous) => previous + 1)}>
        Добавить в корзину
      </button>
      <p aria-live="polite">В корзине: <strong>{quantity}</strong> шт.</p>
    </article>
  );
}
