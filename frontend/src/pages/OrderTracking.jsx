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
  rejected: { label: "Refusée", step: 0 },
};

export default function OrderTracking() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [settings, setSettings] = useState({});
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const load = () => api.get(`/orders/${id}`).then((r) => setOrder(r.data)).catch(() => {});
    load();
    api.get("/settings").then((r) => setSettings(r.data));
    const t = setInterval(load, 8000);
    const clock = setInterval(() => setNow(Date.now()), 15000);
    return () => { clearInterval(t); clearInterval(clock); };
  }, [id]);

  if (!order) return (
    <PageTransition>
      <div className="pt-40 pb-24 max-w-3xl mx-auto px-6 md:px-10">
        <p>Chargement…</p>
      </div>
    </PageTransition>
  );

  const st = STATUS_MAP[order.status] || STATUS_MAP.new;
  const createdAt = order.created_at ? new Date(order.created_at).getTime() : now;
  const elapsedMs = now - createdAt;
  const isRejected = order.status === "rejected";
  const isDone = order.status === "done";
  const showUrgentCallout = order.status === "new" && elapsedMs > 2 * 60 * 1000;
  const phoneClean = (settings.phone || "").replace(/\s/g, "");

  return (
    <PageTransition>
      <section className="pt-32 pb-24 max-w-3xl mx-auto px-6 md:px-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted2 hover:text-brand mb-8" data-testid="back-home">
          <ArrowLeft size={16} strokeWidth={1.5} /> Retour à l&apos;accueil
        </Link>
        <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 100 }}
          className={`w-16 h-16 rounded-full text-cream flex items-center justify-center mb-6 ${isRejected ? "bg-destructive" : "bg-brand"}`}>
          <CheckCircle2 size={30} strokeWidth={1.5} />
        </motion.div>
        <p className="text-xs tracking-[.4em] uppercase text-brand mb-3">
          {isRejected ? "Commande refusée" : isDone ? "Commande terminée" : "Merci pour votre commande"}
        </p>
        <h1 className="font-display text-4xl md:text-5xl mb-2">Commande #{order.order_number}</h1>
        <p className="text-muted2 mb-8">
          {isRejected
            ? "Nous n'avons pas pu accepter cette commande. Pour en savoir plus, appelez-nous."
            : "Cette page se met à jour automatiquement — pas besoin de la rafraîchir."}
        </p>

        {/* Contact & 2-min notice (top) */}
        <div className="border border-ink/10 bg-cream p-4 mb-8 flex flex-col sm:flex-row sm:items-center gap-3" data-testid="contact-banner">
          <div className="flex-1 text-sm">
            <p className="mb-1"><strong>Une question ?</strong> Appelez-nous, on répond volontiers.</p>
            <p className="text-muted2 text-xs">Si votre commande n&apos;est pas confirmée sous 2 minutes, un rappel apparaîtra ici.</p>
          </div>
          <a href={`tel:${phoneClean}`} data-testid="contact-phone"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-brand text-cream text-sm tracking-widest uppercase link-underline">
            <Phone size={16} /> {settings.phone}
          </a>
        </div>

        {/* Progress */}
        {!isRejected && (
          <div className="bg-cream-surface p-6 mb-8" data-testid="status-progress">
            <div className="flex items-center justify-between mb-6 text-xs tracking-widest uppercase text-muted2">
              {["En attente", "Préparation", "Prêt", "Terminé"].map((s, i) => (
                <span key={s} className={i < st.step ? "text-brand" : ""}>{s}</span>
              ))}
            </div>
            <div className="relative h-1 bg-ink/10">
              <motion.div className="absolute inset-y-0 left-0 bg-brand" initial={{ width: 0 }} animate={{ width: `${(st.step/4)*100}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
            </div>
            <p className="mt-4 font-display text-2xl" data-testid="status-label">{st.label}</p>
          </div>
        )}
        {isRejected && (
          <div className="bg-destructive/10 border border-destructive p-6 mb-8">
            <p className="font-display text-2xl text-destructive" data-testid="status-label">Commande refusée</p>
          </div>
        )}

        {/* Details */}
        <div className="space-y-2 text-sm mb-8">
          <p className="flex justify-between border-b border-ink/5 py-2"><span className="text-muted2">Mode</span><span>À emporter</span></p>
          <p className="flex justify-between border-b border-ink/5 py-2"><span className="text-muted2">Créneau</span><span className="text-brand font-medium">{order.pickup_time_label}</span></p>
          <p className="flex justify-between border-b border-ink/5 py-2"><span className="text-muted2">Menu</span><span>{order.menu_type === "epicerie" ? "Épicerie" : "Restaurant"}</span></p>
          <p className="flex justify-between border-b border-ink/5 py-2"><span className="text-muted2">Total</span><span className="text-brand font-medium">{CHF(order.total)}</span></p>
        </div>

        {/* 2-min urgent callout */}
        {showUrgentCallout && (
          <div className="border-2 border-destructive bg-destructive/5 p-5 flex items-start gap-3 animate-pulse" data-testid="urgent-callout">
            <Clock size={20} strokeWidth={1.5} className="text-destructive shrink-0 mt-1" />
            <div className="text-sm">
              <p className="mb-1"><strong className="text-destructive">Toujours pas confirmée après 2 min ?</strong> Appelez-nous directement, on va tout arranger.</p>
              <a href={`tel:${phoneClean}`} className="inline-flex items-center gap-2 mt-2 text-destructive font-medium link-underline">
                <Phone size={14} /> {settings.phone}
              </a>
            </div>
          </div>
        )}
      </section>
    </PageTransition>
  );
}
