import { createContext, useEffect, useState } from 'react';

export const ShopContext = createContext(null);
const THEME_KEY = 'work-2-theme';

export function ShopProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Тема продолжает работать, если браузер заблокировал хранилище.
    }
  }, [theme]);

  function addProduct(product) {
    setCart((current) => {
      if (current.some((item) => item.id === product.id)) {
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...current, { ...product, quantity: 1 }];
    });
  }

  function removeProduct(id) {
    setCart((current) => current.filter((item) => item.id !== id));
  }

  function decreaseProduct(id) {
    setCart((current) => current
      .map((item) => item.id === id ? { ...item, quantity: item.quantity - 1 } : item)
      .filter((item) => item.quantity > 0)
    );
  }

  function toggleTheme() {
    setTheme((current) => current === 'light' ? 'dark' : 'light');
  }

  return (
    <ShopContext.Provider value={{ cart, addProduct, decreaseProduct, removeProduct, theme, toggleTheme }}>
      {children}
    </ShopContext.Provider>
  );
}
