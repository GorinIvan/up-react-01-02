import { cloneElement, useId } from 'react';

export function RequestState({ request }) {
  if (request.loading) return <p className="notice" role="status">Загрузка…</p>;
  if (!request.error) return null;
  return <div className="notice error" role="alert">{request.error} <button type="button" onClick={request.retry}>Повторить</button></div>;
}

export function ActionError({ action }) {
  return action.error ? <p className="notice error" role="alert">{action.error}</p> : null;
}

export function Field({ label, textarea, children, ...props }) {
  const fieldId = useId();
  return <div className="field"><label htmlFor={fieldId}>{label}</label>
    {children ? cloneElement(children, { id: fieldId })
      : textarea ? <textarea id={fieldId} {...props} /> : <input id={fieldId} {...props} />}
  </div>;
}

export function ShoeImage({ product, className = '' }) {
  return <div className={'shoe-image ' + className}>
    {product.image ? <img alt={product.name} src={product.image} onError={(event) => { event.currentTarget.hidden = true; }} /> : null}
  </div>;
}

export const formValues = (event) => Object.fromEntries(new FormData(event.currentTarget));
