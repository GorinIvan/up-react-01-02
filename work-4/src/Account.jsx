import { useState } from 'react';
import { api, dateText, money, statusNames, useAction, useData } from './api.js';
import { ActionError, Field, formValues, RequestState } from './common.jsx';

export function ProfileFields({ user = {}, address = false }) {
  return <>
    <Field label="ФИО" name="name" autoComplete="name" required minLength="3" maxLength="120" defaultValue={user.name} />
    <Field label="Email" name="email" type="email" autoComplete="email" required maxLength="254" defaultValue={user.email} />
    <Field label="Телефон" name="phone" type="tel" autoComplete="tel" required minLength="7" maxLength="25" defaultValue={user.phone} />
    {address && <Field label="Адрес по умолчанию" name="address" autoComplete="street-address" maxLength="250" defaultValue={user.address} />}
  </>;
}

export function checkProfile(values) {
  if (!/^[\p{L}\p{M} .’'-]+$/u.test(values.name.trim()) || !/\p{L}/u.test(values.name) || values.name.trim().length < 3) {
    throw new Error('Укажите ФИО буквами.');
  }
  if (!/^\+?[\d ().-]+$/.test(values.phone.trim()) || !/^\d{7,15}$/.test(values.phone.replace(/\D/g, ''))) {
    throw new Error('Введите корректный телефон.');
  }
}

const authPages = {
  login: ['Вход', 'Войти'],
  register: ['Регистрация', 'Создать аккаунт'],
  forgot: ['Восстановление пароля', 'Запросить ссылку'],
  reset: ['Новый пароль', 'Сохранить пароль'],
};

export function Auth({ mode, token, onLogin, notify }) {
  const action = useAction();
  const [sent, setSent] = useState(false);
  const [title, button] = authPages[mode];
  function submit(event) {
    event.preventDefault();
    const values = formValues(event);
    action.run(async () => {
      if (mode === 'register') checkProfile(values);
      if (values.password !== undefined && !values.password.trim()) throw new Error('Введите пароль.');
      if (mode === 'reset') {
        if (values.password !== values.confirmation) throw new Error('Пароли должны совпадать.');
        values.token = token;
        delete values.confirmation;
      }
      const result = await api('/auth/' + mode, 'POST', values);
      if (mode === 'forgot') {
        setSent(true);
        return;
      }
      if (mode === 'reset') {
        history.replaceState(null, '', '/#/login');
        notify(result.message);
        onLogin(null);
        return;
      }
      onLogin(result);
    });
  }
  return <section className="panel narrow">
    <h1>{title}</h1>
    {mode === 'forgot' && <p>Укажите email, который вы использовали при регистрации.</p>}
    {sent && <p className="notice" role="status">Если аккаунт существует, для него создана ссылка восстановления.</p>}
    {!sent && <form className="form" onSubmit={submit}>
      {mode === 'register' && <ProfileFields />}
      {(mode === 'login' || mode === 'forgot') && <Field label="Email" name="email" type="email" autoComplete="email" required maxLength="254" />}
      {mode !== 'forgot' && <Field label={mode === 'reset' ? 'Новый пароль' : 'Пароль'} name="password" type="password"
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'login' ? undefined : 8} maxLength="128" />}
      {mode === 'reset' && <Field label="Повторите пароль" name="confirmation" type="password" autoComplete="new-password" required minLength="8" maxLength="128" />}
      <ActionError action={action} />
      <button className="primary" disabled={action.busy}>{action.busy ? 'Отправка…' : button}</button>
    </form>}
    <div className="form-links">
      {mode !== 'login' && <a href="#/login">Войти</a>}
      {mode === 'login' && <><a href="#/register">Регистрация</a><a href="#/forgot">Забыли пароль?</a></>}
      {mode === 'reset' && <a href="#/forgot">Запросить новую ссылку</a>}
    </div>
  </section>;
}

export function OrderCard({ order }) {
  return <article className="order">
    <div className="section-title"><h3>{order.number}</h3><span className="status">{statusNames[order.status]}</span></div>
    <p>Оформлен {dateText(order.createdAt)} · Доставка {dateText(order.deliveryDate)}</p>
    <p>{order.address}</p>
    <ul>{order.items.map((item) => <li key={item.sku + ':' + item.size}>{item.name} · {item.size} EU · {item.quantity} шт. × {money(item.unitPrice)}</li>)}</ul>
    {order.coupon && <p className="muted">Купон {order.coupon}</p>}
    <strong>{money(order.total)}</strong>
  </article>;
}

// Кабинет загружает историю текущего пользователя и отправляет изменения отдельно.
export function Account({ user, setUser, notify }) {
  const orders = useData('/orders');
  const profileAction = useAction();
  const passwordAction = useAction();
  function saveProfile(event) {
    event.preventDefault();
    const values = formValues(event);
    profileAction.run(async () => {
      checkProfile(values);
      setUser(await api('/auth/profile', 'PUT', values));
      notify('Данные профиля сохранены.');
    });
  }
  function changePassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const { currentPassword, password, confirmation } = formValues(event);
    passwordAction.run(async () => {
      if (password !== confirmation) throw new Error('Пароли должны совпадать.');
      if (!password.trim()) throw new Error('Введите новый пароль.');
      if (password === currentPassword) throw new Error('Новый пароль должен отличаться от текущего.');
      const result = await api('/auth/password', 'PUT', { currentPassword, password });
      form.reset();
      notify(result.message);
    });
  }
  return <>
    <h1>Личный кабинет</h1>
    <div className="account-grid">
      <div className="panel">
        <h2>Мои заказы</h2>
        <RequestState request={orders} />
        {orders.data?.length === 0 && <p>Заказов пока нет. <a href="#/">Перейти в каталог</a></p>}
        {orders.data?.map((order) => <OrderCard key={order.number} order={order} />)}
      </div>
      <div className="stack">
        <section className="panel"><h2>Личные данные</h2>
          <form className="form" onSubmit={saveProfile}>
            <ProfileFields user={user} address />
            {user.coupon && <p className="muted">Ваш купон {user.coupon} · скидка {user.couponPercent}%</p>}
            <ActionError action={profileAction} />
            <button className="primary" disabled={profileAction.busy}>{profileAction.busy ? 'Сохранение…' : 'Сохранить профиль'}</button>
          </form>
        </section>
        <section className="panel"><h2>Изменение пароля</h2>
          <form className="form" onSubmit={changePassword}>
            <Field label="Текущий пароль" name="currentPassword" type="password" autoComplete="current-password" required maxLength="128" />
            <Field label="Новый пароль" name="password" type="password" autoComplete="new-password" required minLength="8" maxLength="128" />
            <Field label="Повторите пароль" name="confirmation" type="password" autoComplete="new-password" required minLength="8" maxLength="128" />
            <ActionError action={passwordAction} />
            <button disabled={passwordAction.busy}>{passwordAction.busy ? 'Сохранение…' : 'Изменить пароль'}</button>
          </form>
        </section>
      </div>
    </div>
  </>;
}
