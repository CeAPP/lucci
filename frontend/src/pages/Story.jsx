import PageTransition from "@/components/PageTransition";
import { motion } from "framer-motion";

export default function Story() {
  return (
    <PageTransition>
      <section className="pt-40 pb-24 max-w-4xl mx-auto px-6 md:px-10">
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
          className="text-xs tracking-[.4em] uppercase text-brand mb-6">Notre philosophie</motion.p>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.1 }}
          className="font-display text-5xl md:text-7xl leading-tight mb-12">
          Redécouvrir les saveurs oubliées.
        </motion.h1>
        <div className="space-y-6 text-lg leading-relaxed text-ink/90">
          <p>
            Faire redécouvrir des produits du terroir venant de toutes les régions d&apos;Italie.
            Retrouver, dans un marché dominé par l&apos;industriel, les souvenirs d&apos;enfance de saveurs oubliées.
            Tels sont notre but et notre philosophie.
          </p>
          <p>
            Nous recherchons constamment les petits producteurs qui travaillent dans l&apos;esprit du mouvement
            <em className="font-italic-display"> Slow Food® </em>, souvent d&apos;une nouvelle génération qui retrouve
            les techniques de production de leurs parents. Une partie de nos fromages est encore affinée chez nous.
            Toutes nos pâtes sont fraîches, et une grande partie est faite par nos soins avec des produits de saison
            et de toute première fraîcheur.
          </p>
          <div className="my-16 py-12 border-t border-b border-brand text-center">
            <p className="font-italic-display text-3xl md:text-5xl text-brand mb-4">
              La qualità a discapito della quantità
            </p>
            <p className="text-sm tracking-widest uppercase text-muted2">
              La qualité, de préférence à la quantité.
            </p>
          </div>
        </div>
      </section>
    </PageTransition>
  );
}
