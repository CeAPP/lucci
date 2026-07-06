import { useEffect, useState } from "react";
import PageTransition from "@/components/PageTransition";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import api from "@/lib/api";

const DAYS = [["mon","Lundi"],["tue","Mardi"],["wed","Mercredi"],["thu","Jeudi"],["fri","Vendredi"],["sat","Samedi"],["sun","Dimanche"]];

export default function Contact() {
  const [s, setS] = useState({});
  const [sched, setSched] = useState(null);
  useEffect(() => {
    api.get("/settings").then((r) => setS(r.data)).catch(() => {});
    api.get("/schedule/restaurant").then((r) => setSched(r.data)).catch(() => {});
  }, []);
  return (
    <PageTransition>
      <section className="pt-40 pb-24 max-w-5xl mx-auto px-6 md:px-10">
        <p className="text-xs tracking-[.4em] uppercase text-brand mb-6">Nous trouver</p>
        <h1 className="font-display text-5xl md:text-7xl mb-16">Contact</h1>
        <div className="grid md:grid-cols-2 gap-16 mb-16">
          <div className="space-y-8">
            <div>
              <MapPin size={22} strokeWidth={1.5} className="text-brand mb-3" />
              <p className="text-xs tracking-[.3em] uppercase text-muted2 mb-1">Adresse</p>
              <p className="font-display text-2xl">{s.address}</p>
            </div>
            <div>
              <Phone size={22} strokeWidth={1.5} className="text-brand mb-3" />
              <p className="text-xs tracking-[.3em] uppercase text-muted2 mb-1">Téléphone</p>
              <a href={`tel:${(s.phone||"").replace(/\s/g,"")}`} data-testid="contact-phone" className="font-display text-2xl link-underline">{s.phone}</a>
            </div>
            <div>
              <Mail size={22} strokeWidth={1.5} className="text-brand mb-3" />
              <p className="text-xs tracking-[.3em] uppercase text-muted2 mb-1">Email</p>
              <a href={`mailto:${s.email}`} className="font-display text-2xl link-underline">{s.email}</a>
            </div>
          </div>
          <div>
            <Clock size={22} strokeWidth={1.5} className="text-brand mb-3" />
            <p className="text-xs tracking-[.3em] uppercase text-muted2 mb-4">Horaires du restaurant</p>
            <ul className="space-y-2 text-lg">
              {sched && DAYS.map(([k,l]) => {
                const d = sched.days?.[k] || {};
                const parts = [];
                if (d.lunch_start) parts.push(`${d.lunch_start} – ${d.lunch_end}`);
                if (d.dinner_start) parts.push(`${d.dinner_start} – ${d.dinner_end}`);
                return (
                  <li key={k} className="flex justify-between border-b border-ink/5 py-2">
                    <span>{l}</span>
                    <span className="text-muted2">{d.closed ? "Fermé" : (parts.join(" · ") || "—")}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <div className="aspect-[16/6] w-full overflow-hidden border border-ink/10">
          <iframe title="Map" width="100%" height="100%" style={{ border: 0 }}
            src={`https://www.google.com/maps?q=${encodeURIComponent(s.address || "Av. William-Fraisse 1, 1006 Lausanne")}&output=embed`}
            loading="lazy" />
        </div>
      </section>
    </PageTransition>
  );
}
