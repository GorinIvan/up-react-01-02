export async function request(path, { method = 'GET', data, token } = {}) {
  const headers = {};
  if (data !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;

  let response;
  try {
    response = await fetch('/api' + path, { method, headers, body: JSON.stringify(data) });
  } catch {
    throw new Error('Нет связи с сервером. Проверьте, запущен ли API.');
  }

  const result = await response.json().catch(() => null);
  if (!response.ok || result === null) {
    throw new Error(result?.error || 'Не удалось получить данные. Проверьте, запущен ли API.');
  }
  return result;
}
