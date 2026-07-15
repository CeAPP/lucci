import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { CHF } from "@/lib/api";
import PageTransition from "@/components/PageTransition";
import { CheckCircle2, Clock, Phone, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

const STATUS_MAP = {
  new: { label: "En attente de confirmation", step: 1 },
  preparing: { label: "En préparation", step: 2 },
  ready: { label: "Prêt", step: 3 },
  done: { label: "Terminé", step: 4 },
};

export default function OrderTracking() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [settings, setSettings] = useState({});
  useEffect(() => {
    const load = () => api.get(`/orders/${id}`).then((r) => setOrder(r.data)).catch(() => {});
    load();
    api.get("/settings").then((r) => setSettings(r.data));
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [id]);

  if (!order) return (
    <PageTransition>
      <div className="pt-40 pb-24 max-w-3xl mx-auto px-6 md:px-10">
        <p>Chargement…</p>
      </div>
    </PageTransition>
  );

  const st = STATUS_MAP[order.status] || STATUS_MAP.new;

  return (
    <PageTransition>
      <section className="pt-32 pb-24 max-w-3xl mx-auto px-6 md:px-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted2 hover:text-brand mb-8" data-testid="back-home">
          <ArrowLeft size={16} strokeWidth={1.5} /> Retour à l'accueil
        </Link>
        <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 100 }}
          className="w-16 h-16 rounded-full bg-brand text-cream flex items-center justify-center mb-6">
          <CheckCircle2 size={30} strokeWidth={1.5} />
        </motion.div>
        <p className="text-xs tracking-[.4em] uppercase text-brand mb-3">Merci pour votre commande</p>
        <h1 className="font-display text-4xl md:text-5xl mb-2">Commande #{order.order_number}</h1>
        <p className="text-muted2 mb-10">Un email de confirmation vous a été envoyé.</p>

        {/* Progress */}
        <div className="bg-cream-surface p-6 mb-8">
          <div className="flex items-center justify-between mb-6 text-xs tracking-widest uppercase text-muted2">
            {["En attente", "Préparation", "Prêt", "Terminé"].map((s, i) => (
              <span key={s} className={i < st.step ? "text-brand" : ""}>{s}</span>
            ))}
          </div>
          <div className="relative h-1 bg-ink/10">
            <motion.div className="absolute inset-y-0 left-0 bg-brand" initial={{ width: 0 }} animate={{ width: `${(st.step/4)*100}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
          </div>
          <p className="mt-4 font-display text-2xl">{st.label}</p>
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm mb-8">
          <p className="flex justify-between border-b border-ink/5 py-2"><span className="text-muted2">Mode</span><span>À emporter</span></p>
          <p className="flex justify-between border-b border-ink/5 py-2"><span className="text-muted2">Créneau</span><span className="text-brand font-medium">{order.pickup_time_label}</span></p>
          <p className="flex justify-between border-b border-ink/5 py-2"><span className="text-muted2">Menu</span><span>{order.menu_type === "epicerie" ? "Épicerie" : "Restaurant"}</span></p>
          <p className="flex justify-between border-b border-ink/5 py-2"><span className="text-muted2">Total</span><span className="text-brand font-medium">{CHF(order.total)}</span></p>
        </div>

        <div className="border border-brand bg-brand/5 p-5 flex items-start gap-3">
          <Clock size={20} strokeWidth={1.5} className="text-brand shrink-0 mt-1" />
          <div className="text-sm">
            <p className="mb-1"><strong>Confirmation sous 2 min.</strong> Si vous n'avez pas de nouvelles, appelez-nous&nbsp;:</p>
            <a href={`tel:${(settings.phone || "").replace(/\s/g,"")}`} className="inline-flex items-center gap-2 mt-2 text-brand font-medium link-underline">
              <Phone size={14} /> {settings.phone}
            </a>
          </div>
        </div>
      </section>
    </PageTransition>
  );
}
