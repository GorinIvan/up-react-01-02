export function discountedPrice(price, percent) {
  return Math.round(price * (100 - percent) / 100);
}

export function rubles(kopecks) {
  return (kopecks / 100).toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: kopecks % 100 === 0 ? 0 : 2,
  });
}
