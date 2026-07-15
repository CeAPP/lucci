import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Minus, X, ShoppingBag, Clock } from "lucide-react";
import PageTransition from "@/components/PageTransition";
import api, { mediaUrl, CHF } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import OrderModePicker from "@/components/OrderModePicker";
import CheckoutModal from "@/components/CheckoutModal";
import ScheduleGate from "@/components/ScheduleGate";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function isOpenNow(schedule) {
  if (!schedule) return { open: false, nextLabel: null };
  const now = new Date();
  const dk = DAY_KEYS[now.getDay()];
  const d = schedule.days?.[dk];
  if (!d || d.closed) return { open: false, nextLabel: null };
  const cur = now.getHours() * 60 + now.getMinutes();
  const toMin = (s) => { const [h,m] = s.split(":").map(Number); return h*60+m; };
  if (d.lunch_start && d.lunch_end && cur >= toMin(d.lunch_start) && cur <= toMin(d.lunch_end)) return { open: true };
  if (d.dinner_start && d.dinner_end && cur >= toMin(d.dinner_start) && cur <= toMin(d.dinner_end)) return { open: true };
  // Next opening today or tomorrow
  const next = [d.lunch_start, d.dinner_start].filter(Boolean).find((t) => toMin(t) > cur);
  if (next) return { open: false, nextLabel: `Ouvre à ${next}` };
  return { open: false, nextLabel: "Fermé aujourd'hui" };
}

export default function Menu({ menuType: propMenuType }) {
  const params = useParams();
  const menuType = propMenuType || (params.menuType === "epicerie" ? "epicerie" : "restaurant");
  const nav = useNavigate();
  const { cart, addItem, mode, setMode, totalFor, countFor, removeItem, updateQty, clearCart } = useCart();

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [addonGroups, setAddonGroups] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [activeCat, setActiveCat] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showModePicker, setShowModePicker] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    const scheduleKind = menuType === "epicerie" ? "epicerie" : "restaurant";
    api.get("/categories", { params: { menu_type: menuType } }).then((r) => setCategories(r.data));
    api.get("/products", { params: { menu_type: menuType } }).then((r) => setProducts(r.data));
    api.get("/addon-groups").then((r) => setAddonGroups(r.data));
    api.get(`/schedule/${scheduleKind}`).then((r) => setSchedule(r.data));
  }, [menuType]);

  // Show mode picker on first arrival if no mode for this menu
  useEffect(() => {
    if (!mode || mode.menu_type !== menuType) setShowModePicker(true);
    else setShowModePicker(false);
  }, [menuType, mode]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return products.filter((p) => (!activeCat || p.category_id === activeCat) && (!s || p.name.toLowerCase().includes(s) || (p.description||"").toLowerCase().includes(s)));
  }, [products, activeCat, search]);

  const grouped = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => map.set(c.id, { cat: c, items: [] }));
    filtered.forEach((p) => { const g = map.get(p.category_id); if (g) g.items.push(p); });
    return Array.from(map.values()).filter((g) => g.items.length > 0);
  }, [filtered, categories]);

  const openState = useMemo(() => isOpenNow(schedule), [schedule]);
  const cartCount = countFor(menuType);
  const cartTotal = totalFor(menuType);

  const heroTitle = menuType === "epicerie" ? "L'Épicerie" : "Il Ristorante";
  const heroSub = menuType === "epicerie"
    ? "Produits d'exception, sélectionnés en Italie. À emporter ou livrés — jusqu'à 2 semaines à l'avance."
    : "Cuisine du marché, à emporter.";
  const heroTag = menuType === "epicerie" ? "Bottega" : "Trattoria";
  const accentClass = menuType === "epicerie" ? "bg-brand" : "bg-terracotta";
  const accentTextClass = menuType === "epicerie" ? "text-brand" : "text-terracotta";
  const accentBorderClass = menuType === "epicerie" ? "border-brand" : "border-terracotta";

  return (
    <PageTransition>
      {/* HERO with editorial color */}
      <section className="relative pt-32 pb-14 overflow-hidden">
        <div className={`absolute inset-0 ${menuType === "epicerie" ? "bg-gradient-to-br from-brand/8 to-cream" : "bg-gradient-to-br from-terracotta/8 to-cream"}`} />
        <div className="absolute top-24 right-8 md:right-16 font-display text-[10rem] md:text-[14rem] leading-none opacity-[.07] select-none">
          {menuType === "epicerie" ? "Bottega" : "Menu"}
        </div>
        <div className="relative max-w-[1400px] mx-auto px-6 md:px-10">
          <div className="flex items-center gap-4 mb-5">
            <span className={`w-12 h-px ${menuType === "epicerie" ? "bg-brand" : "bg-terracotta"}`} />
            <p className={`text-[11px] tracking-[.4em] uppercase ${accentTextClass}`}>{heroTag} · Angelucci's</p>
          </div>
          <h1 className="font-display text-6xl md:text-7xl lg:text-8xl mb-4 leading-[.95]">
            {heroTitle}<span className={accentTextClass}>.</span>
          </h1>
          <p className="text-muted2 max-w-2xl text-lg">{heroSub}</p>
          {mode && mode.menu_type === menuType && (
            <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
              <span className={`inline-flex items-center gap-2 ${accentClass} text-cream px-4 py-2 text-[11px] tracking-widest uppercase`}>
                {mode.fulfillment_type === "delivery" ? "À emporter" : "À emporter"}
              </span>
              <span className={`inline-flex items-center gap-2 border ${accentBorderClass}/40 px-4 py-2 text-[12px]`}>
                <Clock size={13} strokeWidth={1.5} /> {mode.pickup_time_label || "Dès que possible"}
              </span>
              <button onClick={() => setShowModePicker(true)} className="link-underline text-muted2 text-xs uppercase tracking-widest" data-testid="change-mode-btn">Modifier</button>
              {menuType === "restaurant" && !openState.open && (
                <span className="inline-flex items-center gap-2 border border-ochre/60 bg-ochre/15 text-[#8B6420] px-3 py-2 text-[11px] tracking-widest uppercase" data-testid="closed-banner">
                  {openState.nextLabel || "Fermé"}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* MAIN */}
      <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-12 pb-40 grid lg:grid-cols-[240px_1fr] gap-12">
        {/* Categories sidebar sticky */}
        <aside className="lg:sticky lg:top-28 self-start">
          <div className="mb-6">
            <div className="relative">
              <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted2" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…" data-testid="menu-search"
                className="pl-9 bg-transparent border-ink/20 rounded-none focus-visible:ring-brand" />
            </div>
          </div>
          <p className="text-[10px] tracking-[.3em] uppercase text-muted2 mb-3 hidden lg:block">Catégories</p>
          <ul className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            <li><button onClick={() => setActiveCat(null)} data-testid="cat-all"
              className={`w-full text-left px-3 py-2.5 text-sm tracking-wide transition-all border-l-2 ${!activeCat ? `${accentBorderClass} bg-cream-surface font-medium` : "border-transparent hover:border-ink/20 hover:bg-cream-surface/60"}`}>Tout</button></li>
            {categories.map((c, i) => (
              <li key={c.id}><button onClick={() => setActiveCat(c.id)} data-testid={`cat-${c.id}`}
                className={`w-full text-left px-3 py-2.5 text-sm tracking-wide whitespace-nowrap transition-all border-l-2 flex items-center justify-between ${activeCat===c.id ? `${accentBorderClass} bg-cream-surface font-medium` : "border-transparent hover:border-ink/20 hover:bg-cream-surface/60"}`}>
                <span>{c.name}</span>
                <span className="text-[10px] text-muted2 tracking-widest">{String(i+1).padStart(2,"0")}</span>
              </button></li>
            ))}
          </ul>
        </aside>

        {/* Products */}
        <div className="space-y-16">
          {grouped.length === 0 && (
            <p className="text-muted2">Aucun produit disponible pour le moment.</p>
          )}
          {grouped.map(({ cat, items }, gi) => (
            <div key={cat.id} id={`cat-${cat.id}`}>
              <div className="flex items-baseline gap-4 mb-8">
                <span className={`font-display text-2xl ${accentTextClass}`}>{String(gi+1).padStart(2,"0")}</span>
                <h2 className="font-display text-3xl md:text-4xl">{cat.name}</h2>
                <div className="flex-1 border-t border-ink/10" />
                <span className="text-[10px] tracking-widest uppercase text-muted2">{items.length} produits</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
                {items.map((p) => (
                  <button key={p.id} onClick={() => setSelectedProduct(p)} data-testid={`product-${p.id}`}
                    className={`group text-left bg-cream border border-ink/8 hover:border-terracotta hover:shadow-lg transition-all overflow-hidden flex flex-row relative`}>
                    {p.image_url ? (
                      <div className="w-32 sm:w-44 shrink-0 aspect-square overflow-hidden relative">
                        <img src={mediaUrl(p.image_url)} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                      </div>
                    ) : (
                      <div className={`w-32 sm:w-44 shrink-0 aspect-square flex items-center justify-center ${menuType==="epicerie" ? "bg-brand/10" : "bg-terracotta/10"}`}>
                        <span className={`font-display text-5xl ${accentTextClass}/50`}>A</span>
                      </div>
                    )}
                    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-display text-xl mb-1 leading-tight group-hover:text-terracotta transition-colors">{p.name}</h3>
                        <p className="text-sm text-muted2 line-clamp-2 mb-3 leading-relaxed">{p.description}</p>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`font-medium ${accentTextClass}`}>{CHF(p.price)}</span>
                        <span className="inline-flex items-center gap-1.5 text-[11px] tracking-[.2em] uppercase text-ink group-hover:text-terracotta transition-colors">
                          <Plus size={14} strokeWidth={1.5} /> Ajouter
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRODUCT MODAL */}
      <ProductModal product={selectedProduct} addonGroups={addonGroups}
        onClose={() => setSelectedProduct(null)}
        onAdd={(item) => { addItem(menuType, item); setSelectedProduct(null); toast.success(`${item.name} ajouté au panier`); }} />

      {/* MODE PICKER */}
      <OrderModePicker open={showModePicker} onOpenChange={setShowModePicker}
        menuType={menuType} schedule={schedule}
        onConfirm={(m) => { setMode({ ...m, menu_type: menuType }); setShowModePicker(false); }} />

      {/* CHECKOUT */}
      {showCheckout && (
        <CheckoutModal open={showCheckout} onOpenChange={setShowCheckout}
          menuType={menuType} onSuccess={(orderId) => { clearCart(menuType); setShowCheckout(false); nav(`/suivi/${orderId}`); }} />
      )}

      {/* STICKY CART */}
      {cartCount > 0 && (
        <div className={`fixed bottom-0 left-0 right-0 z-40 bg-ink text-cream border-t-2 ${accentBorderClass}`} data-testid="sticky-cart">
          <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <ShoppingBag size={20} strokeWidth={1.5} className={accentTextClass} />
              <span className="font-display text-2xl">{cartCount} article{cartCount > 1 ? "s" : ""}</span>
              <span className="hidden sm:inline text-cream/60">·</span>
              <span className={`hidden sm:inline ${accentTextClass}`}>{CHF(cartTotal)}</span>
            </div>
            <div className="flex items-center gap-3">
              <details className="hidden md:block">
                <summary className="cursor-pointer text-sm tracking-widest uppercase link-underline">Voir le panier</summary>
              </details>
              <button onClick={() => setShowCheckout(true)} data-testid="open-checkout-btn"
                className={`${accentClass} hover:brightness-95 text-cream px-6 py-3 text-sm tracking-widest uppercase transition-all`}>
                Commander · {CHF(cartTotal)}
              </button>
            </div>
          </div>
          {/* Expandable cart */}
          <div className="max-w-[1400px] mx-auto px-6 md:px-10 pb-3 max-h-40 overflow-y-auto">
            {cart[menuType].map((it) => (
              <div key={it._uid} className="flex items-center gap-4 text-sm py-1.5">
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(menuType, it._uid, it.quantity - 1)} className="w-6 h-6 border border-cream/30 flex items-center justify-center hover:bg-brand hover:border-brand"><Minus size={12}/></button>
                  <span className="w-6 text-center">{it.quantity}</span>
                  <button onClick={() => updateQty(menuType, it._uid, it.quantity + 1)} className="w-6 h-6 border border-cream/30 flex items-center justify-center hover:bg-brand hover:border-brand"><Plus size={12}/></button>
                </div>
                <span className="flex-1 truncate">{it.name}{it.selected_addons.length > 0 && <span className="text-cream/50"> · {it.selected_addons.map(a=>a.name).join(", ")}</span>}</span>
                <span className="text-brand">{CHF(it.line_total)}</span>
                <button onClick={() => removeItem(menuType, it._uid)} className="text-cream/60 hover:text-cream"><X size={14}/></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageTransition>
  );
}

function ProductModal({ product, addonGroups, onClose, onAdd }) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState({}); // groupId -> [optionIds]

  useEffect(() => { setQty(1); setNote(""); setSelected({}); }, [product?.id]);

  if (!product) return null;
  const groups = (product.addon_group_ids || []).map((gid) => addonGroups.find((g) => g.id === gid)).filter(Boolean);

  const addonsFlat = groups.flatMap((g) => (selected[g.id] || []).map((oid) => g.options.find((o) => o.id === oid)).filter(Boolean));
  const addonsTotal = addonsFlat.reduce((s, a) => s + (a?.price || 0), 0);
  const lineTotal = (product.price + addonsTotal) * qty;

  const canAdd = groups.every((g) => !g.required || (selected[g.id] && selected[g.id].length > 0));

  const toggle = (g, opt) => {
    setSelected((s) => {
      const cur = s[g.id] || [];
      if (g.multi) {
        return { ...s, [g.id]: cur.includes(opt.id) ? cur.filter((x) => x !== opt.id) : [...cur, opt.id] };
      }
      return { ...s, [g.id]: [opt.id] };
    });
  };

  return (
    <Dialog open={!!product} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl p-0 bg-cream border-ink/10 rounded-none overflow-hidden" data-testid="product-modal">
        <DialogTitle className="sr-only">{product.name}</DialogTitle>
        <div className="grid md:grid-cols-2">
          {product.image_url && (
            <div className="aspect-square md:aspect-auto overflow-hidden bg-cream-surface">
              <img src={mediaUrl(product.image_url)} alt={product.name} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-8 max-h-[80vh] overflow-y-auto">
            <h3 className="font-display text-3xl mb-2">{product.name}</h3>
            <p className="text-brand text-lg mb-4">{CHF(product.price)}</p>
            <p className="text-muted2 mb-6">{product.description}</p>

            {groups.map((g) => (
              <div key={g.id} className="mb-6">
                <div className="flex items-baseline justify-between mb-3">
                  <p className="text-xs tracking-[.25em] uppercase">{g.name}</p>
                  <span className="text-xs text-muted2">{g.required ? "Obligatoire" : "Optionnel"}</span>
                </div>
                {g.multi ? (
                  <div className="space-y-2">
                    {g.options.map((o) => (
                      <label key={o.id} className="flex items-center justify-between gap-3 border border-ink/10 p-3 cursor-pointer hover:border-brand transition-colors">
                        <div className="flex items-center gap-3">
                          <Checkbox checked={(selected[g.id] || []).includes(o.id)} onCheckedChange={() => toggle(g, o)} data-testid={`addon-${o.id}`} />
                          <span>{o.name}</span>
                        </div>
                        {o.price > 0 && <span className="text-brand text-sm">+{CHF(o.price)}</span>}
                      </label>
                    ))}
                  </div>
                ) : (
                  <RadioGroup value={(selected[g.id] || [])[0] || ""} onValueChange={(v) => setSelected((s) => ({ ...s, [g.id]: [v] }))}>
                    {g.options.map((o) => (
                      <label key={o.id} className="flex items-center justify-between gap-3 border border-ink/10 p-3 cursor-pointer hover:border-brand transition-colors">
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={o.id} data-testid={`addon-${o.id}`} />
                          <span>{o.name}</span>
                        </div>
                        {o.price > 0 && <span className="text-brand text-sm">+{CHF(o.price)}</span>}
                      </label>
                    ))}
                  </RadioGroup>
                )}
              </div>
            ))}

            <div className="mb-6">
              <Label className="text-xs tracking-[.25em] uppercase mb-2 block">Commentaire</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="commentaire"
                data-testid="product-note" className="bg-transparent border-ink/20 rounded-none focus-visible:ring-brand resize-none" rows={2} />
            </div>

            <div className="flex items-center justify-between gap-4 mt-8">
              <div className="flex items-center gap-2">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-10 border border-ink/20 flex items-center justify-center hover:bg-cream-surface" data-testid="qty-minus"><Minus size={14}/></button>
                <span className="w-10 text-center font-display text-xl">{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} className="w-10 h-10 border border-ink/20 flex items-center justify-center hover:bg-cream-surface" data-testid="qty-plus"><Plus size={14}/></button>
              </div>
              <Button disabled={!canAdd} data-testid="add-to-cart-btn"
                onClick={() => onAdd({
                  product_id: product.id, name: product.name, quantity: qty,
                  unit_price: product.price, selected_addons: addonsFlat.map((a) => ({ id: a.id, name: a.name, price: a.price })),
                  note, line_total: lineTotal,
                })}
                className="flex-1 bg-brand hover:bg-brand-hover text-cream rounded-none tracking-widest uppercase h-12">
                Ajouter · {CHF(lineTotal)}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
