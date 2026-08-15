import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Pencil, ShoppingBag, CheckCircle2, AlertCircle } from "lucide-react";
import PageTransition from "@/components/PageTransition";
import OrderModePicker from "@/components/OrderModePicker";
import { useCart } from "@/context/CartContext";
import api, { CHF } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export default function Checkout() {
  const { menuType } = useParams();
  const nav = useNavigate();
  const { cart, mode, setMode, totalFor, clearCart } = useCart();
  const items = cart[menuType] || [];
  const subtotal = totalFor(menuType);
  const vatRate = 0.026;
  const vatAmount = (subtotal * vatRate) / (1 + vatRate);

  const [schedule, setSchedule] = useState(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    first_name: "", last_name: "", phone: "", email: "",
    marketing_opt_in: false, promo_code: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const kind = menuType === "epicerie" ? "epicerie" : "restaurant";
    api.get(`/schedule/${kind}`).then((r) => setSchedule(r.data)).catch(() => {});
  }, [menuType]);

  useEffect(() => {
    if (submitted) return; // order in-flight — do not bounce back to menu when cart empties
    if (items.length === 0) nav(`/${menuType === "epicerie" ? "epicerie" : "commander"}`);
    // no time set for this menu — open the picker
    if (!mode || mode.menu_type !== menuType) setShowTimePicker(true);
  }, [items.length, mode, menuType, nav, submitted]);

  const currentTimeLabel = mode?.menu_type === menuType ? mode.pickup_time_label : null;

  const on = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target ? e.target.value : e }));

  const submit = async () => {
    setError("");
    if (!form.first_name || !form.last_name || !form.phone || !form.email) {
      setError("Merci de remplir tous les champs requis.");
      return;
    }
    if (!currentTimeLabel) {
      setError("Merci de choisir un créneau de retrait.");
      setShowTimePicker(true);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        menu_type: menuType,
        fulfillment_type: "takeaway",
        pickup_time: mode.pickup_time || "ASAP",
        customer: {
          first_name: form.first_name, last_name: form.last_name,
          phone: form.phone, email: form.email,
          address: "", postal_code: "",
          marketing_opt_in: form.marketing_opt_in,
        },
        items: items.map(({ _uid, ...rest }) => rest),
        promo_code: form.promo_code || null,
      };
      const { data } = await api.post("/orders", payload);
      setSubmitted(true); // suppress the "empty cart" redirect that would otherwise fire when clearCart runs
      clearCart(menuType);
      toast.success(`Commande #${data.order_number} confirmée`);
      // Immediate hard redirect to tracking page (replace history so back button doesn't go to checkout)
      nav(`/suivi/${data.id}`, { replace: true });
    } catch (e) {
      setError(e.response?.data?.detail || "Erreur lors de la commande");
    } finally {
      setLoading(false);
    }
  };

  const label = menuType === "epicerie" ? "L'Épicerie" : "Il Ristorante";

  if (items.length === 0 && !submitted) return null;

  return (
    <PageTransition>
      <section className="pt-28 pb-24 max-w-4xl mx-auto px-5 md:px-10">
        <Link to="/panier" className="inline-flex items-center gap-2 text-sm text-muted2 hover:text-ink mb-6" data-testid="back-to-cart">
          <ArrowLeft size={14} /> Retour au panier
        </Link>

        <div className="flex items-center gap-4 mb-3">
          <span className="w-10 h-px bg-terracotta" />
          <p className="text-[11px] tracking-[.4em] uppercase text-terracotta">Paiement</p>
        </div>
        <h1 className="font-display text-4xl md:text-5xl mb-2">Finaliser</h1>
        <p className="text-muted2 mb-8 text-sm md:text-base">
          Vérifiez votre créneau et vos coordonnées avant de confirmer votre commande {label}.
        </p>

        {/* Time slot section */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="border-2 border-brand bg-brand/5 p-4 md:p-5 mb-6" data-testid="checkout-time-section">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <Clock size={22} strokeWidth={1.5} className="text-brand mt-0.5" />
              <div>
                <p className="text-[10px] tracking-[.25em] uppercase text-brand mb-1">Créneau de retrait</p>
                {currentTimeLabel ? (
                  <p className="font-display text-xl md:text-2xl" data-testid="checkout-time-label">{currentTimeLabel}</p>
                ) : (
                  <p className="font-display text-lg text-muted2">Aucun créneau choisi</p>
                )}
              </div>
            </div>
            <Button onClick={() => setShowTimePicker(true)} data-testid="change-time-btn"
              variant="outline" className="border-brand text-brand hover:bg-brand hover:text-cream rounded-none uppercase text-xs tracking-widest">
              <Pencil size={12} className="mr-2" /> Changer l&apos;heure
            </Button>
          </div>
        </motion.div>

        {/* Order summary */}
        <div className="border border-ink/10 bg-cream p-5 mb-6" data-testid="checkout-summary">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBag size={16} className="text-terracotta" />
            <p className="text-xs tracking-[.25em] uppercase">Récapitulatif — {label}</p>
          </div>
          <div className="text-sm space-y-1.5">
            {items.map((it) => (
              <div key={it._uid} className="flex justify-between gap-3">
                <span className="flex-1">
                  {it.quantity}× {it.name}
                  {it.selected_addons.length > 0 && <span className="text-muted2"> · {it.selected_addons.map((a) => a.name).join(", ")}</span>}
                </span>
                <span>{CHF(it.line_total)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-ink/10 pt-2 mt-3 space-y-1 text-sm">
            <div className="flex justify-between text-xs text-muted2">
              <span>dont TVA ({(vatRate * 100).toFixed(1)}%) — incluse</span>
              <span>{CHF(vatAmount)}</span>
            </div>
            <div className="flex justify-between font-display text-xl pt-2 border-t border-ink/10">
              <span>Total</span>
              <span className="text-brand">{CHF(subtotal)}</span>
            </div>
          </div>
        </div>

        {/* Customer info form */}
        <div className="border border-ink/10 bg-cream p-5 mb-6">
          <p className="text-xs tracking-[.25em] uppercase text-brand mb-4">Vos coordonnées</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs tracking-widest uppercase">Prénom *</Label>
              <Input value={form.first_name} onChange={on("first_name")} data-testid="checkout-first-name"
                className="bg-transparent border-ink/20 rounded-none focus-visible:ring-brand mt-1.5" />
            </div>
            <div>
              <Label className="text-xs tracking-widest uppercase">Nom *</Label>
              <Input value={form.last_name} onChange={on("last_name")} data-testid="checkout-last-name"
                className="bg-transparent border-ink/20 rounded-none focus-visible:ring-brand mt-1.5" />
            </div>
            <div>
              <Label className="text-xs tracking-widest uppercase">Téléphone *</Label>
              <Input value={form.phone} onChange={on("phone")} data-testid="checkout-phone"
                className="bg-transparent border-ink/20 rounded-none focus-visible:ring-brand mt-1.5" />
            </div>
            <div>
              <Label className="text-xs tracking-widest uppercase">Email *</Label>
              <Input type="email" value={form.email} onChange={on("email")} data-testid="checkout-email"
                className="bg-transparent border-ink/20 rounded-none focus-visible:ring-brand mt-1.5" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs tracking-widest uppercase">Code promo (optionnel)</Label>
              <Input value={form.promo_code} onChange={on("promo_code")} data-testid="checkout-promo"
                placeholder="Ex : ETE25"
                className="bg-transparent border-ink/20 rounded-none focus-visible:ring-brand mt-1.5" />
            </div>
          </div>

          <label className="flex items-start gap-3 mt-5 cursor-pointer">
            <Checkbox checked={form.marketing_opt_in} onCheckedChange={(v) => setForm((f) => ({ ...f, marketing_opt_in: !!v }))} data-testid="marketing-opt-in" />
            <span className="text-sm text-muted2">Je souhaite recevoir les offres exclusives d&apos;Angelucci&apos;s par email.</span>
          </label>
        </div>

        {/* Payment info */}
        <div className="bg-amber-50 border border-amber-500/40 p-4 flex gap-3 mb-6">
          <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium mb-0.5">Paiement sur place uniquement</p>
            <p className="text-muted2">Twint, cash ou carte à la remise.</p>
          </div>
        </div>

        {error && (
          <div className="border border-destructive bg-destructive/10 text-destructive p-3 text-sm mb-4" data-testid="checkout-error">
            {error}
          </div>
        )}

        <Button disabled={loading || items.length === 0} onClick={submit} data-testid="submit-order-btn"
          className="w-full bg-ink hover:bg-brand text-cream rounded-none tracking-widest uppercase h-14 text-sm md:text-base">
          {loading ? "Envoi…" : (
            <>
              <CheckCircle2 size={18} strokeWidth={1.5} className="mr-2" />
              Confirmer la commande · {CHF(subtotal)}
            </>
          )}
        </Button>
      </section>

      {/* Time picker modal */}
      <OrderModePicker
        open={showTimePicker}
        onOpenChange={setShowTimePicker}
        menuType={menuType}
        schedule={schedule}
        onConfirm={(m) => {
          setMode({ ...m, menu_type: menuType });
          setShowTimePicker(false);
        }}
      />
    </PageTransition>
  );
}
