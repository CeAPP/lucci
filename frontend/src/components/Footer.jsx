import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, ShoppingBag, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useCart } from "@/context/CartContext";

export default function Footer() {
  const [settings, setSettings] = useState({});
  const { countFor } = useCart();
  const totalCount = countFor("restaurant") + countFor("epicerie");

  useEffect(() => {
    api.get("/settings").then((r) => setSettings(r.data)).catch(() => {});
  }, []);

  return (
    <footer className="bg-ink text-cream mt-24" data-testid="site-footer">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-20 grid grid-cols-1 md:grid-cols-3 gap-10">
        <div>
          <h3 className="font-display text-3xl mb-4">ANGELUCCI'S</h3>
          <p className="font-italic-display text-brand text-lg">
            la qualità a discapito della quantità
          </p>
          <p className="text-xs text-cream/60 mt-3 tracking-widest uppercase">Farmacia Angelucci</p>

          <Link to="/panier" data-testid="footer-commander"
            className="mt-8 inline-flex items-center gap-3 bg-brand hover:bg-brand-hover text-cream px-6 py-3 text-[12px] tracking-[.2em] uppercase transition-colors">
            <ShoppingBag size={16} strokeWidth={1.5} />
            Commander
            {totalCount > 0 && (
              <span className="ml-1 bg-cream text-ink w-6 h-6 flex items-center justify-center text-xs">{totalCount}</span>
            )}
            <ArrowRight size={14} strokeWidth={1.5} />
          </Link>
        </div>

        <div>
          <h4 className="text-xs tracking-[.25em] uppercase text-brand mb-4">Contact</h4>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <MapPin size={16} strokeWidth={1.5} className="mt-1 shrink-0" />
              <span>{settings.address || "Av. William-Fraisse 1, 1006 Lausanne"}</span>
            </li>
            <li className="flex items-center gap-3">
              <Phone size={16} strokeWidth={1.5} />
              <a href={`tel:${(settings.phone || "").replace(/\s/g, "")}`} className="link-underline" data-testid="footer-phone">
                {settings.phone || "+41 79 706 39 66"}
              </a>
            </li>
            <li className="flex items-center gap-3">
              <Mail size={16} strokeWidth={1.5} />
              <a href={`mailto:${settings.email || "info@angeluccis.ch"}`} className="link-underline" data-testid="footer-email">
                {settings.email || "info@angeluccis.ch"}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs tracking-[.25em] uppercase text-brand mb-4">Naviguer</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/commander" className="link-underline">Commander (Restaurant)</Link></li>
            <li><Link to="/epicerie" className="link-underline">Commander (Épicerie)</Link></li>
            <li><Link to="/reserver" className="link-underline">Réserver une table</Link></li>
            <li><Link to="/histoire" className="link-underline">Notre histoire</Link></li>
            <li><Link to="/contact" className="link-underline">Contact</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-cream/10 py-6 text-center text-xs text-cream/50 tracking-wider">
        © {new Date().getFullYear()} Farmacia Angelucci — Lausanne
      </div>
    </footer>
  );
}
