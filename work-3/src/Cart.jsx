import { discountedPrice, rubles } from './prices';

export default function Cart({ cart, services, user, onRemove }) {
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
          <button onClick={() => onRemove(item.id)}>Удалить</button>
        </article>
      ))}
      <div className="summary">
        <p>Сумма услуг: {rubles(subtotal)}</p>
        {percent > 0 && <p>Купон «{user.couponName}» ({percent}%): −{rubles(subtotal - total)}</p>}
        <p className="total">Итого: {rubles(total)}</p>
      </div>
    </>
  );
}
