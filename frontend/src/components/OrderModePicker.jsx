import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Package, Truck, AlertTriangle, ChevronRight, Check } from "lucide-react";
import api from "@/lib/api";

const dayLabel = (date, todayStr) => {
  const iso = date.toISOString().split("T")[0];
  if (iso === todayStr) return "Aujourd'hui";
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  if (iso === tomorrow.toISOString().split("T")[0]) return "Demain";
  return date.toLocaleDateString("fr-CH", { weekday: "short", day: "numeric", month: "short" });
};

// Generate 15-min time slots from HH:MM to HH:MM
function genSlots(startH, endH) {
  const arr = [];
  for (let h = startH; h <= endH; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === endH && m > 0) break;
      arr.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return arr;
}

export default function OrderModePicker({ open, onOpenChange, menuType, schedule, onConfirm }) {
  const [type, setType] = useState("takeaway");
  const [asap, setAsap] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [prepMinutes, setPrepMinutes] = useState(30);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/settings").then((r) => setPrepMinutes(r.data.preparation_time_minutes || 30)).catch(() => {});
  }, []);

  const isEpicerie = menuType === "epicerie";
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const tomorrowStr = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0];
  }, []);

  const daysAhead = isEpicerie ? 7 : 1;
  const availableDates = useMemo(() => {
    const arr = [];
    for (let i = 0; i <= daysAhead; i++) {
      const d = new Date(); d.setDate(d.getDate() + i); arr.push(d);
    }
    return arr;
  }, [daysAhead]);

  // Time slots: derive from schedule for selected day OR 11:00-22:00 default
  const timeSlots = useMemo(() => {
    if (!selectedDate) return [];
    const slots = genSlots(11, 22);
    // If today, only future slots (accounting for prep time)
    if (selectedDate.toISOString().split("T")[0] === todayStr) {
      const cutoff = new Date(now.getTime() + prepMinutes * 60 * 1000);
      return slots.filter((t) => {
        const [h, m] = t.split(":").map(Number);
        const slot = new Date(); slot.setHours(h, m, 0, 0);
        return slot >= cutoff;
      });
    }
    return slots;
  }, [selectedDate, todayStr, prepMinutes]);

  useEffect(() => {
    if (!asap && !selectedDate) setSelectedDate(availableDates[0]);
  }, [asap, selectedDate, availableDates]);

  const isTomorrow = !isEpicerie && !asap && selectedDate && selectedDate.toISOString().split("T")[0] === tomorrowStr;

  const confirm = () => {
    setError("");
    if (type === "delivery" && !/^\d{4}$/.test(postalCode.trim())) {
      setError("Code postal suisse à 4 chiffres requis pour la livraison.");
      return;
    }
    let pickup_time = "ASAP";
    let label = `Dès que possible (~${prepMinutes} min)`;
    if (!asap) {
      if (!selectedDate || !selectedTime) {
        setError("Merci de choisir un jour et une heure.");
        return;
      }
      const iso = selectedDate.toISOString().split("T")[0];
      pickup_time = `${iso}T${selectedTime}`;
      label = `${dayLabel(selectedDate, todayStr)} à ${selectedTime}`;
    }
    onConfirm({
      fulfillment_type: type,
      pickup_time,
      pickup_time_label: label,
      postal_code: type === "delivery" ? postalCode.trim() : "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg !bg-[#FDFBF7] border-ink/10 rounded-none max-h-[92vh] overflow-y-auto p-0" data-testid="mode-picker">
        <div className="p-7">
          <DialogTitle className="font-display text-3xl mb-1">Votre commande</DialogTitle>
          <DialogDescription className="text-muted2 text-sm">
            {isEpicerie ? "Choisissez comment et quand vous serez servi(e)." : "À emporter ou livraison — pour aujourd'hui ou demain."}
          </DialogDescription>

          {/* Mode */}
          <div className="grid grid-cols-2 gap-3 mt-6">
            <button onClick={() => setType("takeaway")} data-testid="mode-takeaway"
              className={`border p-4 flex flex-col items-center gap-2 transition-all ${type==="takeaway" ? "border-brand bg-brand/8 shadow-sm" : "border-ink/15 hover:border-brand"}`}>
              <Package size={22} strokeWidth={1.5} className={type==="takeaway" ? "text-brand" : "text-ink"} />
              <span className="text-[11px] tracking-[.2em] uppercase">À emporter</span>
            </button>
            <button onClick={() => setType("delivery")} data-testid="mode-delivery"
              className={`border p-4 flex flex-col items-center gap-2 transition-all ${type==="delivery" ? "border-brand bg-brand/8 shadow-sm" : "border-ink/15 hover:border-brand"}`}>
              <Truck size={22} strokeWidth={1.5} className={type==="delivery" ? "text-brand" : "text-ink"} />
              <span className="text-[11px] tracking-[.2em] uppercase">Livraison</span>
            </button>
          </div>

          {/* Postal code (delivery only) */}
          {type === "delivery" && (
            <div className="mt-4">
              <Label className="text-[11px] tracking-[.2em] uppercase">Code postal *</Label>
              <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, "").slice(0,4))}
                placeholder="1006" inputMode="numeric" data-testid="mode-postal-code"
                className="mt-2 !bg-transparent border-ink/20 rounded-none focus-visible:ring-brand" />
              <p className="mt-2 text-xs text-muted2">Livraison sur Lausanne et environs.</p>
            </div>
          )}

          {/* Créneau — Uber Eats-style */}
          <div className="mt-6">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setAsap(true)} data-testid="slot-asap"
                className={`border p-4 flex flex-col items-center gap-1 transition-all ${asap ? "border-brand bg-brand/8 shadow-sm" : "border-ink/15 hover:border-brand"}`}>
                <Clock size={20} strokeWidth={1.5} className={asap ? "text-brand" : "text-ink"} />
                <span className="text-[11px] tracking-[.2em] uppercase mt-1">Dès que possible</span>
                <span className="text-xs text-muted2">~{prepMinutes} min</span>
              </button>
              <button onClick={() => setAsap(false)} data-testid="slot-custom"
                className={`border p-4 flex flex-col items-center gap-1 transition-all ${!asap ? "border-brand bg-brand/8 shadow-sm" : "border-ink/15 hover:border-brand"}`}>
                <Clock size={20} strokeWidth={1.5} className={!asap ? "text-brand" : "text-ink"} />
                <span className="text-[11px] tracking-[.2em] uppercase mt-1">Programmer</span>
                <span className="text-xs text-muted2">{isEpicerie ? "Jusqu'à 7 jours" : "Aujourd'hui / Demain"}</span>
              </button>
            </div>

            {!asap && (
              <div className="mt-5 space-y-4">
                {/* Day chips */}
                <div>
                  <p className="text-[11px] tracking-[.2em] uppercase text-muted2 mb-2">Jour</p>
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                    {availableDates.map((d) => {
                      const iso = d.toISOString().split("T")[0];
                      const active = selectedDate && selectedDate.toISOString().split("T")[0] === iso;
                      return (
                        <button key={iso} onClick={() => { setSelectedDate(d); setSelectedTime(""); }} data-testid={`day-${iso}`}
                          className={`shrink-0 border px-4 py-2.5 min-w-[92px] text-center transition-all ${active ? "bg-ink text-cream border-ink" : "border-ink/15 hover:border-brand bg-cream"}`}>
                          <p className="text-[11px] tracking-[.15em] uppercase">{dayLabel(d, todayStr)}</p>
                          <p className={`text-[10px] mt-0.5 ${active ? "text-cream/70" : "text-muted2"}`}>{d.toLocaleDateString("fr-CH", { day: "numeric", month: "short" })}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time slots grid */}
                {selectedDate && (
                  <div>
                    <p className="text-[11px] tracking-[.2em] uppercase text-muted2 mb-2">Heure</p>
                    {timeSlots.length === 0 ? (
                      <p className="text-sm text-muted2 py-3">Plus de créneaux disponibles ce jour. Choisissez un autre jour.</p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1">
                        {timeSlots.map((t) => (
                          <button key={t} onClick={() => setSelectedTime(t)} data-testid={`time-${t}`}
                            className={`py-2.5 text-sm tracking-wide border transition-all ${selectedTime === t ? "bg-brand text-cream border-brand" : "border-ink/15 hover:border-brand bg-cream"}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {isTomorrow && (
                  <div className="flex gap-3 p-3 bg-ochre/10 border border-ochre/50 text-[13px]" data-testid="tomorrow-warning">
                    <AlertTriangle size={18} strokeWidth={1.5} className="text-ochre shrink-0 mt-0.5" />
                    <p>Vous commandez pour <strong>demain</strong>. Votre commande sera préparée le lendemain à l'heure indiquée.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-destructive text-sm mt-4">{error}</p>}

          <Button onClick={confirm} data-testid="confirm-mode-btn"
            className="mt-6 w-full bg-ink hover:bg-brand text-cream rounded-none tracking-[.2em] uppercase h-12 text-[12px]">
            Continuer <ChevronRight size={16} strokeWidth={1.5} className="ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
