import { useState } from 'react';
import { api, dateText, money, statusNames, today, useAction, useData } from './api.js';
import { checkProfile, ProfileFields } from './Account.jsx';
import { ActionError, Field, formValues, RequestState } from './common.jsx';

const groups = {
  products: ['Товары', (row) => row.sku, (row) => row.name, (row) => row.sku + ' · ' + row.categoryName + ' · ' + money(row.salePrice)],
  categories: ['Категории', (row) => row.slug, (row) => row.name, (row) => row.slug],
  coupons: ['Купоны', (row) => row.code, (row) => row.code, (row) => 'Скидка ' + row.percent + '%'],
  users: ['Пользователи', (row) => row.email, (row) => row.name, (row) => row.email + ' · ' + (row.role === 'admin' ? 'Администратор' : 'Пользователь') + (row.coupon ? ' · ' + row.coupon : '')],
  reviews: ['Отзывы', (row) => row.code, (row) => row.product + ' · ' + row.author, (row) => '★ ' + row.rating + ' · ' + row.comment],
  carts: ['Корзины', (row) => JSON.stringify([row.email, row.sku, row.size]), (row) => row.name, (row) => row.email + ' · ' + row.size + ' EU · ' + row.quantity + ' шт.'],
  orders: ['Заказы', (row) => row.number, (row) => row.number, (row) => row.email + ' · ' + dateText(row.deliveryDate) + ' · ' + statusNames[row.status] + ' · ' + money(row.total)],
};

const numericFields = ['price', 'discount', 'deliveryDays', 'percent', 'rating', 'size', 'quantity'];
function NumberField({ name, label, min, max, value }) {
  return <Field name={name} label={label} type="number" required min={min} max={max} defaultValue={value} />;
}

function ResourceFields({ group, row = {}, editing, catalog, coupons }) {
  const email = <Field label="Email пользователя" name="email" type="email" required maxLength="254" />;
  const sku = <Field label="Товар"><select name="sku" required>
    <option value="">Выберите модель</option>
    {catalog.data?.products.map((product) => <option key={product.sku} value={product.sku}>{product.name} · {product.sku}</option>)}
  </select></Field>;
  if (group === 'products') return <>
    <Field label="Артикул" name="sku" required minLength="2" maxLength="40" defaultValue={row.sku} />
    <Field label="Название" name="name" required minLength="2" maxLength="120" defaultValue={row.name} />
    <Field label="Бренд" name="brand" required minLength="2" maxLength="80" defaultValue={row.brand} />
    <Field label="Категория"><select name="category" required defaultValue={row.category || ''}>
      <option value="">Выберите категорию</option>
      {catalog.data?.categories.map((option) => <option key={option.slug} value={option.slug}>{option.name}</option>)}
    </select></Field>
    <Field label="Описание" name="description" textarea rows="3" required minLength="5" maxLength="700" defaultValue={row.description} />
    <Field label="Путь или ссылка на фото" name="image" maxLength="400" defaultValue={row.image} />
    <div className="form-columns">
      <NumberField name="price" label="Цена, ₽" min="1" max="1000000" value={row.price} />
      <NumberField name="discount" label="Скидка, %" min="0" max="90" value={row.discount ?? 0} />
      <NumberField name="deliveryDays" label="Доставка, дней" min="1" max="60" value={row.deliveryDays ?? 2} />
    </div>
  </>;
  if (group === 'categories') return <>
    <Field label="Код категории" name="slug" required minLength="2" maxLength="50" defaultValue={row.slug} />
    <Field label="Название" name="name" required minLength="2" maxLength="80" defaultValue={row.name} />
  </>;
  if (group === 'coupons') return <>
    <Field label="Код купона" name="code" required minLength="2" maxLength="30" defaultValue={row.code} />
    <NumberField name="percent" label="Скидка, %" min="1" max="90" value={row.percent} />
  </>;
  if (group === 'users') return <>
    <ProfileFields user={row} address />
    <Field label={editing ? 'Новый пароль (при необходимости)' : 'Пароль'} name="password" type="password"
      autoComplete="new-password" required={!editing} minLength="8" maxLength="128" />
    <Field label="Купон"><select name="coupon" defaultValue={row.coupon || ''}>
      <option value="">Без купона</option>
      {coupons.data?.map((coupon) => <option key={coupon.code} value={coupon.code}>{coupon.code} ({coupon.percent}%)</option>)}
    </select></Field>
  </>;
  if (group === 'reviews') return <>
    {!editing && <>{email}{sku}</>}
    <NumberField name="rating" label="Оценка" min="1" max="5" value={row.rating ?? 5} />
    <Field label="Комментарий" name="comment" textarea rows="4" required minLength="3" maxLength="1000" defaultValue={row.comment} />
  </>;
  if (group === 'carts') return <>
    {!editing && <>{email}{sku}<NumberField name="size" label="Размер" min="36" max="46" value={42} /></>}
    <NumberField name="quantity" label="Количество" min="1" max="20" value={row.quantity ?? 1} />
  </>;
  return <>
    {!editing && <>{email}<p className="muted">Заказ будет оформлен из корзины этого пользователя.</p></>}
    <Field label="Адрес доставки" name="address" required minLength="5" maxLength="250" defaultValue={row.address} />
    <Field label="Дата доставки" name="deliveryDate" type="date" required min={row.deliveryDate && row.deliveryDate < today() ? row.deliveryDate : today()} defaultValue={row.deliveryDate} />
    {editing && <Field label="Статус"><select name="status" defaultValue={row.status}>
      {Object.entries(statusNames).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
    </select></Field>}
  </>;
}

// Один редактор использует те же API-маршруты для всех доступных администратору ресурсов.
export function Admin({ catalog, refreshCatalog, refreshAccount, refreshCart, notify, user }) {
  const [group, setGroup] = useState('products');
  const [editor, setEditor] = useState(null);
  const action = useAction();
  const path = '/admin/' + group;
  const request = useData(path);
  const coupons = useData(group === 'users' ? '/admin/coupons' : null);
  const [title, keyOf, nameOf, describe] = groups[group];

  function updated(message) {
    setEditor(null);
    request.retry();
    if (['products', 'categories', 'reviews'].includes(group)) refreshCatalog();
    if (['users', 'coupons'].includes(group)) refreshAccount();
    if (['products', 'users', 'coupons', 'carts', 'orders'].includes(group)) refreshCart();
    notify(message);
  }

  function save(event) {
    event.preventDefault();
    const values = formValues(event);
    const editing = editor.type === 'edit';
    action.run(async () => {
      if (group === 'users') checkProfile(values);
      for (const name of numericFields) if (name in values) values[name] = Number(values[name]);
      const route = editing ? path + '/' + encodeURIComponent(keyOf(editor.row)) : path;
      const result = await api(route, editing ? 'PUT' : 'POST', values);
      updated(result.message);
    });
  }

  function remove() {
    action.run(async () => {
      const result = await api(path + '/' + encodeURIComponent(keyOf(editor.row)), 'DELETE');
      updated(result.message);
    });
  }

  function open(next) {
    action.clear();
    setEditor(next);
  }

  const supplies = group === 'products' || (editor?.type === 'add' && ['reviews', 'carts'].includes(group)) ? catalog : group === 'users' ? coupons : null;
  return <>
    <h1>Панель администратора</h1>
    <nav className="admin-nav" aria-label="Разделы администратора">
      {Object.entries(groups).map(([name, [label]]) => <button type="button" key={name} aria-pressed={group === name}
        disabled={action.busy} onClick={() => { setGroup(name); open(null); }}>{label}</button>)}
    </nav>
    <div className="admin-grid">
      <section className="panel">
        <div className="section-title"><h2>{title}</h2><button className="primary" disabled={action.busy} onClick={() => open({ type: 'add' })}>Добавить</button></div>
        <RequestState request={request} />
        {request.data?.length === 0 && <p>В разделе пока нет записей.</p>}
        {request.data?.map((row) => <article className="admin-row" key={keyOf(row)}>
          <div><h3>{nameOf(row)}</h3><p>{describe(row)}</p></div>
          <div className="row-actions">
            <button disabled={action.busy || (group === 'users' && row.role === 'admin' && row.email !== user.email)}
              onClick={() => open({ type: 'edit', row })}>Изменить</button>
            <button className="quiet" disabled={action.busy || (group === 'users' && row.role === 'admin')}
              onClick={() => open({ type: 'delete', row })}>Удалить</button>
          </div>
        </article>)}
      </section>
      {editor && <section className="panel admin-editor" key={group + ':' + editor.type + ':' + (editor.row ? keyOf(editor.row) : '')}>
        <h2>{editor.type === 'add' ? 'Новая запись' : editor.type === 'edit' ? 'Редактирование' : 'Удаление'}</h2>
        <ActionError action={action} />
        {editor.type === 'delete' ? <>
          <p>Удалить «{nameOf(editor.row)}»?</p>
          {group === 'users' && <p>Также будут удалены заказы, корзина и отзывы этого пользователя.</p>}
          <div className="row-actions"><button className="danger" disabled={action.busy} onClick={remove}>{action.busy ? 'Удаление…' : 'Подтвердить удаление'}</button>
            <button disabled={action.busy} onClick={() => setEditor(null)}>Отмена</button></div>
        </> : <>
          {supplies && <RequestState request={supplies} />}
          {(!supplies || supplies.data) && <form className="form" onSubmit={save}>
            <ResourceFields {...{ group, catalog, coupons }} editing={editor.type === 'edit'} row={editor.row} />
            <div className="row-actions"><button className="primary" disabled={action.busy}>{action.busy ? 'Сохранение…' : 'Сохранить'}</button>
              <button type="button" disabled={action.busy} onClick={() => setEditor(null)}>Отмена</button></div>
          </form>}
        </>}
      </section>}
    </div>
  </>;
}
