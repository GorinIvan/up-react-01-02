import { useState } from 'react';
import { discountedPrice, rubles } from './prices';

const covers = {
  'Grand Theft Auto V': 'gta-v.jpg',
  'Red Dead Redemption 2': 'red-dead-redemption-2.jpg',
  'Cyberpunk 2077': 'cyberpunk-2077.jpg',
  'Elden Ring': 'elden-ring.jpg',
  'Civilization VI': 'civilization-vi.jpg',
  'Hearts of Iron IV': 'hearts-of-iron-iv.jpg',
  'Total War: Warhammer III': 'total-war-warhammer-iii.jpg',
  'Stardew Valley': 'stardew-valley.jpg',
  'Euro Truck Simulator 2': 'euro-truck-simulator-2.jpg',
  'BeamNG.drive': 'beamng-drive.jpg',
};

export default function Catalog({ catalog, loading, error, onRetry, onAdd, cart }) {
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const services = catalog.services.filter((service) =>
    (selected.length === 0 || selected.includes(service.categoryId))
    && service.name.toLowerCase().includes(query)
  );

  function toggleCategory(id) {
    setSelected((current) => current.includes(id)
      ? current.filter((categoryId) => categoryId !== id)
      : [...current, id]);
  }

  return (
    <>
      <h1>Каталог игр</h1>
      {loading && <p role="status">Загрузка игр…</p>}
      {error && <div role="alert"><p>{error}</p><button onClick={onRetry}>Повторить запрос</button></div>}
      {!loading && !error && (
        <div className="catalog">
          <label className="catalog-search">
            Поиск по названию
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <aside aria-label="Фильтр по жанрам">
            <h2>Жанры</h2>
            {catalog.categories.map((category) => (
              <label key={category.id}>
                <input type="checkbox" checked={selected.includes(category.id)}
                  onChange={() => toggleCategory(category.id)} />
                {category.name}
              </label>
            ))}
          </aside>
          <div className="services">
            {services.length === 0 && (
              <p role="status">{query ? 'Игры не найдены.' : 'В выбранных жанрах пока нет игр.'}</p>
            )}
            {services.map((service) => (
              <article key={service.id}>
                {covers[service.name] && (
                  <img className="game-cover" src={import.meta.env.BASE_URL + 'covers/' + covers[service.name]} alt="" />
                )}
                <h2>{service.name}</h2>
                <p>{service.description}</p>
                <p className="price">
                  {service.discount > 0 && <del>{rubles(service.price)}</del>}
                  <strong>{rubles(discountedPrice(service.price, service.discount))}</strong>
                  {service.discount > 0 && <span className="discount">−{service.discount}%</span>}
                </p>
                {onAdd && (
                  <>
                    <button onClick={() => onAdd(service.id)}>В корзину</button>
                    {cart[service.id] > 0 && <span className="quantity">В корзине: {cart[service.id]}</span>}
                  </>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
