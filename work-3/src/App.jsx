import { useEffect, useState } from 'react';
import Admin from './Admin';
import Cart from './Cart';
import Catalog from './Catalog';
import Login from './Login';
import { request } from './api';

export default function App() {
  const [page, setPage] = useState('catalog');
  const [catalog, setCatalog] = useState({ services: [], categories: [] });
  const [cart, setCart] = useState({});
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const user = session?.user;
  const count = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);

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
    setCart((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
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
          <strong>Салон красоты</strong>
          <nav aria-label="Меню">
            <button className={page === 'catalog' ? 'active' : ''} onClick={() => setPage('catalog')}>Каталог</button>
            <button className={page === 'cart' ? 'active' : ''} onClick={() => setPage('cart')}>Корзина ({count})</button>
            {user?.role === 'admin' && (
              <button className={page === 'admin' ? 'active' : ''} onClick={() => setPage('admin')}>Управление</button>
            )}
            {user
              ? <button onClick={logout}>Выйти</button>
              : <button className={page === 'login' ? 'active' : ''} onClick={() => setPage('login')}>Войти</button>}
          </nav>
        </div>
      </header>
      <main>
        {logoutError && <p className="error" role="alert">{logoutError}</p>}
        {page === 'catalog' && (
          <Catalog catalog={catalog} loading={loading} error={error} onRetry={loadCatalog} onAdd={addService} cart={cart} />
        )}
        {page === 'cart' && <Cart cart={cart} services={catalog.services} user={user} onRemove={removeService} />}
        {page === 'login' && <Login onLogin={login} />}
        {page === 'admin' && user?.role === 'admin' && (
          <Admin token={session.token} services={catalog.services} onCatalogChange={loadCatalog} />
        )}
      </main>
    </>
  );
}
