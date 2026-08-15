import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api, { CHF, mediaUrl } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { LogOut, Bell, BellOff, Phone, Trash2, ChevronUp, ChevronDown, Plus, Pencil, Volume2, Copy, Download, Upload, X, CheckCircle2 } from "lucide-react";

const LOGO = "https://customer-assets.emergentagent.com/job_pizzeria-app-26/artifacts/jwci5np5_LOgo%20angelucci.png";
const DAY_LABELS = { mon: "Lundi", tue: "Mardi", wed: "Mercredi", thu: "Jeudi", fri: "Vendredi", sat: "Samedi", sun: "Dimanche" };

// =========== LOGIN ===========
export function AdminLogin() {
  const nav = useNavigate();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("expired=1")) {
      setExpired(true);
    }
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { username: u, password: p });
      localStorage.setItem("angel_token", data.token);
      localStorage.setItem("angel_role", data.role);
      localStorage.setItem("angel_user", data.username);
      nav("/Angel/dashboard");
    } catch (e) {
      setErr(e.response?.data?.detail || "Erreur");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink text-cream p-6">
      <form onSubmit={submit} data-testid="admin-login-form" className="w-full max-w-sm">
        <img src={LOGO} alt="Angelucci's" className="w-24 h-24 mx-auto mb-6 opacity-90" />
        <h1 className="font-display text-3xl text-center mb-2">Espace Admin</h1>
        <p className="text-center text-cream/50 text-xs tracking-widest uppercase mb-10">Angelucci's</p>
        <div className="space-y-4">
          {expired && (
            <div className="border border-amber-500/50 bg-amber-500/10 text-amber-200 text-sm p-3" data-testid="expired-notice">
              Votre session a expiré. Reconnectez-vous pour continuer.
            </div>
          )}
          <div>
            <Label className="text-xs tracking-widest uppercase text-cream/70">Nom d'utilisateur</Label>
            <Input value={u} onChange={(e) => setU(e.target.value)} data-testid="admin-username"
              className="bg-transparent border-cream/20 rounded-none focus-visible:ring-brand text-cream mt-1.5" />
          </div>
          <div>
            <Label className="text-xs tracking-widest uppercase text-cream/70">Mot de passe</Label>
            <Input type="password" value={p} onChange={(e) => setP(e.target.value)} data-testid="admin-password"
              className="bg-transparent border-cream/20 rounded-none focus-visible:ring-brand text-cream mt-1.5" />
          </div>
          {err && <p className="text-red-400 text-sm">{err}</p>}
          <Button type="submit" disabled={loading} data-testid="admin-login-btn"
            className="w-full bg-brand hover:bg-brand-hover text-cream rounded-none tracking-widest uppercase h-12">
            {loading ? "…" : "Connexion"}
          </Button>
        </div>
      </form>
    </div>
  );
}

// =========== SOUND PING ===========
function usePing() {
  const ctxRef = useRef(null);
  const enable = () => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctxRef.current = new AC();
      // resume + a silent tap
      const o = ctxRef.current.createOscillator();
      const g = ctxRef.current.createGain();
      g.gain.value = 0;
      o.connect(g); g.connect(ctxRef.current.destination);
      o.start(); o.stop(ctxRef.current.currentTime + 0.05);
      return true;
    } catch { return false; }
  };
  const play = () => {
    if (!ctxRef.current) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    [0, 0.15, 0.3].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880 + i * 220;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(0.25, now + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.12);
      o.start(now + t); o.stop(now + t + 0.14);
    });
  };
  return { enable, play, enabled: () => !!ctxRef.current };
}

// =========== ORDERS TAB ===========
function OrdersTab({ ping }) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("all");
  const [rescheduling, setRescheduling] = useState(null);
  const [alarmActive, setAlarmActive] = useState(false);
  const lastIdsRef = useRef(new Set());
  const alarmTimerRef = useRef(null);
  const alarmDeadlineRef = useRef(0);

  const stopAlarm = () => {
    if (alarmTimerRef.current) { clearInterval(alarmTimerRef.current); alarmTimerRef.current = null; }
    alarmDeadlineRef.current = 0;
    setAlarmActive(false);
  };

  // Ring every 30s during 6 minutes. Auto-stops when no more "new" orders or on timeout.
  const startAlarm = () => {
    if (alarmTimerRef.current) return; // already ringing
    alarmDeadlineRef.current = Date.now() + 6 * 60 * 1000; // 6 min
    setAlarmActive(true);
    ping.play();
    alarmTimerRef.current = setInterval(() => {
      if (Date.now() > alarmDeadlineRef.current) { stopAlarm(); return; }
      // Only ring if there's still at least one "new" order
      if (lastIdsRef.current.size === 0) { stopAlarm(); return; }
      ping.play();
    }, 30000);
  };

  const load = async () => {
    const { data } = await api.get("/admin/orders");
    setOrders(data);
    // detect new
    const cur = new Set(data.filter((o) => o.status === "new").map((o) => o.id));
    if (lastIdsRef.current.size > 0) {
      let added = 0;
      cur.forEach((id) => { if (!lastIdsRef.current.has(id)) added++; });
      if (added > 0) {
        toast.success(`${added} nouvelle${added>1?"s":""} commande${added>1?"s":""}`);
        startAlarm();
      }
    }
    // If admin acknowledged all new orders, stop alarm
    if (cur.size === 0 && alarmTimerRef.current) stopAlarm();
    lastIdsRef.current = cur;
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => { clearInterval(t); stopAlarm(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = orders.filter((o) => filter === "all" || o.status === filter);

  const setStatus = async (o, status) => {
    await api.patch(`/admin/orders/${o.id}/status`, null, { params: { status } });
    load();
  };
  const advance = (o) => {
    const flow = ["new", "preparing", "ready", "done"];
    const next = flow[Math.min(flow.length - 1, flow.indexOf(o.status) + 1)];
    setStatus(o, next);
  };
  const reject = async (o) => {
    if (!confirm(`Refuser cette commande #${o.order_number} ? Le client sera notifié.`)) return;
    setStatus(o, "rejected");
    toast.error("Commande refusée");
  };
  const del = async (o) => { if (!confirm("Supprimer définitivement ?")) return; await api.delete(`/admin/orders/${o.id}`); load(); };

  const STATUS_CFG = {
    new: { label: "En attente de confirmation", color: "bg-brand text-cream" },
    preparing: { label: "En préparation", color: "bg-amber-600 text-cream" },
    ready: { label: "Prêt", color: "bg-emerald-700 text-cream" },
    done: { label: "Terminé", color: "bg-ink/40 text-cream" },
    rejected: { label: "Refusée", color: "bg-destructive text-cream" },
  };

  const advanceLabel = (status) => {
    if (status === "new") return "Confirmer la commande";
    if (status === "preparing") return "Marquer prêt";
    if (status === "ready") return "Terminer";
    return "";
  };

  const fmtDT = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString("fr-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch { return iso || ""; }
  };

  return (
    <div>
      {alarmActive && (
        <div className="mb-4 p-4 bg-destructive/10 border-2 border-destructive flex items-center justify-between animate-pulse" data-testid="alarm-banner">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔔</span>
            <div>
              <p className="font-display text-lg text-destructive">Nouvelle commande — Alarme active</p>
              <p className="text-xs text-muted2">L'alarme sonne toutes les 30 s pendant 6 min. Confirmez ou refusez pour l'arrêter.</p>
            </div>
          </div>
          <Button onClick={stopAlarm} data-testid="stop-alarm"
            className="rounded-none bg-destructive text-cream uppercase text-xs tracking-widest h-10 hover:bg-destructive/90">
            🔕 Arrêter l'alarme
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {["all", "new", "preparing", "ready", "done", "rejected"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} data-testid={`filter-${s}`}
            className={`px-4 py-2 text-xs tracking-widest uppercase border transition-colors ${filter===s ? "bg-ink text-cream border-ink" : "border-ink/20 hover:border-brand"}`}>
            {s === "all" ? "Toutes" : STATUS_CFG[s].label} ({s === "all" ? orders.length : orders.filter((o) => o.status === s).length})
          </button>
        ))}
      </div>
      {filtered.length === 0 && <p className="text-muted2">Aucune commande.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((o) => {
          const isEpicerie = o.menu_type === "epicerie";
          const cfg = STATUS_CFG[o.status] || STATUS_CFG.new;
          return (
          <div key={o.id} className="border border-ink/10 bg-cream p-5" data-testid={`order-card-${o.id}`}>
            {/* Big menu type banner */}
            <div className={`-mx-5 -mt-5 mb-4 px-5 py-3 flex items-center justify-between ${isEpicerie ? "bg-brand text-cream" : "bg-terracotta text-cream"}`}>
              <span className="font-display text-2xl tracking-[.15em] uppercase" data-testid={`order-menutype-${o.id}`}>
                {isEpicerie ? "ÉPICERIE" : "RESTAURANT"}
              </span>
              <span className="text-xs opacity-80">#{o.order_number}</span>
            </div>

            <span className={`inline-block text-[10px] tracking-widest uppercase px-2 py-1 mb-3 ${cfg.color}`}>{cfg.label}</span>
            <p className="font-display text-xl">{o.customer.first_name} {o.customer.last_name}</p>
            <a href={`tel:${o.customer.phone.replace(/\s/g,"")}`} className="text-brand text-lg link-underline flex items-center gap-1">
              <Phone size={14} /> {o.customer.phone}
            </a>

            <div className="my-3 p-2.5 bg-brand/10 border border-brand text-center">
              <p className="text-[10px] tracking-widest uppercase text-brand">Créneau de retrait</p>
              <p className="font-display text-lg" data-testid={`order-pickup-${o.id}`}>{o.pickup_time_label}</p>
              {o.status !== "done" && o.status !== "rejected" && (
                <button onClick={() => setRescheduling(o)} data-testid={`reschedule-${o.id}`}
                  className="text-[10px] tracking-widest uppercase text-brand link-underline mt-1">
                  Repousser →
                </button>
              )}
            </div>

            <p className="text-xs text-muted2 mb-3" data-testid={`order-created-${o.id}`}>
              Commande passée le <strong className="text-ink">{fmtDT(o.created_at)}</strong>
            </p>

            <div className="text-xs bg-amber-100 text-amber-900 px-2 py-1 mb-3 inline-block">💵 À payer sur place</div>

            <div className="text-sm space-y-1 mb-3">
              {o.items.map((it, i) => (
                <div key={i}>
                  <div className="flex justify-between">
                    <span>{it.quantity}× {it.name}</span>
                    <span>{CHF(it.line_total)}</span>
                  </div>
                  {it.selected_addons.length > 0 && (
                    <p className="text-xs text-muted2 pl-3">+ {it.selected_addons.map(a=>a.name).join(", ")}</p>
                  )}
                  {it.note && <p className="text-xs italic text-muted2 pl-3">✎ {it.note}</p>}
                </div>
              ))}
            </div>

            <div className="border-t border-ink/10 pt-2 flex justify-between text-sm">
              <span className="text-muted2">Total</span>
              <span className="text-brand font-medium">{CHF(o.total)}</span>
            </div>

            <div className="flex flex-col gap-2 mt-4">
              {advanceLabel(o.status) && (
                <Button onClick={() => advance(o)} data-testid={`advance-${o.id}`}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-cream rounded-none uppercase text-xs tracking-widest h-10">
                  ✓ {advanceLabel(o.status)}
                </Button>
              )}
              <div className="flex gap-2">
                {o.status === "new" && (
                  <Button onClick={() => reject(o)} data-testid={`reject-${o.id}`}
                    variant="outline" className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-cream rounded-none uppercase text-xs tracking-widest h-9">
                    Refuser
                  </Button>
                )}
                <Button onClick={() => del(o)} variant="outline" data-testid={`delete-${o.id}`}
                  className="rounded-none border-ink/20 h-9 px-3"><Trash2 size={14} /></Button>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {rescheduling && (
        <RescheduleDialog order={rescheduling} onClose={() => setRescheduling(null)} onSaved={() => { setRescheduling(null); load(); }} />
      )}
    </div>
  );
}

// =========== RESCHEDULE DIALOG ===========
function RescheduleDialog({ order, onClose, onSaved }) {
  const [schedule, setSchedule] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const kind = order.menu_type === "epicerie" ? "epicerie" : "restaurant";
    api.get(`/schedule/${kind}`).then((r) => setSchedule(r.data)).catch(() => {});
  }, [order.menu_type]);

  const DAY_KEYS = ["sun","mon","tue","wed","thu","fri","sat"];
  const slotsFor = (date) => {
    if (!schedule) return [];
    const d = schedule.days?.[DAY_KEYS[date.getDay()]];
    if (!d || d.closed) return [];
    const arr = [];
    const push = (s, e) => {
      if (!s || !e) return;
      const [sh, sm] = s.split(":").map(Number);
      const [eh, em] = e.split(":").map(Number);
      for (let t = sh*60+sm; t <= eh*60+em; t += 10) {
        arr.push(`${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`);
      }
    };
    push(d.lunch_start, d.lunch_end);
    push(d.dinner_start, d.dinner_end);
    return arr;
  };

  const days = Array.from({ length: 8 }, (_, i) => { const d = new Date(); d.setDate(d.getDate()+i); return d; });
  const todayStr = new Date().toISOString().split("T")[0];

  const save = async () => {
    if (!selectedTime) { toast.error("Choisissez un créneau"); return; }
    setSaving(true);
    try {
      const iso = selectedDate.toISOString().split("T")[0];
      const isToday = iso === todayStr;
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
      const isTomorrow = iso === tomorrow.toISOString().split("T")[0];
      const label = isToday
        ? `Aujourd'hui à ${selectedTime}`
        : isTomorrow
          ? `Demain à ${selectedTime}`
          : `${selectedDate.toLocaleDateString("fr-CH", { weekday:"short", day:"numeric", month:"short" })} à ${selectedTime}`;
      await api.patch(`/admin/orders/${order.id}/reschedule`, null, {
        params: { pickup_time: `${iso}T${selectedTime}`, pickup_time_label: label },
      });
      toast.success("Créneau modifié");
      onSaved();
    } catch (e) {
      toast.error("Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg !bg-cream border-ink/10 rounded-none p-0" data-testid="reschedule-dialog">
        <DialogTitle className="sr-only">Repousser la commande</DialogTitle>
        <div className="p-5">
          <p className="text-[10px] tracking-[.3em] uppercase text-brand mb-1">Repousser</p>
          <h3 className="font-display text-2xl mb-1">Nouveau créneau</h3>
          <p className="text-xs text-muted2 mb-4">Actuel : <strong>{order.pickup_time_label}</strong></p>

          <p className="text-[10px] tracking-widest uppercase text-muted2 mb-2">Jour</p>
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
            {days.map((d) => {
              const iso = d.toISOString().split("T")[0];
              const active = selectedDate.toISOString().split("T")[0] === iso;
              return (
                <button key={iso} onClick={() => { setSelectedDate(d); setSelectedTime(""); }} data-testid={`resched-day-${iso}`}
                  className={`shrink-0 border px-3 py-2 min-w-[74px] text-center transition-all ${active ? "bg-ink text-cream border-ink" : "border-ink/15 hover:border-brand bg-cream"}`}>
                  <p className="text-[10px] tracking-[.15em] uppercase">{iso === todayStr ? "Aujourd'hui" : d.toLocaleDateString("fr-CH", { weekday: "short" })}</p>
                  <p className={`text-[10px] mt-0.5 ${active ? "text-cream/70" : "text-muted2"}`}>{d.toLocaleDateString("fr-CH", { day: "numeric", month: "short" })}</p>
                </button>
              );
            })}
          </div>

          <p className="text-[10px] tracking-widest uppercase text-muted2 mb-2 mt-3">Heure — 10 min</p>
          {slotsFor(selectedDate).length === 0 ? (
            <p className="text-sm text-muted2 py-4">Fermé ce jour.</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-56 overflow-y-auto p-0.5">
              {slotsFor(selectedDate).map((t) => (
                <button key={t} onClick={() => setSelectedTime(t)} data-testid={`resched-time-${t}`}
                  className={`py-2 text-sm border transition-all ${selectedTime === t ? "bg-brand text-cream border-brand" : "border-ink/15 hover:border-brand bg-cream"}`}>
                  {t}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-5">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-none border-ink/20 uppercase text-xs tracking-widest">Annuler</Button>
            <Button disabled={saving || !selectedTime} onClick={save} data-testid="resched-save"
              className="flex-1 bg-brand hover:bg-brand-hover text-cream rounded-none uppercase text-xs tracking-widest">
              {saving ? "Envoi…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =========== RESERVATIONS TAB ===========
function ReservationsTab() {
  const [items, setItems] = useState([]);
  const load = async () => { const { data } = await api.get("/admin/reservations"); setItems(data); };
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);
  const setStatus = async (r, status) => { await api.patch(`/admin/reservations/${r.id}/status`, null, { params: { status } }); load(); };

  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-muted2">Aucune réservation.</p>}
      {items.map((r) => (
        <div key={r.id} className="border border-ink/10 bg-cream p-5 flex flex-wrap items-start gap-4 justify-between" data-testid={`res-${r.id}`}>
          <div className="flex-1 min-w-[240px]">
            <div className="flex gap-3 items-center mb-1">
              <span className={`text-[10px] tracking-widest uppercase px-2 py-1 ${r.status==="confirmed"?"bg-brand text-cream":r.status==="cancelled"?"bg-red-800 text-cream":"bg-ink/40 text-cream"}`}>{r.status}</span>
              <span className="font-display text-2xl">{r.date} · {r.time}</span>
            </div>
            <p className="text-lg">{r.first_name} · <a href={`tel:${r.phone}`} className="text-brand link-underline">{r.phone}</a> · <span className="text-muted2">{r.email}</span></p>
            <p className="text-sm text-muted2">Personnes : <strong>{r.people}</strong>{r.comment ? ` · Commentaire : ${r.comment}` : ""}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setStatus(r, "confirmed")} className="rounded-none bg-brand hover:bg-brand-hover text-cream uppercase text-xs">Confirmer</Button>
            <Button size="sm" onClick={() => setStatus(r, "done")} className="rounded-none bg-ink text-cream uppercase text-xs">Terminée</Button>
            <Button size="sm" variant="outline" onClick={() => setStatus(r, "cancelled")} className="rounded-none border-ink/20 uppercase text-xs">Annuler</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// =========== MENU TAB ===========
function MenuTab() {
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [groups, setGroups] = useState([]);
  const [filterMenu, setFilterMenu] = useState("restaurant");
  const [filterCat, setFilterCat] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [editingCat, setEditingCat] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [subtab, setSubtab] = useState("products");
  const [showUpload, setShowUpload] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkTag, setBulkTag] = useState("");

  const load = async () => {
    const [p, c, g] = await Promise.all([
      api.get("/products/all"), api.get("/categories"), api.get("/addon-groups"),
    ]);
    setProducts(p.data); setCats(c.data); setGroups(g.data);
    setRefreshKey((k) => k + 1);
  };
  useEffect(() => { load(); }, []);

  const filtered = products.filter((p) => p.menu_type === filterMenu && (!filterCat || p.category_id === filterCat) && (!search || p.name.toLowerCase().includes(search.toLowerCase())));
  const tagOptions = Array.from(new Set(products.flatMap((p) => p.tags || []))).sort();

  const del = async (p) => { if (!confirm("Supprimer ?")) return; await api.delete(`/products/${p.id}`); load(); };
  const setOOS = async (p, days) => {
    let until = "";
    if (days > 0) { const d = new Date(); d.setDate(d.getDate() + days); until = d.toISOString().split("T")[0]; }
    await api.post(`/products/${p.id}/oos`, null, { params: { until } });
    load();
  };
  const catsFor = (menuType) => cats.filter((c) => c.menu_type === menuType);

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {["products", "categories", "addons"].map((s) => (
          <button key={s} onClick={() => setSubtab(s)}
            className={`px-4 py-2 text-xs tracking-widest uppercase border transition-colors ${subtab===s ? "bg-ink text-cream border-ink" : "border-ink/20 hover:border-brand"}`}>
            {s === "products" ? "Produits" : s === "categories" ? "Catégories" : "Suppléments"}
          </button>
        ))}
      </div>

      {subtab === "products" && (
        <>
          <div className="flex flex-wrap gap-3 mb-4 items-center">
            {["restaurant", "epicerie"].map((mt) => (
              <button key={mt} onClick={() => { setFilterMenu(mt); setFilterCat(""); }} data-testid={`filter-menu-${mt}`}
                className={`px-4 py-2 text-xs tracking-widest uppercase border ${filterMenu===mt ? "bg-brand text-cream border-brand" : "border-ink/20"}`}>{mt}</button>
            ))}
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="border border-ink/20 px-3 py-2 bg-transparent text-sm">
              <option value="">Toutes catégories</option>
              {catsFor(filterMenu).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Input placeholder="Rechercher" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs bg-transparent border-ink/20 rounded-none focus-visible:ring-brand" />
            <Button onClick={() => setShowUpload(true)} data-testid="bulk-upload-btn"
              variant="outline" className="ml-auto rounded-none border-brand text-brand hover:bg-brand hover:text-cream uppercase text-xs tracking-widest">
              <Upload size={14} className="mr-1"/> Uploader images
            </Button>
            <Button onClick={() => setShowCsv(true)} data-testid="csv-import-btn"
              variant="outline" className="rounded-none border-ink/40 hover:bg-ink hover:text-cream uppercase text-xs tracking-widest">
              <Download size={14} className="mr-1"/> Importer CSV
            </Button>
            <Button onClick={() => setEditing({ menu_type: filterMenu, category_id: catsFor(filterMenu)[0]?.id, price: 0, addon_group_ids: [], is_active: true })}
              data-testid="new-product-btn"
              className="bg-brand hover:bg-brand-hover text-cream rounded-none uppercase text-xs tracking-widest"><Plus size={14} className="mr-1"/> Nouveau produit</Button>
          </div>

          <TagOOSPanel onChange={load} refreshKey={refreshKey} />

          {/* MULTI-SELECT BULK ACTIONS BAR — shows when at least 1 product selected */}
          {selectedIds.size > 0 && (
            <div className="sticky top-20 z-20 border-2 border-brand bg-brand/10 p-3 mb-4 flex flex-wrap items-center gap-2" data-testid="bulk-actions-bar">
              <span className="text-sm font-medium">{selectedIds.size} sélectionné(s)</span>
              <div className="flex-1" />
              <select value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} data-testid="bulk-tag-select"
                className="border border-ink/20 bg-cream px-2 py-1.5 text-sm">
                <option value="">Ajouter étiquette…</option>
                {tagOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <Button size="sm" disabled={!bulkTag} onClick={async () => {
                try {
                  await Promise.all([...selectedIds].map((id) => {
                    const p = products.find((x) => x.id === id);
                    if (!p) return null;
                    const newTags = Array.from(new Set([...(p.tags || []), bulkTag]));
                    return api.put(`/products/${id}`, { ...p, tags: newTags });
                  }));
                  toast.success(`Étiquette « ${bulkTag} » ajoutée à ${selectedIds.size} produit(s)`);
                  setBulkTag(""); setSelectedIds(new Set()); load();
                } catch (e) { toast.error("Erreur"); }
              }} data-testid="bulk-tag-apply" className="rounded-none bg-ink text-cream uppercase text-xs tracking-widest h-9">
                Appliquer
              </Button>
              <Button size="sm" onClick={async () => {
                if (!confirm(`Supprimer ${selectedIds.size} produit(s) ?`)) return;
                try {
                  await Promise.all([...selectedIds].map((id) => api.delete(`/products/${id}`)));
                  toast.success(`${selectedIds.size} produit(s) supprimé(s)`);
                  setSelectedIds(new Set()); load();
                } catch (e) { toast.error("Erreur"); }
              }} data-testid="bulk-delete-selected" className="rounded-none bg-destructive text-cream uppercase text-xs tracking-widest h-9">
                <Trash2 size={12} className="mr-1"/> Supprimer
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())} data-testid="bulk-clear"
                className="rounded-none border-ink/20 uppercase text-xs tracking-widest h-9">Annuler</Button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => {
              const isSel = selectedIds.has(p.id);
              return (
              <div key={p.id} className={`border bg-cream p-4 flex gap-3 ${isSel ? "border-brand ring-2 ring-brand/40" : "border-ink/10"}`} data-testid={`product-card-${p.id}`}>
                <input type="checkbox" checked={isSel}
                  onChange={(e) => {
                    setSelectedIds((prev) => {
                      const n = new Set(prev);
                      if (e.target.checked) n.add(p.id); else n.delete(p.id);
                      return n;
                    });
                  }}
                  data-testid={`product-select-${p.id}`}
                  className="mt-1 h-4 w-4 accent-brand cursor-pointer" />
                {p.image_url && <img src={mediaUrl(p.image_url)} alt="" className="w-24 h-24 object-cover" />}
                <div className="flex-1">
                  <p className="font-display text-lg">{p.name}</p>
                  <p className="text-sm text-brand mb-1">{CHF(p.price)}</p>
                  {p.tags && p.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {p.tags.map((t) => <span key={t} className="text-[10px] bg-brand/15 text-brand px-1.5 py-0.5">{t}</span>)}
                    </div>
                  )}
                  {p.out_of_stock_until && <p className="text-xs text-red-700">Rupture jusqu&apos;au {p.out_of_stock_until}</p>}
                  <div className="flex gap-1 mt-2 flex-wrap">
                    <Button size="sm" onClick={() => setEditing(p)} className="rounded-none h-7 px-2 text-xs bg-ink text-cream"><Pencil size={12}/></Button>
                    <Button size="sm" variant="outline" onClick={() => del(p)} className="rounded-none h-7 px-2 border-ink/20"><Trash2 size={12}/></Button>
                    {[1,2,3,7].map((d) => (
                      <Button key={d} size="sm" variant="outline" onClick={() => setOOS(p, d)} className="rounded-none h-7 px-2 text-xs border-ink/20">OOS {d}j</Button>
                    ))}
                    {p.out_of_stock_until && <Button size="sm" onClick={() => setOOS(p, 0)} className="rounded-none h-7 px-2 text-xs bg-emerald-700 text-cream">Réactiver</Button>}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
          {editing && <ProductEditor product={editing} cats={cats} groups={groups} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
          {showUpload && <BulkUploadDialog defaultMenu={filterMenu} cats={cats} onClose={() => setShowUpload(false)} onDone={() => { setShowUpload(false); load(); }} />}
          {showCsv && <CsvImportDialog defaultMenu={filterMenu} cats={cats} onClose={() => setShowCsv(false)} onDone={() => { setShowCsv(false); load(); }} />}
        </>
      )}

      {subtab === "categories" && (
        <CategoriesEditor cats={cats} onChange={load} onEdit={setEditingCat} editing={editingCat} setEditing={setEditingCat} />
      )}
      {subtab === "addons" && (
        <AddonGroupsEditor groups={groups} onChange={load} editing={editingGroup} setEditing={setEditingGroup} />
      )}
    </div>
  );
}

// =========== TAG-BASED OUT-OF-STOCK PANEL ===========
function TagOOSPanel({ onChange, refreshKey }) {
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState("");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/admin/tags");
      setTags(data);
    } catch (e) { /* ignore */ }
  };
  useEffect(() => { load(); }, [refreshKey]);

  const apply = async () => {
    if (!selectedTag) { toast.error("Choisissez une étiquette"); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/tags/oos?tag=${encodeURIComponent(selectedTag)}&until=${encodeURIComponent(until)}`);
      toast.success(until
        ? `${data.affected} produit(s) « ${selectedTag} » en rupture jusqu'au ${until}`
        : `Rupture retirée pour ${data.affected} produit(s) « ${selectedTag} »`);
      setSelectedTag(""); setUntil("");
      load(); onChange && onChange();
    } catch (e) {
      toast.error(`Erreur : ${e?.response?.data?.detail || e.message}`);
    } finally { setBusy(false); }
  };

  const clearTag = async (tag) => {
    if (!confirm(`Retirer la rupture pour tous les produits « ${tag} » ?`)) return;
    try {
      const { data } = await api.post(`/admin/tags/oos?tag=${encodeURIComponent(tag)}&until=`);
      toast.success(`Rupture retirée pour ${data.affected} produit(s)`);
      load(); onChange && onChange();
    } catch (e) {
      toast.error(`Erreur : ${e?.response?.data?.detail || e.message}`);
    }
  };

  return (
    <div className="border border-ink/10 bg-cream-surface/60 p-4 mb-5" data-testid="tag-oos-panel">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <p className="text-[10px] tracking-[.3em] uppercase text-brand">Rupture par étiquette</p>
          <p className="text-xs text-muted2">Signalez la rupture de stock pour tous les produits portant une étiquette (ex : salami)</p>
        </div>
      </div>

      {tags.length === 0 ? (
        <p className="text-sm text-muted2">Aucune étiquette définie. Ajoutez des étiquettes sur vos produits pour les grouper.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mb-4" data-testid="tag-list-chips">
            {tags.map((t) => (
              <div key={t.tag} className={`inline-flex items-center gap-2 border px-2.5 py-1 text-xs ${t.oos_products > 0 ? "border-destructive/60 bg-destructive/10" : "border-ink/20 bg-cream"}`}
                data-testid={`tag-pill-${t.tag}`}>
                <span className="font-medium">{t.tag}</span>
                <span className="text-muted2">· {t.product_count}</span>
                {t.oos_products > 0 && (
                  <>
                    <span className="text-destructive text-[10px] uppercase tracking-widest">Rupture</span>
                    {t.oos_until && <span className="text-[10px] text-muted2">jusqu&apos;au {t.oos_until}</span>}
                    <button onClick={() => clearTag(t.tag)} data-testid={`tag-clear-${t.tag}`}
                      className="text-emerald-700 hover:text-emerald-900 text-[10px] uppercase tracking-widest">réactiver</button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
            <div>
              <Label className="text-[10px] tracking-widest uppercase text-muted2">Étiquette</Label>
              <select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}
                data-testid="tag-oos-select"
                className="w-full border border-ink/20 bg-transparent px-2 py-2 mt-1 text-sm">
                <option value="">— Choisir —</option>
                {tags.map((t) => <option key={t.tag} value={t.tag}>{t.tag} ({t.product_count})</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[10px] tracking-widest uppercase text-muted2">En rupture jusqu&apos;au</Label>
              <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)}
                data-testid="tag-oos-until"
                className="bg-transparent border-ink/20 rounded-none mt-1 text-sm" />
            </div>
            <Button disabled={busy || !selectedTag} onClick={apply} data-testid="tag-oos-apply"
              className="bg-destructive hover:bg-destructive/90 text-cream rounded-none uppercase text-xs tracking-widest h-10">
              {busy ? "…" : "Enlever du stock"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}


// =========== CSV IMPORT DIALOG ===========
function CsvImportDialog({ defaultMenu, cats, onClose, onDone }) {
  const [menuType, setMenuType] = useState(defaultMenu || "restaurant");
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [errors, setErrors] = useState([]);

  const catsFor = (mt) => cats.filter((c) => c.menu_type === mt);

  // Robust CSV parser — handles BOM, comma/semicolon, quoted fields, accented headers
  const parseCsv = (text) => {
    // Strip UTF-8 BOM
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    // Auto-detect delimiter: pick the more frequent one on the first line
    const firstLine = (text.match(/^[^\r\n]*/) || [""])[0];
    const delim = (firstLine.split(";").length > firstLine.split(",").length) ? ";" : ",";
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return [];

    const parseLine = (line) => {
      const out = [];
      let cur = "", inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQ = !inQ;
        else if (c === delim && !inQ) { out.push(cur); cur = ""; }
        else cur += c;
      }
      out.push(cur);
      return out.map((s) => s.trim());
    };

    // Normalize header keys: lowercase, strip accents, strip non-alphanumeric
    const normKey = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const header = parseLine(lines[0]).map(normKey);
    const findIdx = (aliases) => {
      for (const a of aliases) {
        const i = header.indexOf(a);
        if (i !== -1) return i;
      }
      return -1;
    };
    const idx = {
      name: findIdx(["name", "nom", "produit", "product", "titre", "title"]),
      price: findIdx(["price", "prix", "cout", "cost"]),
      category: findIdx(["category", "categorie", "cat", "rubrique"]),
      image: findIdx(["image", "imageurl", "photo", "img", "picture"]),
      description: findIdx(["description", "desc", "detail", "details"]),
    };
    if (idx.name === -1) throw new Error("Colonne 'name' (ou 'nom', 'produit', 'titre') introuvable.");
    if (idx.price === -1) throw new Error("Colonne 'price' (ou 'prix') introuvable.");

    return lines.slice(1).map((line) => {
      const cols = parseLine(line);
      const rawPrice = (cols[idx.price] || "0").replace(/\s/g, "").replace(/[^\d.,]/g, "").replace(",", ".");
      return {
        name: (cols[idx.name] || "").trim(),
        price: parseFloat(rawPrice) || 0,
        category_name: idx.category >= 0 ? (cols[idx.category] || "").trim() : "",
        image_url: idx.image >= 0 ? (cols[idx.image] || "").trim() : "",
        description: idx.description >= 0 ? (cols[idx.description] || "").trim() : "",
      };
    }).filter((r) => r.name); // drop empty rows
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCsv(reader.result);
        setRows(parsed);
        setErrors([]);
      } catch (err) {
        toast.error(err.message || "CSV invalide");
      }
    };
    reader.readAsText(f);
    e.target.value = "";
  };

  const submit = async () => {
    if (rows.length === 0) return;
    setBusy(true);
    setDone(0);
    const errs = [];
    const catList = catsFor(menuType);
    // Match category by normalized name (case + accent insensitive)
    const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const catByName = Object.fromEntries(catList.map((c) => [norm(c.name), c.id]));
    const defaultCat = catList[0]?.id;
    let ok = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.name) { errs.push(`Ligne ${i + 2} : nom manquant`); setDone((d) => d + 1); continue; }
      if (!r.price || r.price <= 0) { errs.push(`Ligne ${i + 2} (${r.name}) : prix manquant ou invalide`); setDone((d) => d + 1); continue; }
      const catId = (r.category_name && catByName[norm(r.category_name)]) || defaultCat;
      if (!catId) { errs.push(`Ligne ${i + 2} (${r.name}) : aucune catégorie disponible dans ce menu`); setDone((d) => d + 1); continue; }
      try {
        await api.post("/products", {
          name: r.name, description: r.description || "", price: r.price,
          image_url: r.image_url || "", category_id: catId, menu_type: menuType,
          addon_group_ids: [], tags: [], variants: [], is_active: true,
        });
        ok++;
      } catch (e) {
        const d = e?.response?.data?.detail;
        const msg = Array.isArray(d) ? d.map((x) => x.msg || JSON.stringify(x)).join("; ")
          : (typeof d === "string" ? d : (d ? JSON.stringify(d) : e.message));
        errs.push(`Ligne ${i + 2} (${r.name}) : ${msg}`);
      }
      setDone((d) => d + 1);
    }
    setErrors(errs);
    setBusy(false);
    if (ok > 0) toast.success(`${ok} produit(s) importé(s)${errs.length ? ` · ${errs.length} erreur(s)` : ""}`);
    else if (errs.length > 0) toast.error(`Aucun produit importé — ${errs.length} erreur(s), voir détails`);
    if (errs.length === 0) setTimeout(() => onDone(), 800);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[calc(100vw-1rem)] max-w-2xl !bg-cream border-ink/10 rounded-none p-0 max-h-[calc(100dvh-2rem)] overflow-y-auto" data-testid="csv-import-dialog">
        <DialogTitle className="sr-only">Importer un CSV</DialogTitle>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-1">
            <Download size={20} className="text-brand" />
            <h3 className="font-display text-2xl">Importer un CSV</h3>
          </div>
          <p className="text-sm text-muted2 mb-3">Colonnes acceptées : <code className="bg-cream-surface px-1 text-xs">name, price, category, image, description</code> (ou <em>nom, prix, catégorie</em>). Séparateur virgule.</p>

          <div className="mb-4">
            <p className="text-[10px] tracking-widest uppercase text-muted2 mb-2">Menu cible</p>
            <div className="flex gap-2">
              {["restaurant", "epicerie"].map((mt) => (
                <button key={mt} onClick={() => setMenuType(mt)} data-testid={`csv-menu-${mt}`}
                  className={`px-4 py-2 text-xs tracking-widest uppercase border ${menuType === mt ? "bg-brand text-cream border-brand" : "border-ink/20 hover:border-brand"}`}>
                  {mt === "restaurant" ? "Restaurant" : "Épicerie"}
                </button>
              ))}
            </div>
          </div>

          <label className="block border-2 border-dashed border-ink/20 hover:border-brand p-6 text-center cursor-pointer transition-colors mb-4" data-testid="csv-dropzone">
            <input type="file" accept=".csv,text/csv" className="hidden" data-testid="csv-file-input" onChange={onFile} />
            <Download size={22} className="mx-auto mb-2 text-brand" strokeWidth={1.5} />
            <p className="font-display text-lg">Cliquez pour sélectionner un fichier CSV</p>
            <p className="text-xs text-muted2 mt-1">Ex : <code className="bg-cream-surface px-1">name,price,category,image</code> puis vos lignes</p>
          </label>

          {rows.length > 0 && (
            <div className="mb-4 border border-ink/10 max-h-72 overflow-y-auto" data-testid="csv-preview">
              <table className="w-full text-xs">
                <thead className="bg-cream-surface sticky top-0"><tr>
                  <th className="text-left p-2">Nom</th><th className="text-right p-2">Prix</th>
                  <th className="text-left p-2">Catégorie</th><th className="text-left p-2">Image</th>
                </tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-ink/5" data-testid={`csv-row-${i}`}>
                      <td className="p-2">{r.name}</td>
                      <td className="p-2 text-right">CHF {r.price.toFixed(2)}</td>
                      <td className="p-2 text-muted2">{r.category_name || "—"}</td>
                      <td className="p-2 text-muted2 truncate max-w-[120px]" title={r.image_url}>{r.image_url ? "✓" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {errors.length > 0 && (
            <div className="mb-4 border border-destructive bg-destructive/10 p-3 text-xs space-y-1 max-h-40 overflow-y-auto" data-testid="csv-errors">
              {errors.map((e, i) => <p key={i}>• {e}</p>)}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
            <p className="text-xs text-muted2">
              {rows.length > 0 && busy ? `Envoi : ${done}/${rows.length}` : `${rows.length} produit(s) prêt(s)`}
            </p>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={onClose} disabled={busy} className="flex-1 sm:flex-none rounded-none border-ink/20 uppercase text-xs tracking-widest">Annuler</Button>
              <Button disabled={busy || rows.length === 0} onClick={submit} data-testid="csv-submit-btn"
                className="flex-1 sm:flex-none bg-brand hover:bg-brand-hover text-cream rounded-none uppercase text-xs tracking-widest">
                {busy ? "Envoi…" : `Importer ${rows.length} produit${rows.length > 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


// =========== BULK UPLOAD DIALOG (auto-parse name + price from filename) ===========
function BulkUploadDialog({ defaultMenu, cats, onClose, onDone }) {
  const [menuType, setMenuType] = useState(defaultMenu || "restaurant");
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);

  const catsFor = (mt) => cats.filter((c) => c.menu_type === mt);

  const parseFilename = (filename) => {
    const stem = filename.replace(/\.[^.]+$/, "");
    const matches = [...stem.matchAll(/\d+[.,]\d+|\d+/g)];
    let price = 0;
    let namePart = stem;
    if (matches.length > 0) {
      const last = matches[matches.length - 1];
      price = parseFloat(last[0].replace(",", "."));
      const candidate = stem.slice(0, last.index);
      if (candidate.replace(/[_\-.,\s]/g, "")) namePart = candidate;
    }
    let name = namePart.replace(/[_\-.,]+/g, " ").replace(/\s+/g, " ").trim();
    name = name.replace(/\s*(chf|fr|€|\$|eur)\s*$/i, "").trim();
    return { name: name || stem, price: Math.round(price * 100) / 100 };
  };

  const onFiles = (files) => {
    const arr = Array.from(files).map((file) => {
      const parsed = parseFilename(file.name);
      return {
        file,
        preview: URL.createObjectURL(file),
        name: parsed.name,
        price: parsed.price,
        category_id: catsFor(menuType)[0]?.id || "",
        status: "pending",
      };
    });
    setRows((prev) => [...prev, ...arr]);
  };

  const updateRow = (i, patch) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (rows.length === 0) return;
    setBusy(true);
    setDone(0);
    let ok = 0;
    let authFailed = false;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.status === "done") { ok++; setDone((d) => d + 1); continue; }
      try {
        const ext = r.file.name.match(/\.[^.]+$/)?.[0] || ".jpg";
        // Rebuild file with edited name+price so backend parses consistently
        const renamed = new File([r.file], `${r.name} ${r.price}${ext}`, { type: r.file.type });
        const fd = new FormData();
        fd.append("file", renamed);
        await api.post(`/admin/products/upload?menu_type=${menuType}&category_id=${encodeURIComponent(r.category_id)}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        updateRow(i, { status: "done" });
        ok++;
      } catch (e) {
        const status = e?.response?.status;
        if (status === 401 || status === 403) { authFailed = true; break; }
        updateRow(i, { status: "error", error: e?.response?.data?.detail || e.message || "erreur" });
      }
      setDone((d) => d + 1);
    }
    setBusy(false);
    if (authFailed) {
      toast.error("Session expirée — reconnexion nécessaire");
      return;
    }
    if (ok > 0) {
      toast.success(`${ok} produit${ok > 1 ? "s" : ""} créé${ok > 1 ? "s" : ""}`);
      setTimeout(() => onDone(), 800);
    } else {
      toast.error("Aucun produit n'a pu être créé. Vérifiez les erreurs par ligne.");
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-3xl !bg-cream border-ink/10 rounded-none p-0 max-h-[92vh] overflow-y-auto" data-testid="bulk-upload-dialog">
        <DialogTitle className="sr-only">Uploader des produits</DialogTitle>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-1">
            <Upload size={20} className="text-brand" />
            <h3 className="font-display text-2xl">Uploader des produits</h3>
          </div>
          <p className="text-sm text-muted2 mb-5">
            Nommez vos images comme <code className="bg-cream-surface px-1.5 py-0.5 text-xs">Tagliatelles al ragù 26.50.jpg</code>. Le nom du produit et le prix sont extraits automatiquement du nom du fichier — vous pouvez tout corriger avant validation.
          </p>

          <div className="mb-4">
            <p className="text-[10px] tracking-widest uppercase text-muted2 mb-2">Menu cible</p>
            <div className="flex gap-2">
              {["restaurant", "epicerie"].map((mt) => (
                <button key={mt} onClick={() => { setMenuType(mt); setRows((rs) => rs.map((r) => ({ ...r, category_id: cats.find((c) => c.menu_type === mt)?.id || "" }))); }}
                  data-testid={`upload-menu-${mt}`}
                  className={`px-4 py-2 text-xs tracking-widest uppercase border ${menuType === mt ? "bg-brand text-cream border-brand" : "border-ink/20 hover:border-brand"}`}>
                  {mt === "restaurant" ? "Restaurant" : "Épicerie"}
                </button>
              ))}
            </div>
          </div>

          <label className="block border-2 border-dashed border-ink/20 hover:border-brand p-6 md:p-8 text-center cursor-pointer transition-colors mb-4"
            data-testid="upload-dropzone">
            <input type="file" accept="image/*" multiple className="hidden" data-testid="upload-file-input"
              onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
            <Upload size={26} className="mx-auto mb-2 text-brand" strokeWidth={1.5} />
            <p className="font-display text-lg">Cliquez pour sélectionner vos images</p>
            <p className="text-xs text-muted2 mt-1">JPG, PNG, WEBP · Format : « Nom du produit 12.90.jpg »</p>
          </label>

          {rows.length > 0 && (
            <div className="space-y-3 mb-5">
              {rows.map((r, i) => (
                <div key={i} className="border border-ink/10 bg-cream p-3 flex flex-col sm:flex-row gap-3 items-start" data-testid={`upload-row-${i}`}>
                  <img src={r.preview} alt="" className="w-full sm:w-20 h-32 sm:h-20 object-cover shrink-0" />
                  <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-6 gap-2 items-start">
                    <div className="sm:col-span-3">
                      <Label className="text-[10px] tracking-widest uppercase text-muted2">Nom</Label>
                      <Input value={r.name} onChange={(e) => updateRow(i, { name: e.target.value })}
                        data-testid={`upload-name-${i}`}
                        className="bg-transparent border-ink/20 rounded-none focus-visible:ring-brand mt-1 text-sm" />
                    </div>
                    <div>
                      <Label className="text-[10px] tracking-widest uppercase text-muted2">Prix (CHF)</Label>
                      <Input type="number" step="0.10" value={r.price} onChange={(e) => updateRow(i, { price: parseFloat(e.target.value) || 0 })}
                        data-testid={`upload-price-${i}`}
                        className="bg-transparent border-ink/20 rounded-none focus-visible:ring-brand mt-1 text-sm" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-[10px] tracking-widest uppercase text-muted2">Catégorie</Label>
                      <select value={r.category_id} onChange={(e) => updateRow(i, { category_id: e.target.value })}
                        data-testid={`upload-cat-${i}`}
                        className="w-full border border-ink/20 bg-transparent px-2 py-1.5 mt-1 text-sm">
                        {catsFor(menuType).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 pt-4 sm:pt-6 self-start">
                    {r.status === "done" && <CheckCircle2 size={20} className="text-emerald-700" />}
                    {r.status === "error" && <span className="text-xs text-destructive">✕ {r.error}</span>}
                    <button onClick={() => removeRow(i)} disabled={busy} className="text-muted2 hover:text-destructive p-1" data-testid={`upload-remove-${i}`}>
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
            <p className="text-xs text-muted2">
              {rows.length > 0 && busy ? `Envoi : ${done}/${rows.length}` : `${rows.length} produit(s) prêt(s)`}
            </p>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={onClose} disabled={busy}
                className="flex-1 sm:flex-none rounded-none border-ink/20 uppercase text-xs tracking-widest">Annuler</Button>
              <Button disabled={busy || rows.length === 0} onClick={submit} data-testid="upload-submit-btn"
                className="flex-1 sm:flex-none bg-brand hover:bg-brand-hover text-cream rounded-none uppercase text-xs tracking-widest">
                {busy ? "Envoi…" : `Créer ${rows.length} produit${rows.length > 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function ProductEditor({ product, cats, groups, onClose, onSaved }) {
  const [p, setP] = useState({ id: product.id, name: product.name || "", description: product.description || "", price: product.price || 0, image_url: product.image_url || "", category_id: product.category_id, menu_type: product.menu_type || "restaurant", addon_group_ids: product.addon_group_ids || [], tags: product.tags || [], variants: product.variants || [], out_of_stock_until: product.out_of_stock_until, is_active: product.is_active !== false });
  const [tagInput, setTagInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const save = async () => {
    try {
      if (product.id) await api.put(`/products/${product.id}`, p);
      else await api.post("/products", p);
      toast.success("Enregistré");
      onSaved();
    } catch (e) {
      toast.error(`Erreur : ${e?.response?.data?.detail || e.message}`);
    }
  };
  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !p.tags.includes(t)) setP({ ...p, tags: [...p.tags, t] });
    setTagInput("");
  };
  const removeTag = (t) => setP({ ...p, tags: p.tags.filter((x) => x !== t) });
  const addVariant = () => setP({ ...p, variants: [...p.variants, { id: crypto.randomUUID(), name: "", quantity: "", price: 0 }] });
  const updateVariant = (idx, patch) => setP({ ...p, variants: p.variants.map((v, i) => i === idx ? { ...v, ...patch } : v) });
  const removeVariant = (idx) => setP({ ...p, variants: p.variants.filter((_, i) => i !== idx) });
  const upload = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", f);
    try { const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } }); setP({ ...p, image_url: data.url }); }
    finally { setUploading(false); }
  };
  const availCats = cats.filter((c) => c.menu_type === p.menu_type);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl bg-cream rounded-none max-h-[90vh] overflow-y-auto">
        <DialogTitle>{product.id ? "Modifier" : "Nouveau"} produit</DialogTitle>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Menu</Label>
              <select value={p.menu_type} onChange={(e) => setP({...p, menu_type: e.target.value})} className="w-full border border-ink/20 px-3 py-2 bg-transparent">
                <option value="restaurant">Restaurant</option><option value="epicerie">Épicerie</option>
              </select>
            </div>
            <div><Label>Catégorie</Label>
              <select value={p.category_id} onChange={(e) => setP({...p, category_id: e.target.value})} className="w-full border border-ink/20 px-3 py-2 bg-transparent">
                {availCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div><Label>Nom</Label><Input value={p.name} onChange={(e) => setP({...p, name: e.target.value})} className="rounded-none bg-transparent border-ink/20" /></div>
          <div><Label>Description</Label><Textarea value={p.description} onChange={(e) => setP({...p, description: e.target.value})} className="rounded-none bg-transparent border-ink/20 resize-none" rows={3} /></div>
          <div><Label>Prix (CHF)</Label><Input type="number" step="0.10" value={p.price} onChange={(e) => setP({...p, price: parseFloat(e.target.value)||0})} className="rounded-none bg-transparent border-ink/20" /></div>
          <div>
            <Label>Étiquettes <span className="text-xs text-muted2 font-normal">(ex : salami, jambon — utilisées pour la rupture de stock)</span></Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2 min-h-[26px]" data-testid="tags-list">
              {p.tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 bg-brand/15 text-brand px-2 py-0.5 text-xs" data-testid={`tag-chip-${t}`}>
                  {t}
                  <button onClick={() => removeTag(t)} className="hover:text-destructive" data-testid={`tag-remove-${t}`}>×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Nouvelle étiquette" data-testid="tag-input"
                className="rounded-none bg-transparent border-ink/20 text-sm" />
              <Button type="button" onClick={addTag} data-testid="tag-add-btn"
                className="rounded-none bg-ink text-cream hover:bg-brand uppercase text-xs tracking-widest">Ajouter</Button>
            </div>
          </div>

          {/* Variants (single-select quantity/size options) */}
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-2">
              <Label>Variantes de quantité / taille <span className="text-xs text-muted2 font-normal">(optionnel — le client choisit UNE variante)</span></Label>
              <Button type="button" onClick={addVariant} data-testid="variant-add-btn"
                className="rounded-none bg-ink text-cream hover:bg-brand uppercase text-[10px] tracking-widest h-8 px-3"><Plus size={12} className="mr-1"/>Ajouter</Button>
            </div>
            {p.variants.length === 0 ? (
              <p className="text-xs text-muted2 italic">Aucune variante. Le prix ci-dessus s&apos;applique par défaut.</p>
            ) : (
              <div className="space-y-2" data-testid="variants-list">
                {p.variants.map((v, i) => (
                  <div key={v.id || i} className="grid grid-cols-1 sm:grid-cols-8 gap-2 items-center border border-ink/10 p-2" data-testid={`variant-row-${i}`}>
                    <Input value={v.name || ""} onChange={(e) => updateVariant(i, { name: e.target.value })}
                      placeholder="Nom (ex : Petite)" data-testid={`variant-name-${i}`}
                      className="sm:col-span-3 rounded-none bg-transparent border-ink/20 text-sm" />
                    <Input value={v.quantity || ""} onChange={(e) => updateVariant(i, { quantity: e.target.value })}
                      placeholder="Quantité (ex : 250ml)" data-testid={`variant-qty-${i}`}
                      className="sm:col-span-2 rounded-none bg-transparent border-ink/20 text-sm" />
                    <Input type="number" step="0.10" value={v.price || 0} onChange={(e) => updateVariant(i, { price: parseFloat(e.target.value) || 0 })}
                      placeholder="Prix CHF" data-testid={`variant-price-${i}`}
                      className="sm:col-span-2 rounded-none bg-transparent border-ink/20 text-sm" />
                    <Button type="button" variant="outline" size="icon" onClick={() => removeVariant(i)} data-testid={`variant-remove-${i}`}
                      className="rounded-none border-ink/20 h-9 w-9 sm:col-span-1 justify-self-end"><Trash2 size={12}/></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div><Label>Image URL</Label>
            <Input value={p.image_url} onChange={(e) => setP({...p, image_url: e.target.value})} placeholder="https://... ou /api/uploads/..." className="rounded-none bg-transparent border-ink/20" />
            <input type="file" accept="image/*" onChange={upload} className="mt-2 text-sm" />
            {uploading && <p className="text-xs text-muted2">Envoi…</p>}
            {p.image_url && <img src={mediaUrl(p.image_url)} alt="" className="mt-2 w-32 h-32 object-cover border border-ink/10" />}
          </div>
          <div><Label>Groupes de suppléments</Label>
            <div className="space-y-1 mt-2">
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={p.addon_group_ids.includes(g.id)} onCheckedChange={(v) => setP({ ...p, addon_group_ids: v ? [...p.addon_group_ids, g.id] : p.addon_group_ids.filter((x) => x !== g.id) })} />
                  {g.name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={save} className="flex-1 bg-brand hover:bg-brand-hover text-cream rounded-none uppercase tracking-widest">Enregistrer</Button>
          <Button variant="outline" onClick={onClose} className="rounded-none border-ink/20">Annuler</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoriesEditor({ cats, onChange, editing, setEditing }) {
  const [menuType, setMenuType] = useState("restaurant");
  const filtered = cats.filter((c) => c.menu_type === menuType).sort((a, b) => a.order - b.order);
  const move = async (c, dir) => { await api.post(`/categories/${c.id}/move`, null, { params: { direction: dir } }); onChange(); };
  const del = async (c) => { if (!confirm("Supprimer ?")) return; await api.delete(`/categories/${c.id}`); onChange(); };
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {["restaurant", "epicerie"].map((mt) => (
          <button key={mt} onClick={() => setMenuType(mt)} className={`px-4 py-2 text-xs tracking-widest uppercase border ${menuType===mt ? "bg-brand text-cream border-brand" : "border-ink/20"}`}>{mt}</button>
        ))}
        <Button onClick={() => setEditing({ menu_type: menuType, name: "", order: filtered.length })} className="ml-auto bg-brand hover:bg-brand-hover text-cream rounded-none uppercase text-xs tracking-widest"><Plus size={14}/></Button>
      </div>
      <div className="space-y-2">
        {filtered.map((c) => (
          <div key={c.id} className="border border-ink/10 bg-cream p-3 flex items-center gap-3">
            <span className="flex-1 font-display text-lg">{c.name}</span>
            <button onClick={() => move(c, "up")} className="p-1"><ChevronUp size={16}/></button>
            <button onClick={() => move(c, "down")} className="p-1"><ChevronDown size={16}/></button>
            <Button size="sm" onClick={() => setEditing(c)} className="rounded-none h-7 bg-ink text-cream"><Pencil size={12}/></Button>
            <Button size="sm" variant="outline" onClick={() => del(c)} className="rounded-none h-7 border-ink/20"><Trash2 size={12}/></Button>
          </div>
        ))}
      </div>
      {editing && (
        <Dialog open onOpenChange={(v) => !v && setEditing(null)}>
          <DialogContent className="bg-cream rounded-none">
            <DialogTitle>{editing.id ? "Modifier" : "Nouvelle"} catégorie</DialogTitle>
            <div className="space-y-3">
              <div><Label>Nom</Label><Input value={editing.name} onChange={(e) => setEditing({...editing, name: e.target.value})} className="rounded-none bg-transparent border-ink/20" /></div>
              <div><Label>Menu</Label>
                <select value={editing.menu_type} onChange={(e) => setEditing({...editing, menu_type: e.target.value})} className="w-full border border-ink/20 px-3 py-2 bg-transparent">
                  <option value="restaurant">Restaurant</option><option value="epicerie">Épicerie</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button data-testid="cat-save-btn" onClick={async () => {
                try {
                  if (!editing.name?.trim()) { toast.error("Nom obligatoire"); return; }
                  if (editing.id) await api.put(`/categories/${editing.id}`, editing);
                  else await api.post("/categories", editing);
                  toast.success("Catégorie enregistrée");
                  setEditing(null); onChange();
                } catch (e) {
                  const s = e?.response?.status;
                  toast.error(s === 401 || s === 403 ? "Session expirée — reconnexion en cours" : `Erreur : ${e?.response?.data?.detail || e.message}`);
                }
              }} className="flex-1 bg-brand hover:bg-brand-hover text-cream rounded-none uppercase tracking-widest">Enregistrer</Button>
              <Button variant="outline" onClick={() => setEditing(null)} className="rounded-none border-ink/20">Annuler</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function AddonGroupsEditor({ groups, onChange, editing, setEditing }) {
  const del = async (g) => { if (!confirm("Supprimer ?")) return; await api.delete(`/addon-groups/${g.id}`); onChange(); };
  return (
    <div>
      <div className="flex mb-4">
        <Button onClick={() => setEditing({ name: "", required: false, multi: false, min: 0, max: 1, options: [] })} className="ml-auto bg-brand hover:bg-brand-hover text-cream rounded-none uppercase text-xs tracking-widest"><Plus size={14}/> Nouveau groupe</Button>
      </div>
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.id} className="border border-ink/10 bg-cream p-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-display text-xl">{g.name}</p>
                <p className="text-xs text-muted2">{g.required ? "Obligatoire" : "Optionnel"} · {g.multi ? "Choix multiples" : "Choix unique"} · {g.options.length} options</p>
              </div>
              <Button size="sm" onClick={() => setEditing(g)} className="rounded-none h-7 bg-ink text-cream"><Pencil size={12}/></Button>
              <Button size="sm" variant="outline" onClick={() => del(g)} className="rounded-none h-7 border-ink/20"><Trash2 size={12}/></Button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <Dialog open onOpenChange={(v) => !v && setEditing(null)}>
          <DialogContent className="bg-cream rounded-none max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogTitle>Groupe de suppléments</DialogTitle>
            <div className="space-y-3">
              <div><Label>Nom</Label><Input value={editing.name} onChange={(e) => setEditing({...editing, name: e.target.value})} className="rounded-none bg-transparent border-ink/20" /></div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={editing.required} onCheckedChange={(v) => setEditing({...editing, required: !!v})} />Obligatoire</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={editing.multi} onCheckedChange={(v) => setEditing({...editing, multi: !!v})} />Choix multiples</label>
              </div>
              <div>
                <Label>Options</Label>
                {editing.options.map((o, i) => (
                  <div key={i} className="flex gap-2 mt-2">
                    <Input value={o.name} onChange={(e) => { const opts = [...editing.options]; opts[i].name = e.target.value; setEditing({...editing, options: opts}); }} placeholder="Nom" className="rounded-none bg-transparent border-ink/20" />
                    <Input type="number" step="0.1" value={o.price} onChange={(e) => { const opts = [...editing.options]; opts[i].price = parseFloat(e.target.value) || 0; setEditing({...editing, options: opts}); }} placeholder="Prix" className="w-24 rounded-none bg-transparent border-ink/20" />
                    <Button variant="outline" onClick={() => setEditing({...editing, options: editing.options.filter((_, j) => j !== i)})} className="rounded-none border-ink/20"><Trash2 size={12}/></Button>
                  </div>
                ))}
                <Button onClick={() => setEditing({...editing, options: [...editing.options, { id: crypto.randomUUID(), name: "", price: 0 }]})} className="mt-2 rounded-none bg-ink text-cream uppercase text-xs">+ Option</Button>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={async () => {
                if (editing.id) await api.put(`/addon-groups/${editing.id}`, editing);
                else await api.post("/addon-groups", editing);
                setEditing(null); onChange();
              }} className="flex-1 bg-brand hover:bg-brand-hover text-cream rounded-none uppercase tracking-widest">Enregistrer</Button>
              <Button variant="outline" onClick={() => setEditing(null)} className="rounded-none border-ink/20">Annuler</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// =========== HOURS TAB ===========
function HoursTab() {
  const [tab, setTab] = useState("restaurant");
  const [sched, setSched] = useState(null);
  const [closedInput, setClosedInput] = useState("");

  const load = async (kind) => { const { data } = await api.get(`/schedule/${kind}`); setSched(data); };
  useEffect(() => { load(tab); }, [tab]);
  if (!sched) return null;

  const update = async () => {
    await api.put(`/schedule/${tab}`, { days: sched.days, closed_dates: sched.closed_dates });
    toast.success("Enregistré");
    load(tab);
  };
  const setDay = (dk, patch) => setSched({ ...sched, days: { ...sched.days, [dk]: { ...sched.days[dk], ...patch } } });

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {["restaurant", "epicerie", "reservation"].map((k) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-xs tracking-widest uppercase border ${tab===k ? "bg-brand text-cream border-brand" : "border-ink/20"}`}>
            {k}
          </button>
        ))}
      </div>
      <div className="grid gap-3">
        {Object.entries(DAY_LABELS).map(([dk, dl]) => {
          const d = sched.days[dk] || {};
          return (
            <div key={dk} className="border border-ink/10 bg-cream p-4 flex flex-wrap items-center gap-3">
              <span className="w-24 font-medium">{dl}</span>
              <label className="flex items-center gap-2 text-sm"><Switch checked={!d.closed} onCheckedChange={(v) => setDay(dk, { closed: !v })} /> Ouvert</label>
              {!d.closed && (
                <>
                  <span className="text-xs text-muted2">Midi</span>
                  <Input type="time" value={d.lunch_start} onChange={(e) => setDay(dk, { lunch_start: e.target.value })} className="w-32 rounded-none bg-transparent border-ink/20" />
                  <Input type="time" value={d.lunch_end} onChange={(e) => setDay(dk, { lunch_end: e.target.value })} className="w-32 rounded-none bg-transparent border-ink/20" />
                  <span className="text-xs text-muted2">Soir</span>
                  <Input type="time" value={d.dinner_start} onChange={(e) => setDay(dk, { dinner_start: e.target.value })} className="w-32 rounded-none bg-transparent border-ink/20" />
                  <Input type="time" value={d.dinner_end} onChange={(e) => setDay(dk, { dinner_end: e.target.value })} className="w-32 rounded-none bg-transparent border-ink/20" />
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 border border-ink/10 bg-cream p-4">
        <p className="text-sm mb-2">Dates fermées (vacances)</p>
        <div className="flex gap-2 mb-3">
          <Input type="date" value={closedInput} onChange={(e) => setClosedInput(e.target.value)} className="w-48 rounded-none bg-transparent border-ink/20" />
          <Button onClick={() => { if (closedInput && !sched.closed_dates.includes(closedInput)) { setSched({ ...sched, closed_dates: [...sched.closed_dates, closedInput] }); setClosedInput(""); } }} className="rounded-none bg-ink text-cream uppercase text-xs">Ajouter</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {sched.closed_dates.map((d) => (
            <span key={d} className="inline-flex items-center gap-2 border border-ink/20 px-3 py-1 text-xs">
              {d}<button onClick={() => setSched({ ...sched, closed_dates: sched.closed_dates.filter((x) => x !== d) })}><Trash2 size={12}/></button>
            </span>
          ))}
        </div>
      </div>

      <Button onClick={update} className="mt-6 bg-brand hover:bg-brand-hover text-cream rounded-none uppercase tracking-widest">Enregistrer les horaires</Button>
    </div>
  );
}

// =========== PROMOS TAB ===========
function PromosTab() {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [n, setN] = useState({
    code: "",
    type: "percent",
    value: 10,
    min_amount: 0,
    scope: "all",
    product_id: null,
    active: true,
  });
  const load = async () => {
    const [pr, pd] = await Promise.all([
      api.get("/admin/promos"),
      api.get("/products/all"),
    ]);
    setItems(pr.data);
    setProducts(pd.data);
  };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (n.scope === "product" && !n.product_id) {
      toast.error("Choisissez un produit");
      return;
    }
    if (n.type !== "bogo" && (!n.value || n.value <= 0)) {
      toast.error("Valeur invalide");
      return;
    }
    const payload = {
      ...n,
      code: (n.code || "").toUpperCase().trim(),
      product_id: n.scope === "product" ? n.product_id : null,
    };
    await api.post("/admin/promos", payload);
    toast.success(payload.code ? `Code ${payload.code} créé` : "Promotion auto créée");
    setN({ code: "", type: "percent", value: 10, min_amount: 0, scope: "all", product_id: null, active: true });
    load();
  };
  const del = async (p) => { if (!confirm("Supprimer cette promotion ?")) return; await api.delete(`/admin/promos/${p.id}`); load(); };
  const toggle = async (p) => { await api.patch(`/admin/promos/${p.id}`, null, { params: { active: !p.active } }); load(); };

  const productName = (pid) => products.find((p) => p.id === pid)?.name || "?";
  const typeLabel = (t) => t === "percent" ? "% remise" : t === "fixed" ? "CHF remise" : "1 acheté = 1 offert";

  return (
    <div>
      {/* CREATE FORM */}
      <div className="border border-ink/10 bg-cream p-5 mb-6">
        <p className="text-xs tracking-[.3em] uppercase text-brand mb-4">Nouvelle promotion</p>

        {/* Scope */}
        <div className="mb-4">
          <Label className="text-xs tracking-widest uppercase mb-2 block">Portée</Label>
          <div className="grid grid-cols-2 gap-2">
            <button data-testid="promo-scope-all"
              onClick={() => setN({ ...n, scope: "all", product_id: null })}
              className={`border p-3 text-left ${n.scope === "all" ? "border-brand bg-brand/10" : "border-ink/20"}`}>
              <p className="text-sm font-medium">Tout le site</p>
              <p className="text-xs text-muted2">S&apos;applique à toutes les commandes</p>
            </button>
            <button data-testid="promo-scope-product"
              onClick={() => setN({ ...n, scope: "product" })}
              className={`border p-3 text-left ${n.scope === "product" ? "border-brand bg-brand/10" : "border-ink/20"}`}>
              <p className="text-sm font-medium">Un produit spécifique</p>
              <p className="text-xs text-muted2">S&apos;applique à un seul produit</p>
            </button>
          </div>
        </div>

        {n.scope === "product" && (
          <div className="mb-4">
            <Label className="text-xs tracking-widest uppercase">Produit</Label>
            <select value={n.product_id || ""} onChange={(e) => setN({ ...n, product_id: e.target.value })}
              data-testid="promo-product-select"
              className="w-full border border-ink/20 px-3 py-2 bg-transparent mt-1.5">
              <option value="">— Choisir un produit —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.menu_type} · {CHF(p.price)}</option>
              ))}
            </select>
          </div>
        )}

        {/* Type */}
        <div className="mb-4">
          <Label className="text-xs tracking-widest uppercase mb-2 block">Type de remise</Label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: "percent", label: "Pourcentage" },
              { v: "fixed", label: "Montant fixe" },
              { v: "bogo", label: "1 acheté = 1 offert" },
            ].map((t) => (
              <button key={t.v} data-testid={`promo-type-${t.v}`}
                onClick={() => setN({ ...n, type: t.v })}
                className={`border p-2.5 text-sm ${n.type === t.v ? "border-brand bg-brand/10" : "border-ink/20"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Value */}
        {n.type !== "bogo" && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <Label className="text-xs tracking-widest uppercase">
                {n.type === "percent" ? "Pourcentage (%)" : "Montant (CHF)"}
              </Label>
              <Input type="number" step="0.1" value={n.value}
                onChange={(e) => setN({ ...n, value: parseFloat(e.target.value) || 0 })}
                data-testid="promo-value"
                className="rounded-none bg-transparent border-ink/20 mt-1.5" />
            </div>
            <div>
              <Label className="text-xs tracking-widest uppercase">Seuil min. (CHF)</Label>
              <Input type="number" step="1" value={n.min_amount}
                onChange={(e) => setN({ ...n, min_amount: parseFloat(e.target.value) || 0 })}
                data-testid="promo-min"
                className="rounded-none bg-transparent border-ink/20 mt-1.5" />
            </div>
          </div>
        )}

        {/* Code (optional) */}
        <div className="mb-4">
          <Label className="text-xs tracking-widest uppercase">Code (optionnel)</Label>
          <Input value={n.code}
            onChange={(e) => setN({ ...n, code: e.target.value.toUpperCase() })}
            placeholder="Ex : ETE25 — laisser vide pour appliquer automatiquement"
            data-testid="promo-code-input"
            className="rounded-none bg-transparent border-ink/20 mt-1.5" />
          <p className="text-xs text-muted2 mt-1.5">
            {n.code
              ? "Le client devra saisir ce code pour bénéficier de la promotion."
              : "Aucun code — la promotion s'applique automatiquement à chaque commande éligible."}
          </p>
        </div>

        <Button onClick={create} data-testid="promo-create-btn"
          className="bg-brand hover:bg-brand-hover text-cream rounded-none uppercase tracking-widest">
          Créer la promotion
        </Button>
      </div>

      {/* LIST */}
      <div className="space-y-2">
        {items.length === 0 && <p className="text-muted2 text-sm">Aucune promotion active.</p>}
        {items.map((p) => (
          <div key={p.id} className={`border p-4 flex flex-wrap items-center gap-3 ${p.active ? "border-brand/40 bg-cream" : "border-ink/10 bg-cream/50 opacity-60"}`}
            data-testid={`promo-item-${p.id}`}>
            <div className="flex-1 min-w-[240px]">
              <div className="flex items-center gap-2 mb-1">
                {p.code ? (
                  <span className="font-mono text-brand text-lg">{p.code}</span>
                ) : (
                  <span className="text-xs tracking-widest uppercase bg-emerald-700 text-cream px-2 py-1">Auto</span>
                )}
                <span className={`text-[10px] tracking-widest uppercase px-2 py-0.5 ${p.active ? "bg-brand text-cream" : "bg-ink/30 text-cream"}`}>
                  {p.active ? "Active" : "Désactivée"}
                </span>
              </div>
              <p className="text-sm">
                {p.type === "bogo"
                  ? "1 acheté = 1 offert"
                  : p.type === "percent"
                    ? `${p.value}% de remise`
                    : `${CHF(p.value)} de remise`}
                {" · "}
                {p.scope === "product" ? `sur ${productName(p.product_id)}` : "sur tout le site"}
                {p.min_amount > 0 && ` · dès ${CHF(p.min_amount)} d'achat`}
              </p>
            </div>
            <Button size="sm" onClick={() => toggle(p)} className={`rounded-none text-xs uppercase ${p.active ? "bg-ink text-cream" : "bg-emerald-700 text-cream"}`}>
              {p.active ? "Désactiver" : "Activer"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => del(p)} className="rounded-none border-ink/20"><Trash2 size={14}/></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// =========== EMAILS TAB (owner) ===========
function EmailsTab() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/admin/marketing-emails").then((r) => setItems(r.data)).catch(() => toast.error("Accès refusé")); }, []);
  const csv = () => {
    const rows = [["Email", "Prénom", "Nom", "Téléphone", "Source", "Commandes", "Réservations", "Dernière activité"]];
    items.forEach((e) => rows.push([e.email, e.first_name||"", e.last_name||"", e.phone||"", e.source||"", e.order_count||0, e.reservation_count||0, e.last_activity||""]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "emails.csv"; a.click();
  };
  const copyAll = () => { navigator.clipboard.writeText(items.map((e) => e.email).join(", ")); toast.success("Copié"); };
  return (
    <div>
      <div className="flex gap-2 mb-4">
        <Button onClick={csv} className="bg-brand hover:bg-brand-hover text-cream rounded-none uppercase tracking-widest"><Download size={14} className="mr-2"/>Export CSV</Button>
        <Button variant="outline" onClick={copyAll} className="rounded-none border-ink/20"><Copy size={14} className="mr-2"/>Copier tous</Button>
      </div>
      <div className="border border-ink/10 bg-cream overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-cream-surface">
            <th className="text-left p-3 text-xs tracking-widest uppercase">Email</th>
            <th className="text-left p-3 text-xs tracking-widest uppercase">Client</th>
            <th className="text-left p-3 text-xs tracking-widest uppercase">Téléphone</th>
            <th className="text-left p-3 text-xs tracking-widest uppercase">Source</th>
            <th className="text-left p-3 text-xs tracking-widest uppercase">Cmd</th>
            <th className="text-left p-3 text-xs tracking-widest uppercase">Rés.</th>
            <th className="text-left p-3 text-xs tracking-widest uppercase">Dernière activité</th>
          </tr></thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.email} className="border-t border-ink/5">
                <td className="p-3">{e.email}</td>
                <td className="p-3">{e.first_name} {e.last_name}</td>
                <td className="p-3">{e.phone}</td>
                <td className="p-3 text-xs uppercase text-brand">{e.source}</td>
                <td className="p-3">{e.order_count || 0}</td>
                <td className="p-3">{e.reservation_count || 0}</td>
                <td className="p-3 text-xs text-muted2">{e.last_activity?.slice(0,10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =========== ACCOUNTING TAB ===========
function AccountingTab() {
  const now = new Date();
  const [m, setM] = useState(now.getMonth() + 1);
  const [y, setY] = useState(now.getFullYear());
  const download = async () => {
    const res = await api.get("/admin/accounting/pdf", { params: { month: m, year: y }, responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a"); a.href = url; a.download = `comptabilite-${y}-${String(m).padStart(2,"0")}.pdf`; a.click();
  };
  return (
    <div className="border border-ink/10 bg-cream p-6 max-w-md">
      <p className="font-display text-2xl mb-4">Rapport mensuel</p>
      <p className="text-sm text-muted2 mb-4">CA brut/net, TVA détaillée, produits vendus. Anonymisé, commandes supprimées exclues.</p>
      <div className="flex gap-2 mb-4">
        <select value={m} onChange={(e) => setM(parseInt(e.target.value))} className="flex-1 border border-ink/20 px-3 py-2 bg-transparent">
          {Array.from({length:12}).map((_,i) => <option key={i} value={i+1}>{new Date(0,i).toLocaleString("fr", {month:"long"})}</option>)}
        </select>
        <Input type="number" value={y} onChange={(e) => setY(parseInt(e.target.value))} className="w-28 rounded-none bg-transparent border-ink/20" />
      </div>
      <Button onClick={download} data-testid="download-pdf-btn" className="w-full bg-brand hover:bg-brand-hover text-cream rounded-none uppercase tracking-widest"><Download size={14} className="mr-2"/> Télécharger PDF</Button>
    </div>
  );
}

// =========== SETTINGS TAB ===========
function SettingsTab() {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/settings").then((r) => setS(r.data)); }, []);
  if (!s) return null;
  const save = async () => { await api.put("/settings", s); toast.success("Enregistré"); };
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Nom restaurant</Label><Input value={s.restaurant_name} onChange={(e) => setS({...s, restaurant_name: e.target.value})} className="rounded-none bg-transparent border-ink/20" /></div>
        <div><Label>Téléphone</Label><Input value={s.phone} onChange={(e) => setS({...s, phone: e.target.value})} className="rounded-none bg-transparent border-ink/20" /></div>
        <div><Label>Email</Label><Input value={s.email} onChange={(e) => setS({...s, email: e.target.value})} className="rounded-none bg-transparent border-ink/20" /></div>
        <div><Label>Adresse</Label><Input value={s.address} onChange={(e) => setS({...s, address: e.target.value})} className="rounded-none bg-transparent border-ink/20" /></div>
        <div><Label>TVA emporter</Label><Input type="number" step="0.001" value={s.vat_takeaway} onChange={(e) => setS({...s, vat_takeaway: parseFloat(e.target.value)})} className="rounded-none bg-transparent border-ink/20" /></div>
        <div><Label>Temps de préparation (min)</Label><Input type="number" step="1" value={s.preparation_time_minutes || 30} onChange={(e) => setS({...s, preparation_time_minutes: parseInt(e.target.value) || 30})} data-testid="prep-time-input" className="rounded-none bg-transparent border-ink/20" /></div>
        <div><Label>Épicerie — jours à l&apos;avance</Label><Input type="number" step="1" min="1" max="30" value={s.epicerie_days_ahead || 7} onChange={(e) => setS({...s, epicerie_days_ahead: parseInt(e.target.value) || 7})} data-testid="epicerie-days-input" className="rounded-none bg-transparent border-ink/20" /></div>
      </div>
      <label className="flex items-center gap-3"><Switch checked={s.orders_enabled} onCheckedChange={(v) => setS({...s, orders_enabled: v})} /> Commandes activées</label>
      <label className="flex items-center gap-3"><Switch checked={s.reservations_enabled} onCheckedChange={(v) => setS({...s, reservations_enabled: v})} /> Réservations activées</label>
      <Button onClick={save} className="bg-brand hover:bg-brand-hover text-cream rounded-none uppercase tracking-widest">Enregistrer</Button>
    </div>
  );
}

// =========== ADMIN DASHBOARD ===========
export default function AdminDashboard() {
  const nav = useNavigate();
  const [tab, setTab] = useState("orders");
  const ping = usePing();
  const [soundOn, setSoundOn] = useState(false);
  const [wakeOn, setWakeOn] = useState(false);
  const [showReady, setShowReady] = useState(false);
  const [role, setRole] = useState("");
  const [username, setUsername] = useState("");
  const wakeRef = useRef(null);

  useEffect(() => {
    const t = localStorage.getItem("angel_token");
    if (!t) { nav("/Angel/login"); return; }
    setRole(localStorage.getItem("angel_role") || "");
    setUsername(localStorage.getItem("angel_user") || "");
    // Show ready-modal on first landing (per session)
    if (!sessionStorage.getItem("angel_ready_dismissed")) setShowReady(true);
  }, []);

  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeRef.current = await navigator.wakeLock.request("screen");
        wakeRef.current.addEventListener("release", () => setWakeOn(false));
        setWakeOn(true);
        return true;
      }
    } catch (e) { console.warn("WakeLock error", e); }
    return false;
  };
  // Re-acquire wake lock on visibility change
  useEffect(() => {
    const onVis = async () => {
      if (wakeOn && document.visibilityState === "visible" && !wakeRef.current) {
        try { wakeRef.current = await navigator.wakeLock.request("screen"); } catch {}
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [wakeOn]);

  const enableEverything = async () => {
    const s = ping.enable();
    if (s) setSoundOn(true);
    const w = await requestWakeLock();
    if (s || w) toast.success("Notifications & écran maintenu allumé");
    sessionStorage.setItem("angel_ready_dismissed", "1");
    setShowReady(false);
  };
  const skipReady = () => { sessionStorage.setItem("angel_ready_dismissed", "1"); setShowReady(false); };

  const logout = () => { localStorage.removeItem("angel_token"); localStorage.removeItem("angel_role"); localStorage.removeItem("angel_user"); nav("/Angel/login"); };
  const enableSound = () => { if (ping.enable()) { setSoundOn(true); toast.success("Notifications sonores activées"); } };

  const isOwner = role === "owner";

  return (
    <div className="min-h-screen bg-cream-surface">
      {showReady && (
        <div className="fixed inset-0 z-[80] bg-ink/70 backdrop-blur-sm flex items-center justify-center p-4" data-testid="ready-modal">
          <div className="bg-cream max-w-md w-full p-6 border border-ink/10 shadow-2xl">
            <p className="text-xs tracking-widest uppercase text-brand mb-2">Angelucci&apos;s · Admin</p>
            <h2 className="font-display text-2xl mb-3">Prêt à recevoir les commandes ?</h2>
            <p className="text-sm text-muted2 mb-5">
              Pour ne rater aucune commande, on active le son (alarme toutes les 30 s pendant 6 min) et le mode anti-veille (écran maintenu allumé).
            </p>
            <ul className="text-sm space-y-2 mb-6">
              <li className="flex items-center gap-2"><Volume2 size={16} className="text-brand"/> Alerte sonore continue</li>
              <li className="flex items-center gap-2"><Bell size={16} className="text-brand"/> Notification push (Pushover)</li>
              <li className="flex items-center gap-2"><span className="text-brand">☀︎</span> Anti-veille écran</li>
            </ul>
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button onClick={skipReady} variant="outline" data-testid="ready-skip"
                className="flex-1 rounded-none border-ink/20 uppercase text-xs tracking-widest h-11">
                Plus tard
              </Button>
              <Button onClick={enableEverything} data-testid="ready-enable"
                className="flex-1 rounded-none bg-brand hover:bg-brand-hover text-cream uppercase text-xs tracking-widest h-11">
                Activer tout
              </Button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-ink text-cream sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-6">
          <img src={LOGO} alt="" className="h-8 w-8 sm:h-10 sm:w-10 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-xs tracking-widest uppercase text-cream/60">Espace admin</p>
            <p className="font-display text-base sm:text-xl truncate">Angelucci&apos;s</p>
          </div>
          <span className="hidden md:inline text-xs text-cream/70">{username} · <span className="text-brand uppercase">{role}</span></span>
          {!soundOn ? (
            <Button onClick={enableSound} data-testid="enable-sound-btn" className="rounded-none bg-brand hover:bg-brand-hover text-cream uppercase text-[10px] sm:text-xs tracking-widest h-9 px-2 sm:px-4">
              <Volume2 size={14} className="sm:mr-1"/> <span className="hidden sm:inline">Activer le son</span>
            </Button>
          ) : (
            <span className="text-xs text-brand flex items-center gap-1"><Bell size={14}/> <span className="hidden sm:inline">Son ON</span></span>
          )}
          {wakeOn && <span className="hidden sm:flex text-xs text-brand items-center gap-1" data-testid="wake-on">☀︎ Écran ON</span>}
          <Button onClick={logout} variant="outline" data-testid="admin-logout" className="rounded-none border-cream/20 text-cream hover:bg-cream hover:text-ink h-9 px-2 sm:px-3"><LogOut size={14}/></Button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-transparent rounded-none border-b border-ink/10 w-full justify-start overflow-x-auto flex-nowrap sm:flex-wrap h-auto p-0 -mx-3 sm:mx-0 px-3 sm:px-0">
            {[
              { v: "orders", label: "Commandes" },
              { v: "reservations", label: "Réservations" },
              { v: "menu", label: "Menu" },
              { v: "hours", label: "Horaires" },
              { v: "promos", label: "Promotions" },
              ...(isOwner ? [{ v: "emails", label: "Emails clients" }] : []),
              { v: "accounting", label: "Comptabilité" },
              { v: "settings", label: "Paramètres" },
            ].map((t) => (
              <TabsTrigger key={t.v} value={t.v} data-testid={`tab-${t.v}`}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-brand data-[state=active]:bg-transparent data-[state=active]:text-brand text-[10px] sm:text-xs tracking-widest uppercase h-11 sm:h-12 px-3 sm:px-5 whitespace-nowrap shrink-0">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-8">
            <TabsContent value="orders"><OrdersTab ping={ping} /></TabsContent>
            <TabsContent value="reservations"><ReservationsTab /></TabsContent>
            <TabsContent value="menu"><MenuTab /></TabsContent>
            <TabsContent value="hours"><HoursTab /></TabsContent>
            <TabsContent value="promos"><PromosTab /></TabsContent>
            {isOwner && <TabsContent value="emails"><EmailsTab /></TabsContent>}
            <TabsContent value="accounting"><AccountingTab /></TabsContent>
            <TabsContent value="settings"><SettingsTab /></TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
}
