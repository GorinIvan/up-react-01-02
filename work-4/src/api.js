import { useEffect, useState } from 'react';

export async function api(path, method = 'GET', body, signal) {
  let response;
  try {
    response = await fetch('/api' + path, {
      method,
      signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Сервер недоступен. Проверьте его запуск и повторите запрос.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || 'Запрос не выполнен. Попробуйте ещё раз.');
  return data;
}

// Каждый экран показывает ожидание и ошибку загрузки. Старый запрос отменяется при смене страницы.
export function useData(path, scope = '') {
  const [request, setRequest] = useState(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    api(path, 'GET', undefined, controller.signal).then(
      (data) => setRequest({ path, scope, version, data, error: '' }),
      (error) => {
        if (!controller.signal.aborted) setRequest({ path, scope, version, data: null, error: error.message });
      },
    );
    return () => controller.abort();
  }, [path, scope, version]);
  const current = request?.path === path && request.scope === scope && request.version === version ? request : null;
  return { ...current, loading: Boolean(path && !current), retry: () => setVersion((previous) => previous + 1) };
}

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(action) {
    setError('');
    setBusy(true);
    try {
      return await action();
    } catch (failure) {
      setError(failure.message);
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run, clear: () => setError('') };
}

export const money = (amount) => new Intl.NumberFormat('ru-RU').format(amount) + ' ₽';
export const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date());
export const dateText = (value) => value.slice(0, 10).split('-').reverse().join('.');
export const statusNames = { new: 'Новый', shipping: 'В доставке', delivered: 'Доставлен', cancelled: 'Отменён' };
export const sizes = Array.from({ length: 11 }, (_, index) => 36 + index);
