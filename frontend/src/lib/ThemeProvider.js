import { useEffect } from "react";
import api from "@/lib/api";

const FONT_URLS = {
  "Cormorant Garamond": "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300..700;1,300..700&display=swap",
  "Playfair Display":   "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap",
  "DM Serif Display":   "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap",
  "Libre Bodoni":       "https://fonts.googleapis.com/css2?family=Libre+Bodoni:ital,wght@0,400..700;1,400..700&display=swap",
  "Fraunces":           "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&display=swap",
  "Manrope":            "https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap",
  "Inter":              "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap",
  "Karla":              "https://fonts.googleapis.com/css2?family=Karla:ital,wght@0,200..800;1,200..800&display=swap",
  "Work Sans":          "https://fonts.googleapis.com/css2?family=Work+Sans:ital,wght@0,100..900;1,100..900&display=swap",
};

export const FONT_DISPLAY_CHOICES = ["Cormorant Garamond", "Playfair Display", "DM Serif Display", "Libre Bodoni", "Fraunces"];
export const FONT_BODY_CHOICES = ["Manrope", "Inter", "Karla", "Work Sans"];

function darkenHex(hex, pct = 10) {
  const clean = (hex || "").replace("#", "");
  if (clean.length !== 6) return hex;
  const r = Math.max(0, Math.floor(parseInt(clean.slice(0, 2), 16) * (1 - pct / 100)));
  const g = Math.max(0, Math.floor(parseInt(clean.slice(2, 4), 16) * (1 - pct / 100)));
  const b = Math.max(0, Math.floor(parseInt(clean.slice(4, 6), 16) * (1 - pct / 100)));
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function injectFontLink(family) {
  if (!family || !FONT_URLS[family]) return;
  const id = `font-link-${family.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = FONT_URLS[family];
  document.head.appendChild(link);
}

/**
 * Applies the current site theme (primary color + fonts) to CSS variables on <html>.
 * Runs once on app mount and re-runs whenever the theme is updated in Admin.
 */
export default function ThemeProvider({ children }) {
  useEffect(() => {
    const apply = (t) => {
      if (!t) return;
      const root = document.documentElement;
      if (t.primary) {
        root.style.setProperty("--brand", t.primary);
        // Derive a slightly darker hover shade
        root.style.setProperty("--brand-hover", darkenHex(t.primary, 10));
      }
      if (t.font_display) {
        injectFontLink(t.font_display);
        root.style.setProperty("--font-display", `"${t.font_display}", serif`);
      }
      if (t.font_body) {
        injectFontLink(t.font_body);
        root.style.setProperty("--font-body", `"${t.font_body}", sans-serif`);
      }
    };
    // Bootstrap with a cached value first for instant paint, then refresh from backend
    try {
      const cached = JSON.parse(localStorage.getItem("angel_theme") || "null");
      if (cached) apply(cached);
    } catch {}
    api.get("/theme").then((r) => {
      apply(r.data);
      try { localStorage.setItem("angel_theme", JSON.stringify(r.data)); } catch {}
    }).catch(() => {});
  }, []);
  return children;
}
