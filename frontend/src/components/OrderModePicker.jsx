import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Package, AlertTriangle, ChevronRight, CalendarDays } from "lucide-react";
import api from "@/lib/api";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const dayLabel = (date, todayStr) => {
  const iso = date.toISOString().split("T")[0];
  if (iso === todayStr) return "Aujourd'hui";
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  if (iso === tomorrow.toISOString().split("T")[0]) return "Demain";
  return date.toLocaleDateString("fr-CH", { weekday: "short", day: "numeric", month: "short" });
};

// Return 10-min slots for a given date, based on the schedule days (lunch + dinner windows)
function slotsForDay(schedule, date, prepMinutes) {
  if (!schedule) return [];
  const dk = DAY_KEYS[date.getDay()];
  const d = schedule.days?.[dk];
  if (!d || d.closed) return [];
  const slots = [];
  const push = (start, end) => {
    if (!start || !end) return;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    for (let t = startMin; t <= endMin; t += 10) {
      const h = Math.floor(t / 60);
      const m = t % 60;
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  };
  push(d.lunch_start, d.lunch_end);
  push(d.dinner_start, d.dinner_end);

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  if (date.toISOString().split("T")[0] === todayStr) {
    const cutoff = now.getTime() + prepMinutes * 60 * 1000;
    return slots.filter((t) => {
      const [h, m] = t.split(":").map(Number);
      const slot = new Date(); slot.setHours(h, m, 0, 0);
      return slot.getTime() >= cutoff;
    });
  }
  return slots;
}

export default function OrderModePicker({ open, onOpenChange, menuType, schedule, onConfirm }) {
  const [showLater, setShowLater] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [prepMinutes, setPrepMinutes] = useState(30);
  const [daysAhead, setDaysAhead] = useState(menuType === "epicerie" ? 7 : 1);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/settings").then((r) => {
      setPrepMinutes(r.data.preparation_time_minutes || 30);
      if (menuType === "epicerie") setDaysAhead(r.data.epicerie_days_ahead || 7);
      else setDaysAhead(1);
    }).catch(() => {});
  }, [menuType]);

  const isEpicerie = menuType === "epicerie";
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const today = useMemo(() => new Date(), []);

  const todaySlots = useMemo(
    () => slotsForDay(schedule, today, prepMinutes),
    [schedule, today, prepMinutes]
  );

  const futureDates = useMemo(() => {
    const arr = [];
    for (let i = 1; i <= daysAhead; i++) {
      const d = new Date(); d.setDate(d.getDate() + i); arr.push(d);
    }
    return arr;
  }, [daysAhead]);

  const futureSlots = useMemo(() => {
    if (!selectedDate) return [];
    return slotsForDay(schedule, selectedDate, prepMinutes);
  }, [schedule, selectedDate, prepMinutes]);

  useEffect(() => {
    if (showLater && !selectedDate && futureDates.length > 0) setSelectedDate(futureDates[0]);
  }, [showLater, selectedDate, futureDates]);

  const confirmASAP = () => {
    setError("");
    const dt = new Date(now.getTime() + prepMinutes * 60 * 1000);
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    onConfirm({
      fulfillment_type: "takeaway",
      pickup_time: "ASAP",
      pickup_time_label: `Dès que possible (~${hh}:${mm})`,
      postal_code: "",
    });
  };

  const confirmSlot = (dateObj, time) => {
    setError("");
    const iso = dateObj.toISOString().split("T")[0];
    const isToday = iso === todayStr;
    const label = isToday
      ? `Aujourd'hui à ${time}`
      : `${dayLabel(dateObj, todayStr)} à ${time}`;
    onConfirm({
      fulfillment_type: "takeaway",
      pickup_time: `${iso}T${time}`,
      pickup_time_label: label,
      postal_code: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="!bg-[#FDFBF7] border-ink/10 rounded-none w-[calc(100vw-1rem)] max-w-md sm:max-w-lg max-h-[calc(100dvh-1rem)] overflow-y-auto p-0"
        data-testid="mode-picker"
      >
        <div className="p-4 sm:p-7">
          <DialogTitle className="font-display text-xl sm:text-3xl mb-0.5 sm:mb-1">Votre commande</DialogTitle>
          <DialogDescription className="text-muted2 text-xs sm:text-sm">
            {isEpicerie ? "À emporter — jusqu'à " + daysAhead + " jours à l'avance." : "À emporter — pour aujourd'hui ou plus tard."}
          </DialogDescription>

          {/* Fulfillment info — takeaway only */}
          <div className="mt-3 sm:mt-4 border border-brand bg-brand/8 px-2.5 py-2 sm:p-3 flex items-center gap-2.5 sm:gap-3">
            <Package size={16} strokeWidth={1.5} className="text-brand shrink-0 sm:hidden" />
            <Package size={20} strokeWidth={1.5} className="text-brand shrink-0 hidden sm:block" />
            <div>
              <p className="text-[10px] sm:text-[11px] tracking-[.2em] uppercase text-brand">À emporter</p>
              <p className="text-[11px] sm:text-sm text-muted2 leading-tight">Retrait — Av. William-Fraisse 1, Lausanne</p>
            </div>
          </div>

          {/* ASAP — big primary */}
          <button
            onClick={confirmASAP}
            data-testid="slot-asap"
            className="mt-3 sm:mt-5 w-full border-2 border-brand bg-brand hover:bg-brand-hover text-cream px-3 py-3 sm:p-4 flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-2.5 sm:gap-3">
              <Clock size={20} strokeWidth={1.5} />
              <div className="text-left">
                <p className="text-[10px] sm:text-[11px] tracking-[.2em] uppercase">Dès que possible</p>
                <p className="text-[11px] sm:text-xs opacity-90">Prêt en ~{prepMinutes} min</p>
              </div>
            </div>
            <ChevronRight size={18} strokeWidth={1.5} />
          </button>

          {/* Today's slots */}
          <div className="mt-4 sm:mt-6">
            <div className="flex items-baseline gap-3 mb-2">
              <p className="text-[10px] sm:text-[11px] tracking-[.2em] uppercase text-muted2">Aujourd&apos;hui</p>
              <span className="text-[10px] text-muted2">tranche de 10 min</span>
            </div>
            {todaySlots.length === 0 ? (
              <p className="text-xs sm:text-sm text-muted2 py-2 sm:py-3">
                Aucun créneau disponible aujourd&apos;hui. Utilisez « Programmer plus tard » →
              </p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-32 sm:max-h-40 overflow-y-auto p-0.5">
                {todaySlots.map((t) => (
                  <button
                    key={t}
                    onClick={() => confirmSlot(today, t)}
                    data-testid={`today-time-${t}`}
                    className="py-1.5 sm:py-2 text-xs sm:text-sm tracking-wide border border-ink/15 hover:border-brand hover:bg-brand/8 bg-cream transition-all"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Programmer plus tard */}
          <div className="mt-4 sm:mt-6">
            <button
              onClick={() => setShowLater((v) => !v)}
              data-testid="btn-later"
              className={`w-full border px-3 py-2.5 sm:p-3 flex items-center justify-between transition-all ${
                showLater ? "border-ink bg-ink/5" : "border-ink/20 hover:border-brand"
              }`}
            >
              <div className="flex items-center gap-2.5 sm:gap-3">
                <CalendarDays size={16} strokeWidth={1.5} className="sm:hidden" />
                <CalendarDays size={18} strokeWidth={1.5} className="hidden sm:block" />
                <div className="text-left">
                  <p className="text-[10px] sm:text-[11px] tracking-[.2em] uppercase">Programmer plus tard</p>
                  <p className="text-[11px] sm:text-xs text-muted2">
                    {isEpicerie ? `Jusqu'à ${daysAhead} jours` : "Demain"}
                  </p>
                </div>
              </div>
              <ChevronRight
                size={16}
                strokeWidth={1.5}
                className={`transition-transform ${showLater ? "rotate-90" : ""}`}
              />
            </button>

            {showLater && (
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-[11px] tracking-[.2em] uppercase text-muted2 mb-2">Jour</p>
                  <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
                    {futureDates.map((d) => {
                      const iso = d.toISOString().split("T")[0];
                      const active = selectedDate && selectedDate.toISOString().split("T")[0] === iso;
                      return (
                        <button
                          key={iso}
                          onClick={() => { setSelectedDate(d); setSelectedTime(""); }}
                          data-testid={`day-${iso}`}
                          className={`shrink-0 border px-3 py-2 min-w-[80px] text-center transition-all ${
                            active ? "bg-ink text-cream border-ink" : "border-ink/15 hover:border-brand bg-cream"
                          }`}
                        >
                          <p className="text-[10px] tracking-[.15em] uppercase">{dayLabel(d, todayStr)}</p>
                          <p className={`text-[10px] mt-0.5 ${active ? "text-cream/70" : "text-muted2"}`}>
                            {d.toLocaleDateString("fr-CH", { day: "numeric", month: "short" })}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedDate && (
                  <div>
                    <p className="text-[11px] tracking-[.2em] uppercase text-muted2 mb-2">Heure — tranche de 10 min</p>
                    {futureSlots.length === 0 ? (
                      <p className="text-sm text-muted2 py-3">Fermé ce jour.</p>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-44 overflow-y-auto p-0.5">
                        {futureSlots.map((t) => (
                          <button
                            key={t}
                            onClick={() => setSelectedTime(t)}
                            data-testid={`time-${t}`}
                            className={`py-2 text-sm tracking-wide border transition-all ${
                              selectedTime === t
                                ? "bg-brand text-cream border-brand"
                                : "border-ink/15 hover:border-brand bg-cream"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedDate && selectedTime && (
                  <Button
                    onClick={() => confirmSlot(selectedDate, selectedTime)}
                    data-testid="confirm-scheduled-btn"
                    className="w-full bg-ink hover:bg-brand text-cream rounded-none tracking-[.2em] uppercase h-11 text-[12px]"
                  >
                    Confirmer · {dayLabel(selectedDate, todayStr)} à {selectedTime}
                    <ChevronRight size={16} strokeWidth={1.5} className="ml-1" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="flex gap-2 mt-4 p-3 bg-destructive/10 border border-destructive text-sm">
              <AlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
