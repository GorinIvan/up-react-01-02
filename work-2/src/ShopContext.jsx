import { createContext, useState } from 'react';

export const ShopContext = createContext(null);

export function ShopProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [theme, setTheme] = useState('light');

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

  function toggleTheme() {
    setTheme((current) => current === 'light' ? 'dark' : 'light');
  }

  return (
    <ShopContext.Provider value={{ cart, addProduct, removeProduct, theme, toggleTheme }}>
      {children}
    </ShopContext.Provider>
  );
}
