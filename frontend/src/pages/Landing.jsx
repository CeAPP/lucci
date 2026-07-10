import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, Phone, UtensilsCrossed, Wheat, Star } from "lucide-react";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import PageTransition from "@/components/PageTransition";

const LOGO = "https://customer-assets.emergentagent.com/job_pizzeria-app-26/artifacts/jwci5np5_LOgo%20angelucci.png";
const IMG_SALUMI = "https://customer-assets.emergentagent.com/job_pizzeria-app-26/artifacts/2bxoyh8v_83ba60_aaf2ebed5765489092cda7f558fbd580~mv2.webp";
const IMG_PASTA_SHORT = "https://customer-assets.emergentagent.com/job_pizzeria-app-26/artifacts/clk9ihj6_e4e1e2_be9fb9ff6dd54b818165777026f6163b~mv2.webp";
const IMG_TAGLIATELLE = "https://customer-assets.emergentagent.com/job_pizzeria-app-26/artifacts/mdig6gfa_83ba60_4ae71658c54c4b7584ca0eb8b52df7bd~mv2.avif";

const fadeUp = { initial: { opacity: 0, y: 30 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } };

export default function Landing() {
  const [settings, setSettings] = useState({});
  const [featured, setFeatured] = useState([]);
  useEffect(() => {
    api.get("/settings").then((r) => setSettings(r.data)).catch(() => {});
    api.get("/products", { params: { menu_type: "restaurant" } }).then((r) => setFeatured(r.data.slice(0, 3))).catch(() => {});
  }, []);

  return (
    <PageTransition>
      {/* HERO — editorial, no stock resto images */}
      <section className="relative pt-28 lg:pt-32 pb-12 lg:pb-20 lg:min-h-[calc(100vh-2rem)] flex items-center overflow-hidden bg-cream">
        {/* Desktop-only decorative right side */}
        <div className="hidden lg:block absolute right-0 top-0 bottom-0 w-[52%] bg-cream-surface" />
        <div className="hidden lg:block absolute right-0 top-24 bottom-24 w-[48%] overflow-hidden">
          <img src={IMG_SALUMI} alt="Salumi artigianali" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-terracotta/15 mix-blend-multiply" />
        </div>
        <div className="hidden lg:block absolute right-[45%] top-1/2 -translate-y-1/2 w-28 h-28 bg-terracotta z-10" />

        <div className="relative z-20 max-w-[1400px] mx-auto px-6 md:px-10 w-full grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6">
            {/* Mobile logo top */}
            <div className="lg:hidden flex justify-center mb-6">
              <img src={LOGO} alt="Angelucci's" className="w-28 h-28 object-contain" />
            </div>

            <div className="flex items-center gap-4 mb-6 lg:mb-8 justify-center lg:justify-start">
              <span className="w-8 lg:w-12 h-px bg-terracotta" />
              <p className="text-[10px] lg:text-[11px] tracking-[.35em] lg:tracking-[.4em] uppercase text-terracotta">Farmacia Angelucci</p>
            </div>

            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-5xl sm:text-7xl lg:text-[7.5rem] leading-[.9] mb-4 lg:mb-6 text-ink text-center lg:text-left">
              Angelucci&apos;s<span className="text-terracotta">.</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.9 }}
              className="font-italic-display text-xl sm:text-3xl text-brand mb-8 lg:mb-10 max-w-xl text-center lg:text-left mx-auto lg:mx-0">
              la qualità a discapito della quantità
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.9 }}
              className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center lg:justify-start">
              <Link to="/commander" data-testid="hero-cta-order"
                className="group inline-flex items-center justify-center gap-3 bg-ink hover:bg-terracotta text-cream px-7 py-4 text-[12px] tracking-[.2em] uppercase transition-colors">
                Commander <ArrowRight size={16} strokeWidth={1.5} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to="/reserver" data-testid="hero-cta-book"
                className="inline-flex items-center justify-center gap-3 border border-ink hover:bg-ink hover:text-cream px-7 py-4 text-[12px] tracking-[.2em] uppercase text-ink transition-colors">
                Réserver une table
              </Link>
            </motion.div>

            {/* Mobile hero image — clean, below CTAs */}
            <div className="lg:hidden mt-10 relative">
              <img src={IMG_SALUMI} alt="Salumi artigianali" className="w-full aspect-[4/3] object-cover" />
              <div className="absolute inset-0 bg-terracotta/15 mix-blend-multiply pointer-events-none" />
              <div className="absolute -bottom-3 -right-3 w-16 h-16 bg-terracotta -z-0" />
            </div>

            <div className="mt-10 lg:mt-14 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8 text-sm text-center sm:text-left">
              <div>
                <p className="text-[10px] tracking-widest uppercase text-muted2 mb-1">Adresse</p>
                <p className="text-ink">{settings.address || "Av. William-Fraisse 1, 1006 Lausanne"}</p>
              </div>
              <div className="hidden sm:block w-px h-8 bg-ink/20" />
              <a href={`tel:${(settings.phone||"").replace(/\s/g,"")}`} className="link-underline">
                <p className="text-[10px] tracking-widest uppercase text-muted2 mb-1">Téléphone</p>
                <p className="text-ink">{settings.phone || "+41 79 706 39 66"}</p>
              </a>
            </div>
          </div>

          {/* Logo card — desktop only */}
          <div className="lg:col-span-6 hidden lg:flex justify-center lg:justify-end pr-8">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4, duration: 1 }}
              className="relative">
              <img src={LOGO} alt="Angelucci's" className="w-80 h-80 object-contain drop-shadow-2xl" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="bg-ink text-cream/80 py-4 lg:py-5 overflow-hidden border-y-2 border-terracotta">
        <div className="flex whitespace-nowrap animate-marquee">
          {[...Array(2)].flatMap(() => ["Parmigiano 24 mois", "Tagliatelles fraîches", "Olio d'oliva Toscana", "Mozzarella di bufala", "Salumi artigianali", "Vini italiani"]).map((t, i) => (
            <span key={i} className="mx-6 lg:mx-8 font-italic-display text-lg lg:text-2xl flex items-center gap-6 lg:gap-8">{t}<span className="text-terracotta">✦</span></span>
          ))}
        </div>
      </div>

      {/* NOTRE HISTOIRE */}
      <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-16 md:py-24 lg:py-32 grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        <motion.div {...fadeUp} className="lg:col-span-5 relative">
          <div className="relative">
            <img src={IMG_TAGLIATELLE} alt="Pâtes fraîches" className="w-full aspect-[4/5] object-cover" />
            <div className="absolute inset-0 bg-terracotta/10 mix-blend-multiply pointer-events-none" />
            <div className="absolute -top-4 -left-4 w-20 lg:w-24 h-20 lg:h-24 border-2 border-brand -z-10" />
          </div>
        </motion.div>
        <motion.div {...fadeUp} transition={{ delay: 0.15, duration: 0.9 }} className="lg:col-span-7 lg:pl-8">
          <div className="flex items-center gap-4 mb-5 lg:mb-6">
            <span className="w-8 h-px bg-terracotta" />
            <p className="text-[10px] lg:text-[11px] tracking-[.35em] lg:tracking-[.4em] uppercase text-terracotta">Notre histoire</p>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl mb-6 lg:mb-8 leading-[1.05]">
            Redécouvrir les saveurs<br/><em className="text-brand not-italic font-italic-display">oubliées</em> d&apos;Italie.
          </h2>
          <p className="text-muted2 leading-relaxed mb-4 lg:mb-5 text-base lg:text-lg">
            Nous recherchons les petits producteurs qui travaillent dans l&apos;esprit du mouvement
            <em className="font-italic-display text-ink"> Slow Food® </em>— une nouvelle génération qui retrouve
            les techniques de production de leurs parents.
          </p>
          <p className="text-muted2 leading-relaxed mb-8 lg:mb-10 text-base lg:text-lg">
            Une partie de nos fromages est encore affinée chez nous.
            Toutes nos pâtes sont fraîches, faites par nos soins.
          </p>
          <Link to="/histoire" data-testid="story-link"
            className="group inline-flex items-center gap-3 text-ink hover:text-terracotta transition-colors text-sm tracking-[.2em] uppercase">
            Lire la suite
            <span className="w-10 h-px bg-current group-hover:w-14 transition-all" />
            <ArrowRight size={16} strokeWidth={1.5} />
          </Link>
        </motion.div>
      </section>

      {/* PLATS PHARES */}
      <section className="bg-cream-surface relative overflow-hidden py-16 md:py-24 lg:py-32">
        <div className="hidden md:block absolute top-10 right-10 font-display text-[8rem] lg:text-[12rem] text-terracotta/10 leading-none select-none">Menu</div>
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 relative">
          <motion.div {...fadeUp} className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 lg:mb-14 gap-5">
            <div>
              <div className="flex items-center gap-3 mb-3 lg:mb-4">
                <span className="w-8 h-px bg-terracotta" />
                <p className="text-[10px] lg:text-[11px] tracking-[.35em] lg:tracking-[.4em] uppercase text-terracotta">Nos incontournables</p>
              </div>
              <h2 className="font-display text-4xl sm:text-5xl md:text-6xl leading-tight">
                Les plats <em className="font-italic-display text-brand">phares</em>
              </h2>
            </div>
            <Link to="/commander" className="link-underline text-sm tracking-[.2em] uppercase text-ink hover:text-terracotta">Voir toute la carte →</Link>
          </motion.div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 lg:gap-8">
            {(featured.length > 0 ? featured : [
              { id: "1", name: "Tagliatelles al ragù", description: "Pâtes maison, ragù mijoté 6h", price: 26.5, image_url: IMG_TAGLIATELLE },
              { id: "2", name: "Salumi Artigianali", description: "Sélection charcuterie italienne", price: 18.9, image_url: IMG_SALUMI },
              { id: "3", name: "Pâtes fraîches maison", description: "Farine locale, œufs frais", price: 22, image_url: IMG_PASTA_SHORT },
            ]).map((p, i) => (
              <motion.div key={p.id} {...fadeUp} transition={{ delay: 0.1 * i, duration: 0.9 }}
                className="group bg-cream border border-ink/5 hover:border-terracotta/40 transition-all overflow-hidden">
                <div className="aspect-[4/3] overflow-hidden relative">
                  <img src={p.image_url || IMG_TAGLIATELLE} alt={p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                  <div className="absolute inset-0 bg-terracotta/10 mix-blend-multiply pointer-events-none" />
                  <div className="absolute top-3 left-3 bg-cream/95 backdrop-blur-sm text-terracotta text-[10px] tracking-widest uppercase px-2 py-1 flex items-center gap-1">
                    <Star size={10} fill="currentColor" strokeWidth={0} /> {i === 0 ? "Signature" : i === 1 ? "Producteur" : "Fait maison"}
                  </div>
                </div>
                <div className="p-5 lg:p-6 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl lg:text-2xl mb-1">{p.name}</h3>
                    <p className="text-sm text-muted2 line-clamp-2">{p.description}</p>
                  </div>
                  <p className="text-terracotta font-medium whitespace-nowrap">CHF {Number(p.price).toFixed(2)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIES DUAL */}
      <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-16 md:py-24 lg:py-32">
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { to: "/commander", label: "Il Ristorante", tag: "Trattoria", desc: "Cuisine du marché. À emporter ou en livraison.", img: IMG_PASTA_SHORT, icon: UtensilsCrossed, accent: "bg-terracotta" },
            { to: "/epicerie", label: "L'Épicerie", tag: "Bottega", desc: "Produits d'exception, jusqu'à 1 semaine à l'avance.", img: IMG_SALUMI, icon: Wheat, accent: "bg-brand" },
          ].map((c) => (
            <Link key={c.to} to={c.to} data-testid={`landing-${c.to.replace("/", "")}`}
              className="group relative h-[380px] sm:h-[440px] md:h-[560px] overflow-hidden">
              <img src={c.img} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1200ms] ease-out" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/50 to-ink/20" />
              <div className={`absolute top-6 left-6 ${c.accent} text-cream px-4 py-1.5 text-[10px] tracking-[.25em] uppercase`}>{c.tag}</div>
              <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8 md:p-10 text-cream">
                <c.icon size={32} strokeWidth={1.2} className="mb-4 lg:mb-5 text-cream/90" />
                <h3 className="font-display text-4xl sm:text-5xl md:text-6xl mb-2 lg:mb-3">{c.label}</h3>
                <p className="text-cream/85 mb-5 lg:mb-6 max-w-md text-sm sm:text-base">{c.desc}</p>
                <span className="inline-flex items-center gap-3 text-[12px] tracking-[.2em] uppercase group-hover:gap-5 transition-all">
                  Découvrir <ArrowRight size={16} strokeWidth={1.5} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* INFOS + MAP */}
      <section className="bg-ink text-cream py-16 lg:py-24">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 grid md:grid-cols-3 gap-8 lg:gap-10 mb-10 lg:mb-12">
          <motion.div {...fadeUp} className="border-l-2 border-terracotta pl-5 lg:pl-6">
            <MapPin size={22} strokeWidth={1.5} className="mb-3 lg:mb-4 text-terracotta" />
            <p className="text-[10px] tracking-[.3em] uppercase text-cream/60 mb-2">Adresse</p>
            <p className="font-display text-xl lg:text-2xl">{settings.address || "Av. William-Fraisse 1, 1006 Lausanne"}</p>
          </motion.div>
          <motion.div {...fadeUp} transition={{ delay: 0.1, duration: 0.8 }} className="border-l-2 border-brand pl-5 lg:pl-6">
            <Phone size={22} strokeWidth={1.5} className="mb-3 lg:mb-4 text-brand" />
            <p className="text-[10px] tracking-[.3em] uppercase text-cream/60 mb-2">Téléphone</p>
            <a href={`tel:${(settings.phone || "").replace(/\s/g, "")}`} className="font-display text-xl lg:text-2xl link-underline">
              {settings.phone || "+41 79 706 39 66"}
            </a>
          </motion.div>
          <motion.div {...fadeUp} transition={{ delay: 0.2, duration: 0.8 }} className="border-l-2 border-terracotta pl-5 lg:pl-6">
            <UtensilsCrossed size={22} strokeWidth={1.5} className="mb-3 lg:mb-4 text-terracotta" />
            <p className="text-[10px] tracking-[.3em] uppercase text-cream/60 mb-2">Réserver</p>
            <Link to="/reserver" className="font-display text-xl lg:text-2xl link-underline">Réserver votre place</Link>
          </motion.div>
        </div>
        <div className="max-w-[1400px] mx-auto px-6 md:px-10">
          <div className="aspect-[4/3] md:aspect-[16/6] w-full overflow-hidden border border-cream/10">
            <iframe title="Map" width="100%" height="100%" style={{ border: 0, filter: "grayscale(1) contrast(1.05) brightness(.9)" }}
              src={`https://www.google.com/maps?q=${encodeURIComponent(settings.address || "Av. William-Fraisse 1, 1006 Lausanne")}&output=embed`}
              loading="lazy" />
          </div>
        </div>
      </section>
    </PageTransition>
  );
}
