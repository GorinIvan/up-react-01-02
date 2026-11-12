import { useContext, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { ShopContext, ShopProvider } from './ShopContext';

const products = [
  { id: 1, name: 'Блокнот', price: 280 },
  { id: 2, name: 'Карандаши', price: 350 },
  { id: 3, name: 'Линейка', price: 120 },
  { id: 4, name: 'Ручка', price: 90 },
  { id: 5, name: 'Пенал', price: 490 },
];

function Catalog() {
  const { addProduct } = useContext(ShopContext);
  const navigate = useNavigate();

  function handleAdd(product) {
    addProduct(product);
    navigate('/cart');
  }

  return (
    <>
      <h1>Каталог канцтоваров</h1>
      <div className="grid">
        {products.map((product) => (
          <article key={product.id}>
            <h2>{product.name}</h2>
            <p>{product.price} ₽</p>
            <button onClick={() => handleAdd(product)}>В корзину</button>
          </article>
        ))}
      </div>
    </>
  );
}

function Cart() {
  const { cart, removeProduct } = useContext(ShopContext);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <>
      <h1>Корзина</h1>
      {cart.length === 0 && <p>Корзина пуста.</p>}
      {cart.map((item) => (
        <article className="cart-row" key={item.id}>
          <div>
            <h2>{item.name}</h2>
            <p>{item.price} ₽ × {item.quantity} шт. = {item.price * item.quantity} ₽</p>
          </div>
          <button onClick={() => removeProduct(item.id)}>Удалить</button>
        </article>
      ))}
      <p className="total">Итого: {total} ₽</p>
      <NavLink to="/">Вернуться в каталог</NavLink>
    </>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  function handleSubmit(event) {
    event.preventDefault();
    if (email.trim() !== 'student@example.test' || password !== 'student123') {
      setError('Проверьте учебный email и пароль.');
      return;
    }
    onLogin(email.trim());
    navigate('/dashboard', { replace: true });
  }

  return (
    <>
      <h1>Вход</h1>
      <p>Учебный вход: student@example.test / student123</p>
      <form onSubmit={handleSubmit}>
        <label>Email <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Пароль <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <p role="alert">{error}</p>}
        <button>Войти</button>
      </form>
    </>
  );
}

function Shop() {
  const { cart, theme, toggleTheme } = useContext(ShopContext);
  const [email, setEmail] = useState('');
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="shop" data-theme={theme}>
      <header>
        <div className="menu">
          <nav aria-label="Меню">
            <NavLink to="/" end>Каталог</NavLink>
            <NavLink to="/cart">Корзина ({count})</NavLink>
            <NavLink to="/login">Вход</NavLink>
            <NavLink to="/dashboard">Личный кабинет</NavLink>
          </nav>
          <button onClick={toggleTheme}>{theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}</button>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/login" element={<Login onLogin={setEmail} />} />
          <Route path="/dashboard" element={email
            ? <><h1>Личный кабинет</h1><p>Вы вошли как {email}.</p></>
            : <Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ShopProvider><Shop /></ShopProvider>
    </BrowserRouter>
  );
}
