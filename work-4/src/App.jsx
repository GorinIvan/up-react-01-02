import { useEffect, useState } from 'react';
import { api, useAction, useData } from './api.js';
import { Account, Auth } from './Account.jsx';
import { Admin } from './Admin.jsx';
import { Cart } from './Cart.jsx';
import { Catalog, Product } from './Catalog.jsx';
import { ActionError, RequestState } from './common.jsx';

const currentRoute = () => location.hash.slice(1) || '/';
const resetToken = new URLSearchParams(location.search).get('reset');

function initialTheme() {
  try {
    return localStorage.getItem('sneaker-theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

// Навигация на хешах работает с кнопкой «Назад» и после перезагрузки страницы.
export default function App() {
  const [route, setRoute] = useState(resetToken ? '/reset' : currentRoute);
  const [theme, setTheme] = useState(initialTheme);
  const [message, notify] = useState('');
  const [returnRoute, setReturnRoute] = useState('');
  const [activeUser, setUser] = useState(undefined);
  const session = useData('/auth/me');
  const catalog = useData('/catalog');
  const user = activeUser === undefined ? session.data : activeUser;
  const cart = useData(user ? '/cart' : null, user?.email);
  const accountAction = useAction();
  const cartAction = useAction();
  const count = cart.data?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;

  useEffect(() => {
    function moved() {
      setRoute(currentRoute());
      window.scrollTo(0, 0);
    }
    window.addEventListener('hashchange', moved);
    return () => window.removeEventListener('hashchange', moved);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('sneaker-theme', theme);
    } catch {
      // Тема применяется в текущей вкладке даже при недоступном хранилище.
    }
  }, [theme]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => notify(''), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  function navigate(path) {
    if (location.hash === '#' + path) setRoute(path);
    else location.hash = path;
  }

  function requestLogin() {
    setReturnRoute(route);
    navigate('/login');
  }

  function onLogin(next) {
    setUser(next);
    cart.retry();
    const target = next ? returnRoute || (next.role === 'admin' ? '/admin' : '/account') : '/login';
    setReturnRoute('');
    navigate(target);
  }

  function logout() {
    accountAction.run(async () => {
      const result = await api('/auth/logout', 'POST', {});
      setUser(null);
      setReturnRoute('');
      cart.retry();
      notify(result.message);
      navigate('/');
    });
  }

  async function refreshAccount() {
    await accountAction.run(async () => {
      const next = await api('/auth/me');
      setUser(next);
      if (!next) {
        notify('Войдите с новым паролем.');
        navigate('/login');
      }
    });
  }

  function addToCart(sku, size, quantity) {
    if (!user) {
      if (session.loading) { notify('Подождите, проверяем вход…'); return; }
      requestLogin();
      notify('Войдите, чтобы добавить кроссовки в корзину.');
      return;
    }
    cartAction.run(async () => {
      await api('/cart', 'POST', { sku, size, quantity });
      cart.retry();
      notify('Кроссовки добавлены в корзину.');
      navigate('/cart');
    });
  }

  const panel = ['cart', 'account', 'admin'].find((page) => '/' + page === route);
  const authPage = ['login', 'register', 'forgot', 'reset'].find((page) => '/' + page === route);
  const product = route.startsWith('/product/') && route.slice('/product/'.length);
  const authPending = activeUser === undefined && (session.loading || session.error);
  const links = (href, name) => <a aria-current={route === href ? 'page' : undefined} href={'#' + href}>{name}</a>;

  return <>
    <header className="topbar"><div className="header-inner">
      <a href="#/" className="wordmark" aria-label="Sneaker Store — каталог"><span>S</span> Sneaker Store</a>
      <nav aria-label="Главная навигация">
        {links('/', 'Каталог')}
        {links('/cart', count ? 'Корзина (' + count + ')' : 'Корзина')}
        {user ? links('/account', 'Личный кабинет') : links('/login', 'Вход')}
        {user?.role === 'admin' && links('/admin', 'Управление')}
      </nav>
      <div className="header-actions">
        <button className="theme-button" aria-label={theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему'}
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? '☾' : '☀'}</button>
        {user && <button onClick={logout} disabled={accountAction.busy}>{accountAction.busy ? 'Подождите…' : 'Выйти'}</button>}
      </div>
    </div></header>
    <main>
      <ActionError action={accountAction} />
      {authPending && <RequestState request={session} />}
      {route === '/' && <Catalog request={catalog} {...{ addToCart }} action={cartAction} />}
      {product && <Product {...{ catalog, user, addToCart, requestLogin, notify }} sku={product} action={cartAction} refreshCatalog={catalog.retry} />}
      {authPage && <Auth key={authPage} mode={authPage} token={resetToken} {...{ onLogin, notify }} />}
      {panel && !authPending && !user && <section className="panel narrow"><h1>Войдите в аккаунт</h1>
        <p>Вход нужен для доступа к этой странице.</p><button className="primary" onClick={requestLogin}>Войти</button>
      </section>}
      {panel === 'cart' && user && <Cart request={cart} {...{ user, notify }} />}
      {panel === 'account' && user && <Account key={user.email} {...{ user, setUser, notify }} />}
      {panel === 'admin' && user?.role === 'admin' && <Admin {...{ catalog, user, notify, refreshAccount }} refreshCatalog={catalog.retry} refreshCart={cart.retry} />}
      {panel === 'admin' && user && user.role !== 'admin' && <p className="notice error">Раздел доступен администратору. <a href="#/">В каталог</a></p>}
      {route !== '/' && !panel && !authPage && !product && <p className="notice">Страница не найдена. <a href="#/">В каталог</a></p>}
    </main>
    <footer><strong>Sneaker Store</strong><span>Интернет-магазин кроссовок</span></footer>
    {message && <aside className="toast" role="status">{message}<button aria-label="Закрыть уведомление" onClick={() => notify('')}>×</button></aside>}
  </>;
}
