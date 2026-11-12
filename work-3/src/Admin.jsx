import { useEffect, useState } from 'react';
import { request } from './api';

export default function Admin({ token, services, onCatalogChange }) {
  const [options, setOptions] = useState(null);
  const [category, setCategory] = useState('');
  const [userId, setUserId] = useState('');
  const [couponId, setCouponId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [discount, setDiscount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    request('/admin/options', { token }).then(setOptions).catch((failure) => setError(failure.message));
  }, [token]);

  async function save(event, path, method, data, onSuccess, successMessage) {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await request('/admin' + path, { token, method, data });
      await onSuccess();
      setMessage(successMessage);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Панель администратора</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}
      {!options && !error && <p role="status">Загрузка настроек…</p>}
      {options && (
        <div className="admin">
          <form className="panel" onSubmit={(event) => save(event, '/categories', 'POST', { name: category }, async () => {
            setCategory('');
            await onCatalogChange();
          }, 'Категория добавлена.')}>
            <h2>Новая категория</h2>
            <label>Название <input value={category} onChange={(event) => setCategory(event.target.value)} required maxLength="50" /></label>
            <button disabled={busy}>Добавить категорию</button>
          </form>
          <form className="panel" onSubmit={(event) => save(event, '/users/' + userId + '/coupon', 'PATCH',
            { couponId: Number(couponId) }, () => {
              setOptions((current) => ({
                ...current,
                users: current.users.map((user) => user.id === Number(userId)
                  ? { ...user, couponId: Number(couponId) }
                  : user),
              }));
            }, 'Купон назначен.')}>
            <h2>Персональный купон</h2>
            <label>Клиент
              <select value={userId} required onChange={(event) => {
                setUserId(event.target.value);
                setCouponId(options.users.find((user) => user.id === Number(event.target.value))?.couponId ?? '');
              }}>
                <option value="">Выберите клиента</option>
                {options.users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
              </select>
            </label>
            <label>Купон
              <select value={couponId} onChange={(event) => setCouponId(event.target.value)} required>
                <option value="">Выберите купон</option>
                {options.coupons.map((coupon) => (
                  <option key={coupon.id} value={coupon.id}>{coupon.name} ({coupon.percent}%)</option>
                ))}
              </select>
            </label>
            <button disabled={busy}>Назначить купон</button>
          </form>
          <form className="panel" onSubmit={(event) => save(event, '/services/' + serviceId + '/discount', 'PATCH',
            { percent: Number(discount) }, onCatalogChange, 'Скидка сохранена.')}>
            <h2>Общая скидка</h2>
            <label>Услуга
              <select value={serviceId} required onChange={(event) => {
                setServiceId(event.target.value);
                setDiscount(services.find((service) => service.id === Number(event.target.value))?.discount ?? '');
              }}>
                <option value="">Выберите услугу</option>
                {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </label>
            <label>Скидка, % <input type="number" min="0" max="100" step="1" required value={discount}
              onChange={(event) => setDiscount(event.target.value)} /></label>
            <button disabled={busy}>Сохранить скидку</button>
          </form>
        </div>
      )}
    </>
  );
}
