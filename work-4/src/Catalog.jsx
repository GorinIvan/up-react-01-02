import { useState } from 'react';
import { api, money, sizes, useAction, useData } from './api.js';
import { ActionError, Field, formValues, RequestState, ShoeImage } from './common.jsx';

function ProductCard({ product, addToCart, busy }) {
  const [size, setSize] = useState('42');
  const [quantity, setQuantity] = useState('1');
  return <article className="product-card">
    <a className="product-photo" aria-label={'Подробнее о ' + product.name} href={'#/product/' + product.sku}>
      <ShoeImage product={product} />
      {product.discount > 0 && <span className="sale">−{product.discount}%</span>}
    </a>
    <div className="product-body">
      <div className="product-meta"><span>{product.brand} · {product.categoryName}</span><span>{product.averageRating ? '★ ' + product.averageRating : ''}</span></div>
      <h3><a href={'#/product/' + product.sku}>{product.name}</a></h3>
      <p className="description">{product.description}</p>
      <p className="muted">Доставка от {product.deliveryDays} дн.</p>
      <div className="price"><strong>{money(product.salePrice)}</strong>{product.discount > 0 && <del>{money(product.price)}</del>}</div>
      <div className="buy">
        <Field label="Размер"><select value={size} onChange={(event) => setSize(event.target.value)}>{sizes.map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label="Пар" type="number" min="1" max="20" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        <button className="primary" disabled={busy || !Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 20}
          onClick={() => addToCart(product.sku, Number(size), Number(quantity))}>В корзину</button>
      </div>
    </div>
  </article>;
}

// Фильтры применяются к каталогу, который вернул сервер через JOIN.
export function Catalog({ request, addToCart, action }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [sort, setSort] = useState('');
  const needle = query.trim().toLocaleLowerCase('ru-RU');
  const products = (request.data?.products || []).filter((item) =>
    (!category || item.category === category) &&
    (!price || item.salePrice <= Number(price)) &&
    [item.name, item.brand, item.description, item.categoryName, item.sku].some((value) => value.toLocaleLowerCase('ru-RU').includes(needle)));
  if (sort) products.sort((left, right) => (left.salePrice - right.salePrice) * (sort === 'asc' ? 1 : -1));
  return <>
    <section className="hero">
      <div>
        <h1>Кроссовки<br />на каждый день</h1>
        <p>Городские, беговые и трейловые модели с доставкой.</p>
        <button className="primary" onClick={() => document.querySelector('#catalog').scrollIntoView({ behavior: 'smooth' })}>Смотреть каталог</button>
      </div>
      <img src="/shoes/aero.webp" alt="Бело-голубые кроссовки Aero Run" />
    </section>
    <section id="catalog">
      <div className="section-title"><h2>Каталог</h2>{request.data && <span className="muted">Найдено {products.length}</span>}</div>
      <div className="filters">
        <Field label="Поиск" type="search" placeholder="Модель, бренд или артикул" maxLength="120" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Field label="Категория"><select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">Все категории</option>
          {(request.data?.categories || []).map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
        </select></Field>
        <Field label="Максимальная цена"><select value={price} onChange={(event) => setPrice(event.target.value)}>
          <option value="">Любая</option><option value="7500">До 7 500 ₽</option><option value="9000">До 9 000 ₽</option><option value="10000">До 10 000 ₽</option>
        </select></Field>
        <Field label="Сортировка"><select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="">По умолчанию</option><option value="asc">Сначала дешевле</option><option value="desc">Сначала дороже</option>
        </select></Field>
      </div>
      <RequestState request={request} />
      <ActionError action={action} />
      {action.busy && <p className="notice" role="status">Добавляем в корзину…</p>}
      {request.data && !products.length && <p className="notice">По этим условиям кроссовки не найдены.</p>}
      <div className="products">{products.map((product) => <ProductCard key={product.sku} {...{ product, addToCart }} busy={action.busy} />)}</div>
    </section>
  </>;
}

export function Product({ catalog, sku, user, addToCart, action, requestLogin, refreshCatalog, notify }) {
  const product = catalog.data?.products.find((item) => item.sku === sku);
  const path = '/products/' + encodeURIComponent(sku) + '/reviews';
  const reviews = useData(product ? path : null);
  const reviewAction = useAction();

  function publish(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const { rating, comment } = formValues(event);
    reviewAction.run(async () => {
      if (comment.trim().length < 3) throw new Error('Введите хотя бы три символа в комментарии.');
      await api(path, 'POST', { rating: Number(rating), comment });
      form.reset();
      reviews.retry();
      refreshCatalog();
      notify('Отзыв опубликован.');
    });
  }

  return <>
    <a className="back" href="#/">‹ Каталог</a>
    <RequestState request={catalog} />
    {catalog.data && !product && <p className="notice">Товар не найден.</p>}
    {product && <>
      <div className="product-detail"><ProductCard key={sku} {...{ product, addToCart }} busy={action.busy} />
        <div className="panel">
          <h1>Отзывы о {product.name}</h1>
          <RequestState request={reviews} />
          {reviews.data?.length === 0 && <p>Пока нет отзывов.</p>}
          {reviews.data?.map((review) => <article className="review" key={review.code}>
            <strong>{review.author}</strong><span className="rating">★ {review.rating} из 5</span><p>{review.comment}</p>
          </article>)}
          {user ? <form className="form review-form" onSubmit={publish}>
            <h2>Оставить отзыв</h2>
            <Field label="Оценка"><select name="rating" defaultValue="5">{[5, 4, 3, 2, 1].map((rating) => <option key={rating}>{rating}</option>)}</select></Field>
            <Field label="Комментарий" name="comment" required minLength="3" maxLength="1000" rows="3" textarea />
            <ActionError action={reviewAction} />
            <button className="primary" disabled={reviewAction.busy}>{reviewAction.busy ? 'Публикация…' : 'Опубликовать отзыв'}</button>
          </form> : <button type="button" onClick={requestLogin}>Войти, чтобы оставить отзыв</button>}
        </div>
      </div>
      <ActionError action={action} />
      {action.busy && <p className="notice" role="status">Добавляем в корзину…</p>}
    </>}
  </>;
}
