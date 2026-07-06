import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Clock, Package, Truck } from "lucide-react";

export default function OrderModePicker({ open, onOpenChange, menuType, schedule, onConfirm }) {
  const [type, setType] = useState("takeaway");
  const [asap, setAsap] = useState(true);
  const [customTime, setCustomTime] = useState("");
  const [customDate, setCustomDate] = useState("");

  const isEpicerie = menuType === "epicerie";
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + (isEpicerie ? 14 : 1));
    return d.toISOString().split("T")[0];
  }, [isEpicerie]);
  const todayStr = new Date().toISOString().split("T")[0];

  const confirm = () => {
    let pickup_time = "ASAP";
    let label = "Dès que possible";
    if (!asap && customTime) {
      const dt = customDate || todayStr;
      pickup_time = `${dt}T${customTime}`;
      label = `${dt} à ${customTime}`;
    }
    onConfirm({ fulfillment_type: type, pickup_time, pickup_time_label: label });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-cream border-ink/10 rounded-none" data-testid="mode-picker">
        <DialogTitle className="font-display text-3xl">Comment souhaitez-vous commander&nbsp;?</DialogTitle>
        <DialogDescription className="text-muted2">
          {isEpicerie ? "Vous pouvez commander jusqu'à 2 semaines à l'avance." : "Choisissez votre mode et votre créneau."}
        </DialogDescription>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <button onClick={() => setType("takeaway")} data-testid="mode-takeaway"
            className={`border p-4 flex flex-col items-center gap-2 transition-colors ${type==="takeaway" ? "border-brand bg-cream-surface" : "border-ink/20 hover:border-brand"}`}>
            <Package size={22} strokeWidth={1.5} className="text-brand" />
            <span className="text-sm tracking-widest uppercase">À emporter</span>
          </button>
          <button onClick={() => setType("delivery")} data-testid="mode-delivery"
            className={`border p-4 flex flex-col items-center gap-2 transition-colors ${type==="delivery" ? "border-brand bg-cream-surface" : "border-ink/20 hover:border-brand"}`}>
            <Truck size={22} strokeWidth={1.5} className="text-brand" />
            <span className="text-sm tracking-widest uppercase">Livraison</span>
          </button>
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-xs tracking-[.25em] uppercase">Créneau</p>
          <RadioGroup value={asap ? "asap" : "custom"} onValueChange={(v) => setAsap(v==="asap")}>
            <label className="flex items-center gap-3 border border-ink/10 p-3 cursor-pointer hover:border-brand transition-colors">
              <RadioGroupItem value="asap" data-testid="slot-asap" />
              <Clock size={16} strokeWidth={1.5} /> Dès que possible
            </label>
            <label className="flex items-center gap-3 border border-ink/10 p-3 cursor-pointer hover:border-brand transition-colors">
              <RadioGroupItem value="custom" data-testid="slot-custom" />
              <span>Heure précise</span>
            </label>
          </RadioGroup>
          {!asap && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              {isEpicerie && (
                <Input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)}
                  min={todayStr} max={maxDate} data-testid="slot-date"
                  className="bg-transparent border-ink/20 rounded-none" />
              )}
              <Input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)}
                data-testid="slot-time"
                className="bg-transparent border-ink/20 rounded-none" />
            </div>
          )}
        </div>

        <Button onClick={confirm} data-testid="confirm-mode-btn"
          className="mt-6 bg-brand hover:bg-brand-hover text-cream rounded-none tracking-widest uppercase h-12">
          Continuer
        </Button>
      </DialogContent>
    </Dialog>
  );
}
