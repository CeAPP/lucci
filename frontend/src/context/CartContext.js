import React, { createContext, useContext, useEffect, useState } from "react";

const CartCtx = createContext(null);
export const useCart = () => useContext(CartCtx);

const KEY = "angel_cart_v1";
const MODE_KEY = "angel_mode_v1";

const readCart = () => {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    if (c && typeof c === "object" && Array.isArray(c.restaurant) && Array.isArray(c.epicerie)) return c;
  } catch (e) { /* noop */ }
  return { restaurant: [], epicerie: [] };
};
const readMode = () => {
  try {
    const m = JSON.parse(localStorage.getItem(MODE_KEY) || "null");
    if (m && typeof m === "object") return m;
  } catch (e) { /* noop */ }
  return null;
};

export function CartProvider({ children }) {
  const [cart, setCart] = useState(readCart);
  const [mode, setMode] = useState(readMode);

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(cart)); }, [cart]);
  useEffect(() => { if (mode) localStorage.setItem(MODE_KEY, JSON.stringify(mode)); }, [mode]);

  const addItem = (menuType, item) => {
    setCart((c) => ({ ...c, [menuType]: [...c[menuType], { ...item, _uid: Date.now() + Math.random() }] }));
  };
  const removeItem = (menuType, uid) => {
    setCart((c) => ({ ...c, [menuType]: c[menuType].filter((it) => it._uid !== uid) }));
  };
  const clearCart = (menuType) => setCart((c) => ({ ...c, [menuType]: [] }));
  const updateQty = (menuType, uid, qty) => {
    setCart((c) => ({
      ...c,
      [menuType]: c[menuType].map((it) => it._uid === uid ? { ...it, quantity: Math.max(1, qty), line_total: (it.unit_price + it.selected_addons.reduce((s, a) => s + a.price, 0)) * Math.max(1, qty) } : it),
    }));
  };

  const totalFor = (menuType) => cart[menuType].reduce((s, it) => s + it.line_total, 0);
  const countFor = (menuType) => cart[menuType].reduce((s, it) => s + it.quantity, 0);

  return (
    <CartCtx.Provider value={{ cart, addItem, removeItem, clearCart, updateQty, totalFor, countFor, mode, setMode }}>
      {children}
    </CartCtx.Provider>
  );
}
