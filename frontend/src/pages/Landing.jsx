import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, Phone, Clock, UtensilsCrossed, Wine, Wheat } from "lucide-react";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import PageTransition from "@/components/PageTransition";

const LOGO = "https://customer-assets.emergentagent.com/job_pizzeria-app-26/artifacts/jwci5np5_LOgo%20angelucci.png";
const HERO_BG = "https://images.pexels.com/photos/14882031/pexels-photo-14882031.jpeg";
const STORY_IMG = "https://images.unsplash.com/photo-1607727536244-b3ab855fb209?crop=entropy&cs=srgb&fm=jpg&w=1600&q=80";
const PASTA = "https://images.pexels.com/photos/36445107/pexels-photo-36445107.jpeg";
const OIL = "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=1600&q=80";

const fadeUp = { initial: { opacity: 0, y: 40 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } };

export default function Landing() {
  const [settings, setSettings] = useState({});
  const [featured, setFeatured] = useState([]);
  useEffect(() => {
    api.get("/settings").then((r) => setSettings(r.data)).catch(() => {});
    api.get("/products", { params: { menu_type: "restaurant" } }).then((r) => setFeatured(r.data.slice(0, 3))).catch(() => {});
  }, []);

  return (
    <PageTransition>
      {/* HERO */}
      <section className="relative h-screen min-h-[720px] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO_BG} alt="" className="absolute inset-0 w-full h-full object-cover animate-ken" />
          <div className="absolute inset-0 bg-ink/55" />
        </div>
        <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-10 w-full grid lg:grid-cols-12 gap-8 items-end pb-24 pt-32">
          <div className="lg:col-span-8 text-cream">
            <motion.p {...fadeUp} className="text-xs tracking-[.4em] uppercase text-brand mb-8">
              Farmacia Angelucci — Lausanne
            </motion.p>
            <motion.h1 {...fadeUp} transition={{ delay: 0.15, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-6xl sm:text-7xl lg:text-8xl leading-[.95] mb-8">
              Angelucci's
            </motion.h1>
            <motion.p {...fadeUp} transition={{ delay: 0.3, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="font-italic-display text-2xl sm:text-3xl text-brand mb-10 max-w-2xl">
              la qualità a discapito della quantità
            </motion.p>
            <motion.div {...fadeUp} transition={{ delay: 0.45, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-wrap gap-4">
              <Link to="/commander" data-testid="hero-cta-order"
                className="group inline-flex items-center gap-3 bg-brand hover:bg-brand-hover text-cream px-8 py-4 text-sm tracking-widest uppercase transition-colors">
                Commander <ArrowRight size={18} strokeWidth={1.5} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to="/reserver" data-testid="hero-cta-book"
                className="inline-flex items-center gap-3 border border-cream text-cream hover:bg-cream hover:text-ink px-8 py-4 text-sm tracking-widest uppercase transition-colors">
                Réserver une table
              </Link>
            </motion.div>
          </div>
          <motion.div {...fadeUp} transition={{ delay: 0.6, duration: 1.1 }}
            className="lg:col-span-4 hidden lg:flex justify-end">
            <img src={LOGO} alt="Angelucci's" className="w-64 h-64 object-contain opacity-95 drop-shadow-2xl" />
          </motion.div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="bg-ink text-cream/70 py-4 overflow-hidden border-y border-cream/10">
        <div className="flex whitespace-nowrap animate-marquee">
          {[...Array(2)].flatMap((_, i) => ["PARMIGIANO 24 mois", "TAGLIATELLES fraîches", "HUILE d'olive Toscane", "MOZZARELLA di bufala", "SALUMI artigianali", "VINI italiani"]).map((t, i) => (
            <span key={i} className="mx-10 font-italic-display text-2xl">— {t}</span>
          ))}
        </div>
      </div>

      {/* NOTRE HISTOIRE */}
      <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-24 md:py-32 grid lg:grid-cols-12 gap-12 items-center">
        <motion.div {...fadeUp} className="lg:col-span-6 relative">
          <img src={STORY_IMG} alt="Campagne italienne" className="w-full aspect-[4/5] object-cover" />
          <div className="absolute -bottom-6 -right-6 bg-brand text-cream px-8 py-6 hidden md:block">
            <p className="font-display text-4xl leading-none">1962</p>
            <p className="text-xs tracking-widest uppercase mt-1">Slow food dal cuore</p>
          </div>
        </motion.div>
        <motion.div {...fadeUp} transition={{ delay: 0.2, duration: 0.9 }} className="lg:col-span-6">
          <p className="text-xs tracking-[.4em] uppercase text-brand mb-6">Notre histoire</p>
          <h2 className="font-display text-4xl md:text-5xl mb-8 leading-tight">
            Redécouvrir les saveurs oubliées de l'Italie.
          </h2>
          <p className="text-muted2 leading-relaxed mb-6">
            Nous recherchons les petits producteurs qui travaillent dans l'esprit du mouvement
            <em className="font-italic-display text-ink"> Slow Food® </em> — souvent d'une nouvelle génération
            qui retrouve les techniques de production de leurs parents.
          </p>
          <p className="text-muted2 leading-relaxed mb-8">
            Une partie de nos fromages est encore affinée chez nous. Toutes nos pâtes sont fraîches,
            et une grande partie est faite par nos soins avec des produits de saison.
          </p>
          <Link to="/histoire" data-testid="story-link"
            className="inline-flex items-center gap-3 text-ink border-b border-ink pb-1 hover:text-brand hover:border-brand transition-colors text-sm tracking-widest uppercase">
            Lire la suite <ArrowRight size={16} strokeWidth={1.5} />
          </Link>
        </motion.div>
      </section>

      {/* PLATS PHARES */}
      <section className="bg-cream-surface py-24 md:py-32">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10">
          <motion.div {...fadeUp} className="flex items-end justify-between mb-12 flex-wrap gap-6">
            <div>
              <p className="text-xs tracking-[.4em] uppercase text-brand mb-4">Nos incontournables</p>
              <h2 className="font-display text-4xl md:text-5xl leading-tight">Les plats phares</h2>
            </div>
            <Link to="/commander" className="link-underline text-sm tracking-widest uppercase">Voir toute la carte →</Link>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {(featured.length > 0 ? featured : [
              { id: "1", name: "Tagliatelles al ragù", description: "Pâtes maison, ragù mijoté 6h", price: 26.5, image_url: PASTA },
              { id: "2", name: "Parmigiano 24 mois", description: "Affiné DOP Émilie-Romagne", price: 18.9, image_url: OIL },
              { id: "3", name: "Olio Extra Vergine", description: "Toscane, cueillette 2024", price: 22, image_url: OIL },
            ]).map((p, i) => (
              <motion.div key={p.id} {...fadeUp} transition={{ delay: 0.1 * i, duration: 0.9 }}
                className="group bg-cream border border-ink/5 hover:border-brand/30 transition-all overflow-hidden">
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={p.image_url || PASTA} alt={p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                </div>
                <div className="p-6">
                  <h3 className="font-display text-2xl mb-2">{p.name}</h3>
                  <p className="text-sm text-muted2 mb-4 line-clamp-2">{p.description}</p>
                  <p className="text-brand font-medium">CHF {Number(p.price).toFixed(2)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIES DUAL */}
      <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-24 md:py-32 grid md:grid-cols-2 gap-6">
        {[
          { to: "/commander", label: "Le Restaurant", desc: "Trattoria italienne. Cuisine du marché. À emporter ou en livraison.", img: PASTA, icon: UtensilsCrossed },
          { to: "/epicerie", label: "L'Épicerie", desc: "Produits d'exception, sélectionnés en Italie. Commandez jusqu'à 2 semaines à l'avance.", img: OIL, icon: Wheat },
        ].map((c) => (
          <Link key={c.to} to={c.to} data-testid={`landing-${c.to.replace("/", "")}`}
            className="group relative h-[420px] md:h-[540px] overflow-hidden">
            <img src={c.img} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1200ms] ease-out" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-end p-10 text-cream">
              <c.icon size={40} strokeWidth={1.2} className="mb-6 text-brand" />
              <h3 className="font-display text-5xl md:text-6xl mb-4">{c.label}</h3>
              <p className="text-cream/85 mb-6 max-w-md">{c.desc}</p>
              <span className="inline-flex items-center gap-3 text-sm tracking-widest uppercase group-hover:gap-5 transition-all">
                Découvrir <ArrowRight size={16} strokeWidth={1.5} />
              </span>
            </div>
          </Link>
        ))}
      </section>

      {/* INFOS */}
      <section className="bg-ink text-cream py-24">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 grid md:grid-cols-3 gap-10">
          {[
            { icon: MapPin, title: "Adresse", value: settings.address || "Av. William-Fraisse 1, 1006 Lausanne" },
            { icon: Phone, title: "Téléphone", value: settings.phone || "079 706 39 66", href: `tel:${(settings.phone || "").replace(/\s/g, "")}` },
            { icon: Clock, title: "Ouverture", value: "Mar–Ven 11h30 · Sam 18h30" },
          ].map((c, i) => (
            <motion.div key={i} {...fadeUp} transition={{ delay: 0.1 * i, duration: 0.8 }}
              className="border-l border-brand pl-6">
              <c.icon size={22} strokeWidth={1.5} className="mb-4 text-brand" />
              <p className="text-xs tracking-[.3em] uppercase text-cream/60 mb-2">{c.title}</p>
              {c.href ? (
                <a href={c.href} className="font-display text-2xl link-underline">{c.value}</a>
              ) : (
                <p className="font-display text-2xl">{c.value}</p>
              )}
            </motion.div>
          ))}
        </div>
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 mt-12">
          <div className="aspect-[16/6] w-full overflow-hidden border border-cream/10">
            <iframe title="Map" width="100%" height="100%" style={{ border: 0, filter: "grayscale(1) contrast(1.05) brightness(.9)" }}
              src={`https://www.google.com/maps?q=${encodeURIComponent(settings.address || "Av. William-Fraisse 1, 1006 Lausanne")}&output=embed`}
              loading="lazy" />
          </div>
        </div>
      </section>
    </PageTransition>
  );
}
