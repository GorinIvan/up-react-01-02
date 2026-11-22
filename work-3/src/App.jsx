import { useEffect, useState } from 'react';
import Admin from './Admin';
import Cart from './Cart';
import Catalog from './Catalog';
import Login from './Login';
import { request } from './api';

export default function App() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme);
  const [page, setPage] = useState('catalog');
  const [catalog, setCatalog] = useState({ services: [], categories: [] });
  const [cart, setCart] = useState({});
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const user = session?.user;
  const isAdmin = user?.role === 'admin';
  const count = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
    try {
      localStorage.setItem('work-3-theme', nextTheme);
    } catch {
      // Кнопка работает и при отключённом хранилище браузера.
    }
  }

  async function loadCatalog() {
    setLoading(true);
    setError('');
    try {
      setCatalog(await request('/catalog'));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  function addService(id) {
    changeQuantity(id, 1);
  }

  function changeQuantity(id, difference) {
    setCart((current) => {
      const quantity = (current[id] ?? 0) + difference;
      const updated = { ...current };
      if (quantity > 0) {
        updated[id] = quantity;
      } else {
        delete updated[id];
      }
      return updated;
    });
  }

  function removeService(id) {
    setCart((current) => {
      const updated = { ...current };
      delete updated[id];
      return updated;
    });
  }

  function login(nextSession) {
    setSession(nextSession);
    setPage(nextSession.user.role === 'admin' ? 'admin' : 'catalog');
  }

  async function logout() {
    setLogoutError('');
    try {
      await request('/logout', { method: 'POST', token: session.token });
    } catch (failure) {
      setLogoutError(failure.message);
    } finally {
      setSession(null);
      setPage('catalog');
    }
  }

  return (
    <>
      <header>
        <div className="menu">
          <strong>Магазин видеоигр</strong>
          <nav aria-label="Меню">
            <button className={page === 'catalog' ? 'active' : ''} onClick={() => setPage('catalog')}>Каталог</button>
            {!isAdmin && (
              <button className={page === 'cart' ? 'active' : ''} onClick={() => setPage('cart')}>Корзина ({count})</button>
            )}
            {isAdmin && (
              <button className={page === 'admin' ? 'active' : ''} onClick={() => setPage('admin')}>Управление</button>
            )}
            {user
              ? <button onClick={logout}>Выйти</button>
              : <button className={page === 'login' ? 'active' : ''} onClick={() => setPage('login')}>Войти</button>}
            <button onClick={toggleTheme}>{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</button>
          </nav>
        </div>
      </header>
      <main>
        {logoutError && <p className="error" role="alert">{logoutError}</p>}
        {page === 'catalog' && (
          <Catalog catalog={catalog} loading={loading} error={error} onRetry={loadCatalog}
            onAdd={isAdmin ? undefined : addService} cart={cart} />
        )}
        {!isAdmin && page === 'cart' && (
          <Cart cart={cart} services={catalog.services} user={user}
            onChangeQuantity={changeQuantity} onRemove={removeService} />
        )}
        {page === 'login' && <Login onLogin={login} />}
        {page === 'admin' && isAdmin && (
          <Admin token={session.token} services={catalog.services} onCatalogChange={loadCatalog} />
        )}
      </main>
    </>
  );
}
