import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import api, { CHF } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { AlertCircle } from "lucide-react";

export default function CheckoutModal({ open, onOpenChange, menuType, onSuccess }) {
  const { cart, mode, totalFor } = useCart();
  const items = cart[menuType] || [];
  const subtotal = totalFor(menuType);
  const vatRate = 0.026;

  const [form, setForm] = useState({
    first_name: "", last_name: "", phone: "", email: "",
    marketing_opt_in: false, promo_code: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const on = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target ? e.target.value : e }));

  const submit = async () => {
    setError("");
    if (!form.first_name || !form.last_name || !form.phone || !form.email) {
      setError("Merci de remplir tous les champs requis.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        menu_type: menuType,
        fulfillment_type: "takeaway",
        pickup_time: mode?.pickup_time || "ASAP",
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
      toast.success(`Commande #${data.order_number} confirmée`);
      onSuccess(data.id);
    } catch (e) {
      setError(e.response?.data?.detail || "Erreur lors de la commande");
    } finally {
      setLoading(false);
    }
  };

  const vatAmount = (subtotal * vatRate) / (1 + vatRate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-cream border-ink/10 rounded-none p-0 max-h-[92vh] overflow-y-auto" data-testid="checkout-modal">
        <DialogTitle className="sr-only">Finaliser la commande</DialogTitle>
        <div className="p-8">
          <p className="text-xs tracking-[.4em] uppercase text-brand mb-3">Finaliser</p>
          <h2 className="font-display text-4xl mb-8">Votre commande</h2>

          {/* Items recap */}
          <div className="bg-cream-surface p-4 mb-6 text-sm space-y-2">
            {items.map((it) => (
              <div key={it._uid} className="flex justify-between gap-3">
                <span className="flex-1">{it.quantity}× {it.name}{it.selected_addons.length > 0 && <span className="text-muted2"> · {it.selected_addons.map(a=>a.name).join(", ")}</span>}</span>
                <span>{CHF(it.line_total)}</span>
              </div>
            ))}
            <div className="border-t border-ink/10 pt-2 flex justify-between">
              <span>Sous-total</span><span>{CHF(subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted2">
              <span>dont TVA ({(vatRate * 100).toFixed(1)}%) — <strong>incluse dans le prix</strong></span>
              <span>{CHF(vatAmount)}</span>
            </div>
            <div className="flex justify-between font-display text-xl pt-2 border-t border-ink/10">
              <span>Total <span className="text-[10px] tracking-widest uppercase text-muted2 ml-1">TVA comprise</span></span>
              <span className="text-brand">{CHF(subtotal)}</span>
            </div>
          </div>

          {/* Form */}
          <div className="grid grid-cols-2 gap-4">
            <div><Label className="text-xs tracking-widest uppercase">Prénom *</Label>
              <Input value={form.first_name} onChange={on("first_name")} data-testid="checkout-first-name"
                className="bg-transparent border-ink/20 rounded-none focus-visible:ring-brand mt-1.5" /></div>
            <div><Label className="text-xs tracking-widest uppercase">Nom *</Label>
              <Input value={form.last_name} onChange={on("last_name")} data-testid="checkout-last-name"
                className="bg-transparent border-ink/20 rounded-none focus-visible:ring-brand mt-1.5" /></div>
            <div><Label className="text-xs tracking-widest uppercase">Téléphone *</Label>
              <Input value={form.phone} onChange={on("phone")} data-testid="checkout-phone"
                className="bg-transparent border-ink/20 rounded-none focus-visible:ring-brand mt-1.5" /></div>
            <div><Label className="text-xs tracking-widest uppercase">Email *</Label>
              <Input type="email" value={form.email} onChange={on("email")} data-testid="checkout-email"
                className="bg-transparent border-ink/20 rounded-none focus-visible:ring-brand mt-1.5" /></div>
            <div className="col-span-2"><Label className="text-xs tracking-widest uppercase">Code promo (optionnel)</Label>
              <Input value={form.promo_code} onChange={on("promo_code")} data-testid="checkout-promo"
                className="bg-transparent border-ink/20 rounded-none focus-visible:ring-brand mt-1.5" /></div>
          </div>

          <label className="flex items-start gap-3 mt-6 cursor-pointer">
            <Checkbox checked={form.marketing_opt_in} onCheckedChange={(v) => setForm((f) => ({ ...f, marketing_opt_in: !!v }))} data-testid="marketing-opt-in" />
            <span className="text-sm text-muted2">Je souhaite recevoir les offres exclusives d'Angelucci's par email.</span>
          </label>

          <div className="mt-6 bg-brand/10 border border-brand p-4 flex gap-3">
            <AlertCircle size={20} strokeWidth={1.5} className="text-brand shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1">Paiement sur place uniquement</p>
              <p className="text-muted2">Twint, cash ou carte à la remise. Si votre commande n'est pas confirmée sous 2 min, appelez-nous.</p>
            </div>
          </div>

          {error && <p className="text-destructive text-sm mt-4">{error}</p>}

          <Button disabled={loading || items.length === 0} onClick={submit} data-testid="submit-order-btn"
            className="w-full mt-6 bg-ink hover:bg-brand text-cream rounded-none tracking-widest uppercase h-12">
            {loading ? "Envoi…" : `Confirmer · ${CHF(subtotal)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
