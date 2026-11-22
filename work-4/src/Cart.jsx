import { useState } from 'react';
import { api, money, today, useAction } from './api.js';
import { ActionError, Field, formValues, RequestState, ShoeImage } from './common.jsx';

export function Cart({ request, user, notify }) {
  const action = useAction();
  const [address, setAddress] = useState(user.address);
  const [date, setDate] = useState('');
  function setQuantity(item, quantity) {
    action.run(async () => {
      await api('/cart', 'PUT', { sku: item.sku, size: item.size, quantity });
      request.retry();
    });
  }

  function checkout(event) {
    event.preventDefault();
    const values = formValues(event);
    action.run(async () => {
      if (values.address.trim().length < 5) throw new Error('Введите полный адрес доставки.');
      if (!values.deliveryDate || values.deliveryDate < today()) throw new Error('Укажите дату доставки не раньше сегодняшней.');
      const order = await api('/orders', 'POST', values);
      request.retry();
      notify('Заказ ' + order.number + ' оформлен.');
      location.hash = '/account';
    });
  }

  return <>
    <h1>Корзина</h1>
    <RequestState request={request} />
    <ActionError action={action} />
    {request.data?.items.length === 0 && <p className="notice">Корзина пуста. <a href="#/">Перейти в каталог</a></p>}
    {request.data?.items.length > 0 && <div className="cart-grid">
      <section className="panel">
        <h2>Выбранные кроссовки</h2>
        {request.data.items.map((item) => <article className="cart-line" key={item.sku + ':' + item.size}>
          <ShoeImage product={item} />
          <div><h3><a href={'#/product/' + item.sku}>{item.name}</a></h3>
            <p className="muted">{item.size} EU · {money(item.unitPrice)} за пару</p>
            <div className="quantity">
              <button aria-label={'Уменьшить количество ' + item.name} disabled={action.busy || item.quantity <= 1} onClick={() => setQuantity(item, item.quantity - 1)}>−</button>
              <strong aria-label="Количество">{item.quantity}</strong>
              <button aria-label={'Увеличить количество ' + item.name} disabled={action.busy || item.quantity >= 20} onClick={() => setQuantity(item, item.quantity + 1)}>+</button>
              <button className="quiet" disabled={action.busy} onClick={() => setQuantity(item, 0)}>Удалить</button>
            </div>
          </div>
          <strong>{money(item.quantity * item.unitPrice)}</strong>
        </article>)}
        {action.busy && <p role="status">Сохраняем изменения…</p>}
      </section>
      <section className="panel checkout">
        <h2>Доставка</h2>
        <dl>
          <div><dt>Сумма товаров</dt><dd>{money(request.data.subtotal)}</dd></div>
          {request.data.coupon && <div><dt>{request.data.coupon} (−{request.data.couponPercent}%)</dt><dd>−{money(request.data.subtotal - request.data.total)}</dd></div>}
          <div className="total"><dt>Итого</dt><dd>{money(request.data.total)}</dd></div>
        </dl>
        <form className="form" onSubmit={checkout}>
          <Field label="Адрес доставки" name="address" autoComplete="street-address" value={address} onChange={(event) => setAddress(event.target.value)} required minLength="5" maxLength="250" />
          <Field label="Дата доставки" name="deliveryDate" type="date" value={date} onChange={(event) => setDate(event.target.value)} required min={today()} />
          <button className="primary" disabled={action.busy}>{action.busy ? 'Подождите…' : 'Оформить заказ'}</button>
        </form>
      </section>
    </div>}
  </>;
}
