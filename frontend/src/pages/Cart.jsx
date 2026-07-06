import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Minus, Plus, X, ShoppingBag, ArrowRight, ShoppingCart } from "lucide-react";
import PageTransition from "@/components/PageTransition";
import CheckoutModal from "@/components/CheckoutModal";
import { useCart } from "@/context/CartContext";
import { CHF, mediaUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function Cart() {
  const nav = useNavigate();
  const { cart, removeItem, updateQty, clearCart, totalFor, countFor, mode } = useCart();
  const [checkoutMenu, setCheckoutMenu] = useState(null);

  const totalRestaurant = totalFor("restaurant");
  const totalEpicerie = totalFor("epicerie");
  const grand = totalRestaurant + totalEpicerie;

  const bothEmpty = countFor("restaurant") + countFor("epicerie") === 0;

  const sections = [
    { key: "restaurant", label: "Il Ristorante", to: "/commander", cta: "Ajouter des plats" },
    { key: "epicerie", label: "L'Épicerie", to: "/epicerie", cta: "Ajouter des produits" },
  ];

  return (
    <PageTransition>
      <section className="pt-32 pb-24 max-w-5xl mx-auto px-6 md:px-10">
        <div className="flex items-center gap-4 mb-4">
          <span className="w-10 h-px bg-terracotta" />
          <p className="text-[11px] tracking-[.4em] uppercase text-terracotta">Panier</p>
        </div>
        <h1 className="font-display text-5xl md:text-6xl mb-3">Votre panier</h1>
        <p className="text-muted2 mb-12">Vérifiez votre commande avant de passer au paiement.</p>

        {bothEmpty && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-ink/10 bg-cream p-12 text-center">
            <ShoppingCart size={48} strokeWidth={1.2} className="text-brand mx-auto mb-4" />
            <p className="font-display text-2xl mb-2">Votre panier est vide</p>
            <p className="text-muted2 mb-6">Ajoutez des produits depuis Il Ristorante ou L'Épicerie.</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link to="/commander" className="inline-flex items-center gap-2 bg-ink hover:bg-terracotta text-cream px-6 py-3 text-[12px] tracking-[.2em] uppercase transition-colors">
                Il Ristorante <ArrowRight size={16} />
              </Link>
              <Link to="/epicerie" className="inline-flex items-center gap-2 border border-ink hover:bg-ink hover:text-cream px-6 py-3 text-[12px] tracking-[.2em] uppercase text-ink transition-colors">
                L'Épicerie <ArrowRight size={16} />
              </Link>
            </div>
          </motion.div>
        )}

        <div className="space-y-10">
          {sections.map((s) => {
            const items = cart[s.key];
            if (items.length === 0) return null;
            const subtotal = totalFor(s.key);
            return (
              <div key={s.key} className="border border-ink/10 bg-cream" data-testid={`cart-section-${s.key}`}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-ink/10">
                  <div className="flex items-center gap-3">
                    <ShoppingBag size={18} strokeWidth={1.5} className="text-terracotta" />
                    <h2 className="font-display text-2xl">{s.label}</h2>
                    <span className="text-xs text-muted2">· {items.length} article{items.length > 1 ? "s" : ""}</span>
                  </div>
                  <button onClick={() => { if (confirm("Vider ce panier ?")) clearCart(s.key); }} data-testid={`clear-${s.key}`}
                    className="text-xs tracking-widest uppercase text-muted2 hover:text-destructive link-underline">Vider</button>
                </div>

                <div className="divide-y divide-ink/5">
                  {items.map((it) => (
                    <div key={it._uid} className="p-4 md:p-5 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-lg leading-tight">{it.name}</p>
                        {it.selected_addons.length > 0 && (
                          <p className="text-xs text-muted2 mt-1">+ {it.selected_addons.map(a=>a.name).join(", ")}</p>
                        )}
                        {it.note && <p className="text-xs italic text-muted2 mt-1">✎ {it.note}</p>}
                        <p className="text-brand text-sm mt-1">{CHF(it.unit_price + it.selected_addons.reduce((s,a)=>s+a.price,0))} / u.</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(s.key, it._uid, it.quantity - 1)} className="w-8 h-8 border border-ink/20 flex items-center justify-center hover:bg-cream-surface" data-testid={`qty-minus-${it._uid}`}><Minus size={12}/></button>
                        <span className="w-8 text-center">{it.quantity}</span>
                        <button onClick={() => updateQty(s.key, it._uid, it.quantity + 1)} className="w-8 h-8 border border-ink/20 flex items-center justify-center hover:bg-cream-surface" data-testid={`qty-plus-${it._uid}`}><Plus size={12}/></button>
                      </div>
                      <div className="text-right min-w-[80px]">
                        <p className="text-terracotta font-medium">{CHF(it.line_total)}</p>
                      </div>
                      <button onClick={() => removeItem(s.key, it._uid)} className="text-muted2 hover:text-destructive p-1" data-testid={`remove-${it._uid}`}><X size={16}/></button>
                    </div>
                  ))}
                </div>

                <div className="px-6 py-4 border-t border-ink/10 flex items-center justify-between gap-4 bg-cream-surface/60">
                  <div className="text-sm">
                    <p className="text-muted2 text-xs">Sous-total {s.label}</p>
                    <p className="font-display text-2xl text-terracotta">{CHF(subtotal)}</p>
                    <p className="text-[11px] text-muted2 mt-0.5">TVA incluse</p>
                  </div>
                  <div className="flex gap-2">
                    <Link to={s.to} className="hidden sm:inline-flex items-center gap-2 border border-ink/20 hover:border-brand px-4 py-3 text-[11px] tracking-[.2em] uppercase transition-colors">
                      {s.cta}
                    </Link>
                    <Button onClick={() => setCheckoutMenu(s.key)} data-testid={`checkout-${s.key}`}
                      className="bg-ink hover:bg-brand text-cream rounded-none tracking-[.2em] uppercase h-11 px-6 text-[12px]">
                      Passer commande <ArrowRight size={14} className="ml-2" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!bothEmpty && (
          <div className="mt-10 border border-terracotta/40 bg-terracotta/5 p-6 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-[11px] tracking-widest uppercase text-muted2 mb-1">Total général</p>
              <p className="font-display text-4xl text-ink">{CHF(grand)}</p>
              <p className="text-xs text-muted2 mt-1">TVA comprise · Paiement sur place</p>
            </div>
            <p className="text-sm text-muted2 max-w-sm text-right">
              Les commandes Restaurant et Épicerie sont validées séparément afin d'assurer la meilleure préparation.
            </p>
          </div>
        )}
      </section>

      {checkoutMenu && (
        <CheckoutModal open={!!checkoutMenu} onOpenChange={(v) => !v && setCheckoutMenu(null)}
          menuType={checkoutMenu}
          onSuccess={(orderId) => { clearCart(checkoutMenu); setCheckoutMenu(null); nav(`/suivi/${orderId}`); }} />
      )}
    </PageTransition>
  );
}
