import { discountedPrice, rubles } from './prices';

export default function Cart({ cart, services, user, onChangeQuantity, onRemove }) {
  const items = services
    .filter((service) => cart[service.id] > 0)
    .map((service) => {
      const unitPrice = discountedPrice(service.price, service.discount);
      return { ...service, unitPrice, quantity: cart[service.id] };
    });

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const percent = user?.couponPercent ?? 0;
  const total = discountedPrice(subtotal, percent);

  return (
    <>
      <h1>Корзина</h1>
      {items.length === 0 && <p>Корзина пуста.</p>}
      {items.map((item) => (
        <article className="cart-row" key={item.id}>
          <div>
            <h2>{item.name}</h2>
            <p>{rubles(item.unitPrice)} × {item.quantity} шт. = {rubles(item.unitPrice * item.quantity)}</p>
          </div>
          <div className="cart-actions">
            <button aria-label={'Уменьшить количество: ' + item.name} onClick={() => onChangeQuantity(item.id, -1)}>−</button>
            <span className="cart-quantity" aria-live="polite">{item.quantity}</span>
            <button aria-label={'Увеличить количество: ' + item.name} onClick={() => onChangeQuantity(item.id, 1)}>+</button>
            <button onClick={() => onRemove(item.id)}>Удалить</button>
          </div>
        </article>
      ))}
      <div className="summary">
        <p>Сумма за игры: {rubles(subtotal)}</p>
        {percent > 0 && <p>Купон «{user.couponName}» ({percent}%): −{rubles(subtotal - total)}</p>}
        <p className="total">Итого: {rubles(total)}</p>
      </div>
    </>
  );
}
