import { useState } from 'react';
import { request } from './api';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Заполните email и пароль.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Введите email в формате name@example.com.');
      return;
    }

    setError('');
    setPending(true);
    try {
      onLogin(await request('/login', { method: 'POST', data: { email: email.trim(), password } }));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h1>Вход</h1>
      <form className="panel login" onSubmit={submit} noValidate>
        <label>Email
          <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>Пароль
          <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={pending}>{pending ? 'Выполняется вход…' : 'Войти'}</button>
      </form>
    </>
  );
}
