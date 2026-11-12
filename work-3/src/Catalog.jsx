import { useState } from 'react';
import { discountedPrice, rubles } from './prices';

export default function Catalog({ catalog, loading, error, onRetry, onAdd, cart }) {
  const [selected, setSelected] = useState([]);
  const services = catalog.services.filter((service) =>
    selected.length === 0 || selected.includes(service.categoryId)
  );

  function toggleCategory(id) {
    setSelected((current) => current.includes(id)
      ? current.filter((categoryId) => categoryId !== id)
      : [...current, id]);
  }

  return (
    <>
      <h1>Каталог услуг</h1>
      {loading && <p role="status">Загрузка услуг…</p>}
      {error && <div role="alert"><p>{error}</p><button onClick={onRetry}>Повторить запрос</button></div>}
      {!loading && !error && (
        <div className="catalog">
          <aside aria-label="Фильтр по категориям">
            <h2>Категории</h2>
            {catalog.categories.map((category) => (
              <label key={category.id}>
                <input type="checkbox" checked={selected.includes(category.id)}
                  onChange={() => toggleCategory(category.id)} />
                {category.name}
              </label>
            ))}
          </aside>
          <div className="services">
            {services.length === 0 && <p>В выбранных категориях пока нет услуг.</p>}
            {services.map((service) => (
              <article key={service.id}>
                <h2>{service.name}</h2>
                <p>{service.description}</p>
                <p>{service.duration} мин.</p>
                <p className="price">
                  {service.discount > 0 && <del>{rubles(service.price)}</del>}
                  <strong>{rubles(discountedPrice(service.price, service.discount))}</strong>
                  {service.discount > 0 && <span className="discount">−{service.discount}%</span>}
                </p>
                <button onClick={() => onAdd(service.id)}>В корзину</button>
                {cart[service.id] > 0 && <span className="quantity">В корзине: {cart[service.id]}</span>}
              </article>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
