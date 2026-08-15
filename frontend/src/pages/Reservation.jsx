import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import PageTransition from "@/components/PageTransition";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { CheckCircle2, Users, Clock } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

const TIMES = (() => {
  const arr = [];
  for (let h = 11; h <= 22; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === 22 && m > 30) break;
      arr.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return arr;
})();

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export default function Reservation() {
  const [schedule, setSchedule] = useState(null);
  const [selDate, setSelDate] = useState(null);
  const [selTime, setSelTime] = useState("");
  const [people, setPeople] = useState(2);
  const [form, setForm] = useState({ first_name: "", phone: "", email: "", comment: "", honeypot: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { api.get("/schedule/reservation").then((r) => setSchedule(r.data)); }, []);

  const closedDates = useMemo(() => (schedule?.closed_dates || []).map((d) => new Date(d)), [schedule]);
  const isDayClosed = (day) => {
    if (!schedule) return false;
    const dk = DAY_KEYS[day.getDay()];
    const cfg = schedule.days?.[dk];
    if (!cfg || cfg.closed) return true;
    const iso = day.toISOString().split("T")[0];
    return schedule.closed_dates?.includes(iso);
  };

  const submit = async () => {
    setError("");
    if (!selDate || !selTime || !form.first_name || !form.phone || !form.email) {
      setError("Merci de remplir tous les champs.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        first_name: form.first_name, phone: form.phone, email: form.email,
        date: selDate.toISOString().split("T")[0], time: selTime,
        people, comment: form.comment, honeypot: form.honeypot,
      };
      const { data } = await api.post("/reservations", payload);
      setSuccess(data);
      toast.success("Réservation confirmée !");
    } catch (e) {
      setError(e.response?.data?.detail || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <PageTransition>
        <section className="pt-40 pb-24 max-w-2xl mx-auto px-6 md:px-10 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}
            className="w-20 h-20 mx-auto mb-8 rounded-full bg-brand text-cream flex items-center justify-center">
            <CheckCircle2 size={40} strokeWidth={1.5} />
          </motion.div>
          <p className="text-xs tracking-[.4em] uppercase text-brand mb-4">Confirmation</p>
          <h1 className="font-display text-5xl mb-6">Votre table est réservée</h1>
          <p className="text-muted2 mb-8 text-lg">
            Un email de confirmation vient de vous être envoyé.
            À très bientôt chez Angelucci's.
          </p>
          <div className="inline-block border border-brand text-left p-6">
            <p className="text-xs tracking-widest uppercase text-muted2">Date · Heure · Personnes</p>
            <p className="font-display text-2xl mt-2">
              {format(selDate, "EEEE d MMMM yyyy", { locale: fr })} · {selTime} · {people}
            </p>
          </div>
        </section>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <section className="pt-32 pb-24 max-w-6xl mx-auto px-6 md:px-10">
        <p className="text-xs tracking-[.4em] uppercase text-brand mb-4">Réservation</p>
        <h1 className="font-display text-5xl md:text-6xl mb-4">Réserver une table</h1>
        <p className="text-muted2 mb-12 max-w-2xl">Confirmation immédiate. Nous vous accueillerons avec plaisir.</p>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Left — calendar & time */}
          <div>
            <div className="bg-cream-surface p-6 mb-6">
              <p className="text-xs tracking-widest uppercase text-muted2 mb-3">Date</p>
              <Calendar
                mode="single"
                selected={selDate}
                onSelect={setSelDate}
                disabled={(d) => d < new Date(new Date().setHours(0,0,0,0)) || isDayClosed(d)}
                locale={fr}
                className="mx-auto"
                data-testid="res-calendar"
              />
            </div>
            <div>
              <p className="text-xs tracking-widest uppercase text-muted2 mb-3 flex items-center gap-2"><Clock size={14}/> Heure</p>
              <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto p-1">
                {TIMES.map((t) => (
                  <button key={t} onClick={() => setSelTime(t)} data-testid={`time-${t}`}
                    className={`py-2 text-sm tracking-wide border transition-colors ${selTime === t ? "bg-brand text-cream border-brand" : "border-ink/15 hover:border-brand"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right — details */}
          <div className="space-y-5">
            <div>
              <Label className="text-xs tracking-widest uppercase flex items-center gap-2"><Users size={14}/> Nombre de personnes</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {[1,2,3,4,5,6,7,8].map((n) => (
                  <button key={n} onClick={() => setPeople(n)} data-testid={`people-${n}`}
                    className={`w-11 h-11 border transition-colors ${people === n ? "bg-ink text-cream border-ink" : "border-ink/15 hover:border-brand"}`}>{n}</button>
                ))}
                <button onClick={() => setPeople(9)} className={`px-4 h-11 border transition-colors ${people >= 9 ? "bg-ink text-cream border-ink" : "border-ink/15 hover:border-brand"}`}>9+</button>
              </div>
            </div>

            <div><Label className="text-xs tracking-widest uppercase">Prénom *</Label>
              <Input value={form.first_name} onChange={(e) => setForm({...form, first_name: e.target.value})} data-testid="res-first-name"
                className="bg-transparent border-ink/20 rounded-none focus-visible:ring-brand mt-1.5" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs tracking-widest uppercase">Téléphone *</Label>
                <Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} data-testid="res-phone"
                  className="bg-transparent border-ink/20 rounded-none focus-visible:ring-brand mt-1.5" /></div>
              <div><Label className="text-xs tracking-widest uppercase">Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} data-testid="res-email"
                  className="bg-transparent border-ink/20 rounded-none focus-visible:ring-brand mt-1.5" /></div>
            </div>
            <div>
              <Label className="text-xs tracking-widest uppercase">Commentaire (optionnel)</Label>
              <Textarea value={form.comment} onChange={(e) => setForm({...form, comment: e.target.value})} rows={3} data-testid="res-comment"
                className="bg-transparent border-ink/20 rounded-none focus-visible:ring-brand mt-1.5 resize-none" />
            </div>
            {/* Honeypot */}
            <input type="text" name="website" value={form.honeypot} onChange={(e) => setForm({...form, honeypot: e.target.value})}
              style={{ position: "absolute", left: "-9999px", opacity: 0 }} tabIndex={-1} autoComplete="off" aria-hidden />

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button onClick={submit} disabled={loading} data-testid="submit-reservation-btn"
              className="w-full bg-brand hover:bg-brand-hover text-cream rounded-none tracking-widest uppercase h-12">
              {loading ? "Envoi…" : "Réserver ma table"}
            </Button>
          </div>
        </div>
      </section>
    </PageTransition>
  );
}
