import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Palette, Type, Upload, Save, Image as ImageIcon, ExternalLink } from "lucide-react";
import api from "@/lib/api";
import { FONT_DISPLAY_CHOICES, FONT_BODY_CHOICES } from "@/lib/ThemeProvider";

// PAGES config — blocks grouped by SECTION for a visual, page-mimicking editor.
// Each block has:
//   key       : storage key (page.key)
//   label     : friendly name (short)
//   kind      : "text" (line) | "long" (paragraph) | "image"
//   sample    : example value shown as placeholder / hint
const PAGES = {
  landing: {
    label: "Accueil",
    publicPath: "/",
    sections: [
      {
        title: "Section 1 · Bandeau d'accueil (hero)",
        desc: "Le tout premier écran que le client voit en arrivant sur le site.",
        wireframe: "hero",
        blocks: [
          { key: "hero_eyebrow", label: "Ligne au-dessus du titre", kind: "text", sample: "Farmacia Angelucci" },
          { key: "hero_title", label: "Grand titre", kind: "text", sample: "Angelucci's" },
          { key: "hero_subtitle", label: "Sous-titre italique", kind: "text", sample: "la qualità a discapito della quantità" },
          { key: "hero_cta_order", label: "Bouton principal", kind: "text", sample: "Commander" },
          { key: "hero_cta_book", label: "Bouton secondaire", kind: "text", sample: "Réserver une table" },
          { key: "hero_image", label: "Image de droite", kind: "image", sample: "" },
        ],
      },
      {
        title: "Section 2 · Notre histoire",
        desc: "Bloc « histoire courte » avec image à gauche et texte à droite.",
        wireframe: "story",
        blocks: [
          { key: "story_eyebrow", label: "Surtitre", kind: "text", sample: "Notre histoire" },
          { key: "story_title_1", label: "Début du titre", kind: "text", sample: "Redécouvrir les saveurs" },
          { key: "story_title_2", label: "Mot(s) en italique", kind: "text", sample: "oubliées" },
          { key: "story_title_3", label: "Fin du titre", kind: "text", sample: "d'Italie." },
          { key: "story_p1", label: "1er paragraphe", kind: "long", sample: "" },
          { key: "story_p2", label: "2ᵉ paragraphe", kind: "long", sample: "" },
          { key: "story_cta", label: "Texte du bouton", kind: "text", sample: "Lire la suite" },
          { key: "story_image", label: "Image de gauche", kind: "image", sample: "" },
        ],
      },
      {
        title: "Section 3 · Ristorante & Épicerie",
        desc: "Les 2 grandes cartes qui envoient vers les menus.",
        wireframe: "cats",
        blocks: [
          { key: "cat_resto_label", label: "Ristorante — titre", kind: "text", sample: "Il Ristorante" },
          { key: "cat_resto_tag", label: "Ristorante — étiquette", kind: "text", sample: "Trattoria" },
          { key: "cat_resto_desc", label: "Ristorante — description", kind: "text", sample: "Cuisine du marché. À emporter ou en livraison." },
          { key: "cat_resto_image", label: "Ristorante — image", kind: "image", sample: "" },
          { key: "cat_epi_label", label: "Épicerie — titre", kind: "text", sample: "L'Épicerie" },
          { key: "cat_epi_tag", label: "Épicerie — étiquette", kind: "text", sample: "Bottega" },
          { key: "cat_epi_desc", label: "Épicerie — description", kind: "text", sample: "Produits d'exception, jusqu'à 1 semaine à l'avance." },
          { key: "cat_epi_image", label: "Épicerie — image", kind: "image", sample: "" },
        ],
      },
    ],
  },
  story: {
    label: "Histoire",
    publicPath: "/histoire",
    sections: [
      {
        title: "Page Histoire",
        desc: "Page dédiée à raconter votre histoire, votre philosophie.",
        wireframe: "textpage",
        blocks: [
          { key: "eyebrow", label: "Surtitre", kind: "text", sample: "Notre philosophie" },
          { key: "title", label: "Titre", kind: "text", sample: "Redécouvrir les saveurs oubliées." },
          { key: "image", label: "Image en tête (optionnel)", kind: "image", sample: "" },
          { key: "p1", label: "1er paragraphe", kind: "long", sample: "" },
          { key: "p2", label: "2ᵉ paragraphe", kind: "long", sample: "" },
          { key: "motto_it", label: "Devise (italien)", kind: "text", sample: "La qualità a discapito della quantità" },
          { key: "motto_fr", label: "Devise (français)", kind: "text", sample: "La qualité, de préférence à la quantité." },
        ],
      },
    ],
  },
  contact: {
    label: "Contact",
    publicPath: "/contact",
    sections: [
      {
        title: "Page Contact",
        desc: "Adresse, téléphone, horaires sont récupérés depuis les Paramètres — ici tu ajoutes surtitre, titre et un texte d'accroche.",
        wireframe: "textpage",
        blocks: [
          { key: "eyebrow", label: "Surtitre", kind: "text", sample: "Nous trouver" },
          { key: "title", label: "Titre", kind: "text", sample: "Contact" },
          { key: "intro", label: "Texte d'introduction (optionnel)", kind: "long", sample: "" },
          { key: "image", label: "Image en tête (optionnelle)", kind: "image", sample: "" },
        ],
      },
    ],
  },
  reservation: {
    label: "Réserver",
    publicPath: "/reserver",
    sections: [
      {
        title: "Page Réservation",
        desc: "Titre et texte d'introduction affichés au-dessus du calendrier de réservation.",
        wireframe: "textpage",
        blocks: [
          { key: "eyebrow", label: "Surtitre", kind: "text", sample: "Réservation" },
          { key: "title", label: "Titre", kind: "text", sample: "Réserver une table" },
          { key: "intro", label: "Texte d'introduction", kind: "long", sample: "Confirmation immédiate. Nous vous accueillerons avec plaisir." },
          { key: "image", label: "Image en tête (optionnelle)", kind: "image", sample: "" },
        ],
      },
    ],
  },
};

export default function SiteTab() {
  const [subtab, setSubtab] = useState("landing");
  const [content, setContent] = useState({});
  const [theme, setTheme] = useState({ primary: "#7FA9A8", font_display: "Cormorant Garamond", font_body: "Manrope" });

  const load = async () => {
    try {
      const { data } = await api.get("/content");
      setContent(data || {});
    } catch { /* empty */ }
    try {
      const { data } = await api.get("/theme");
      setTheme(data);
    } catch { /* empty */ }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="border border-ink/10 bg-cream-surface/50 p-4 mb-4">
        <p className="text-[10px] tracking-[.3em] uppercase text-brand mb-1">Éditeur du site</p>
        <h3 className="font-display text-2xl">Contenu, images, couleur, polices</h3>
        <p className="text-sm text-muted2 mt-1">Chaque page est découpée en sections. Repère la zone à modifier grâce au schéma coloré, puis modifie les blocs de cette section. Le vide garde le texte par défaut.</p>
      </div>

      <Tabs value={subtab} onValueChange={setSubtab}>
        <TabsList className="bg-cream border border-ink/10 rounded-none w-full justify-start overflow-x-auto flex-nowrap h-auto p-0">
          {Object.entries(PAGES).map(([id, p]) => (
            <TabsTrigger key={id} value={id} data-testid={`site-subtab-${id}`}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-brand data-[state=active]:bg-transparent data-[state=active]:text-brand text-xs tracking-widest uppercase h-10 px-4 whitespace-nowrap">
              {p.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="theme" data-testid="site-subtab-theme"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-brand data-[state=active]:bg-transparent data-[state=active]:text-brand text-xs tracking-widest uppercase h-10 px-4 whitespace-nowrap">
            Couleur & Polices
          </TabsTrigger>
        </TabsList>

        {Object.entries(PAGES).map(([id, p]) => (
          <TabsContent key={id} value={id} className="pt-6">
            <PageEditor pageId={id} config={p} currentBlocks={content[id] || {}} onSaved={load} />
          </TabsContent>
        ))}
        <TabsContent value="theme" className="pt-6">
          <ThemeEditor theme={theme} onSaved={load} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---- Page editor with visual sections ----
function PageEditor({ pageId, config, currentBlocks, onSaved }) {
  const [values, setValues] = useState({});
  const [openSection, setOpenSection] = useState(0);
  useEffect(() => { setValues(currentBlocks || {}); }, [pageId, currentBlocks]);

  const save = async () => {
    try {
      const dirty = Object.entries(values).filter(([k, v]) => (currentBlocks[k] || "") !== (v || ""));
      if (dirty.length === 0) { toast.info("Aucun changement à enregistrer"); return; }
      await Promise.all(dirty.map(([key, value]) =>
        api.put("/content", null, { params: { page: pageId, key, value: value || "" } })
      ));
      toast.success(`${dirty.length} bloc(s) mis à jour`);
      onSaved && onSaved();
    } catch (e) {
      toast.error(`Erreur : ${e?.response?.data?.detail || e.message}`);
    }
  };

  const setValue = (key, v) => setValues((prev) => ({ ...prev, [key]: v }));
  const dirtyCount = Object.entries(values).filter(([k, v]) => (currentBlocks[k] || "") !== (v || "")).length;

  return (
    <div>
      {/* Top bar: page name + preview link + save */}
      <div className="sticky top-16 z-10 -mx-3 sm:-mx-6 px-3 sm:px-6 py-3 bg-cream-surface border-b border-ink/10 flex flex-wrap items-center gap-3 mb-5">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] tracking-widest uppercase text-muted2">Page en cours d&apos;édition</p>
          <p className="font-display text-lg truncate">{config.label}</p>
        </div>
        <a href={config.publicPath} target="_blank" rel="noopener noreferrer" data-testid={`site-preview-${pageId}`}
          className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-brand hover:underline">
          <ExternalLink size={12}/> Voir la page publique
        </a>
        <Button onClick={save} data-testid={`site-save-${pageId}`}
          disabled={dirtyCount === 0}
          className="rounded-none bg-brand hover:bg-brand-hover text-cream uppercase text-xs tracking-widest">
          <Save size={14} className="mr-1"/> {dirtyCount > 0 ? `Enregistrer (${dirtyCount})` : "Enregistrer"}
        </Button>
      </div>

      {/* Sections as accordion cards with a schematic wireframe on the left */}
      <div className="space-y-4">
        {config.sections.map((section, si) => {
          const open = openSection === si;
          return (
            <div key={si} className={`border transition-all ${open ? "border-brand" : "border-ink/10"} bg-cream`}>
              <button onClick={() => setOpenSection(open ? -1 : si)}
                data-testid={`site-section-toggle-${pageId}-${si}`}
                className={`w-full flex items-center gap-4 p-3 sm:p-4 text-left transition-all ${open ? "bg-brand/5" : "hover:bg-ink/5"}`}>
                <SectionWireframe kind={section.wireframe} highlight={open}/>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-lg leading-tight">{section.title}</p>
                  <p className="text-xs text-muted2 hidden sm:block">{section.desc}</p>
                </div>
                <div className="text-xs tracking-widest uppercase text-brand">
                  {section.blocks.length} bloc{section.blocks.length > 1 ? "s" : ""}
                </div>
              </button>

              {open && (
                <div className="border-t border-ink/10 p-3 sm:p-4 space-y-3">
                  {section.blocks.map((b) => (
                    <BlockEditor key={b.key} block={b} value={values[b.key] || ""} onChange={(v) => setValue(b.key, v)} pageId={pageId} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Small SVG wireframe of each section — visual anchor to help admin find where each block lives ----
function SectionWireframe({ kind, highlight }) {
  const fg = highlight ? "var(--brand)" : "#333";
  const bg = highlight ? "var(--brand)" : "#999";
  const bgLight = highlight ? "rgba(127,169,168,0.12)" : "#f2f2f2";
  const common = { width: 72, height: 48, viewBox: "0 0 72 48", className: "shrink-0 border border-ink/10" };
  if (kind === "hero") return (
    <svg {...common}>
      <rect x="0" y="0" width="72" height="48" fill={bgLight}/>
      <rect x="4" y="6" width="20" height="2" fill={bg}/>
      <rect x="4" y="12" width="34" height="8" fill={fg}/>
      <rect x="4" y="24" width="22" height="3" fill={bg}/>
      <rect x="4" y="34" width="14" height="6" fill={fg}/>
      <rect x="20" y="34" width="14" height="6" fill="none" stroke={fg}/>
      <rect x="44" y="4" width="24" height="40" fill={bg} opacity="0.4"/>
    </svg>
  );
  if (kind === "story") return (
    <svg {...common}>
      <rect x="0" y="0" width="72" height="48" fill={bgLight}/>
      <rect x="4" y="6" width="26" height="36" fill={bg} opacity="0.5"/>
      <rect x="34" y="10" width="12" height="2" fill={bg}/>
      <rect x="34" y="16" width="34" height="6" fill={fg}/>
      <rect x="34" y="26" width="30" height="2" fill={bg}/>
      <rect x="34" y="30" width="24" height="2" fill={bg}/>
      <rect x="34" y="36" width="16" height="4" fill={fg}/>
    </svg>
  );
  if (kind === "cats") return (
    <svg {...common}>
      <rect x="0" y="0" width="72" height="48" fill={bgLight}/>
      <rect x="4" y="6" width="30" height="36" fill={bg} opacity="0.35"/>
      <rect x="8" y="34" width="14" height="4" fill={fg}/>
      <rect x="8" y="24" width="20" height="2" fill={bg}/>
      <rect x="38" y="6" width="30" height="36" fill={bg} opacity="0.55"/>
      <rect x="42" y="34" width="14" height="4" fill={fg}/>
      <rect x="42" y="24" width="20" height="2" fill={bg}/>
    </svg>
  );
  // textpage — a full page of text
  return (
    <svg {...common}>
      <rect x="0" y="0" width="72" height="48" fill={bgLight}/>
      <rect x="6" y="8" width="20" height="2" fill={bg}/>
      <rect x="6" y="14" width="42" height="6" fill={fg}/>
      <rect x="6" y="26" width="60" height="2" fill={bg}/>
      <rect x="6" y="30" width="52" height="2" fill={bg}/>
      <rect x="6" y="34" width="58" height="2" fill={bg}/>
      <rect x="6" y="38" width="40" height="2" fill={bg}/>
    </svg>
  );
}

function BlockEditor({ block, value, onChange, pageId }) {
  const [uploading, setUploading] = useState(false);
  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onChange(data.url);
      toast.success("Image téléversée");
    } catch (e) {
      toast.error(`Erreur upload : ${e?.response?.data?.detail || e.message}`);
    } finally { setUploading(false); }
  };
  return (
    <div className="bg-cream-surface/50 border border-ink/8 p-3">
      <div className="flex items-baseline justify-between mb-2 gap-3">
        <Label className="text-sm font-medium">{block.label}</Label>
        {block.kind === "image" && <span className="text-[10px] uppercase tracking-widest text-brand shrink-0 flex items-center gap-1"><ImageIcon size={10}/> Image</span>}
      </div>
      {block.kind === "text" && (
        <Input value={value} onChange={(e) => onChange(e.target.value)}
          data-testid={`site-${pageId}-${block.key}`}
          placeholder={block.sample || "Laisser vide = valeur par défaut"}
          className="rounded-none bg-cream border-ink/20" />
      )}
      {block.kind === "long" && (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)}
          data-testid={`site-${pageId}-${block.key}`}
          rows={4}
          placeholder={block.sample || "Laisser vide = valeur par défaut"}
          className="rounded-none bg-cream border-ink/20 font-body" />
      )}
      {block.kind === "image" && (
        <div>
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-start">
            {value ? (
              <img src={value} alt="" className="w-full sm:w-32 h-32 object-cover border border-ink/10 shrink-0" />
            ) : (
              <div className="w-full sm:w-32 h-32 border border-dashed border-ink/20 bg-cream/50 flex items-center justify-center text-muted2 text-xs shrink-0">
                Aucune image
              </div>
            )}
            <div className="flex-1 flex flex-col gap-2">
              <Input value={value} onChange={(e) => onChange(e.target.value)}
                placeholder="URL de l'image…"
                data-testid={`site-${pageId}-${block.key}`}
                className="rounded-none bg-cream border-ink/20" />
              <div className="flex gap-2">
                <label className="inline-flex items-center gap-1 px-3 py-2 border border-brand text-brand hover:bg-brand hover:text-cream text-xs tracking-widest uppercase cursor-pointer">
                  <Upload size={12}/> {uploading ? "..." : "Téléverser un fichier"}
                  <input type="file" accept="image/*" hidden
                    data-testid={`site-${pageId}-${block.key}-file`}
                    onChange={(e) => uploadImage(e.target.files?.[0])} />
                </label>
                {value && (
                  <button onClick={() => onChange("")}
                    data-testid={`site-${pageId}-${block.key}-clear`}
                    className="px-3 py-2 border border-ink/20 text-muted2 hover:border-destructive hover:text-destructive text-xs tracking-widest uppercase">
                    Retirer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Theme editor (unchanged) ----
function ThemeEditor({ theme, onSaved }) {
  const [primary, setPrimary] = useState(theme.primary);
  const [fontDisplay, setFontDisplay] = useState(theme.font_display);
  const [fontBody, setFontBody] = useState(theme.font_body);
  useEffect(() => { setPrimary(theme.primary); setFontDisplay(theme.font_display); setFontBody(theme.font_body); }, [theme]);

  const save = async () => {
    try {
      await api.put("/theme", null, { params: { primary, font_display: fontDisplay, font_body: fontBody } });
      toast.success("Thème mis à jour — recharge le site public pour voir tous les changements");
      onSaved && onSaved();
      try { localStorage.removeItem("angel_theme"); } catch { /* empty */ }
      window.location.reload();
    } catch (e) {
      toast.error(`Erreur : ${e?.response?.data?.detail || e.message}`);
    }
  };

  const swatches = ["#7FA9A8", "#8FA3B0", "#D4A24C", "#B85450", "#5A7A5C", "#2E4057", "#1A1C18"];

  return (
    <div className="space-y-6">
      <div className="border border-ink/10 bg-cream p-5">
        <div className="flex items-center gap-2 mb-3">
          <Palette size={18} className="text-brand"/>
          <p className="text-xs tracking-widest uppercase text-muted2">Couleur principale</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)}
            data-testid="theme-primary-color"
            className="w-16 h-16 border border-ink/20 cursor-pointer" />
          <Input value={primary} onChange={(e) => setPrimary(e.target.value)} className="rounded-none bg-transparent border-ink/20 w-32" />
          <div className="flex flex-wrap gap-2">
            {swatches.map((c) => (
              <button key={c} onClick={() => setPrimary(c)} data-testid={`theme-swatch-${c}`}
                style={{ background: c }}
                className={`w-10 h-10 border-2 ${primary === c ? "border-ink" : "border-transparent hover:border-ink/40"}`}
                aria-label={c} title={c}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="border border-ink/10 bg-cream p-5">
        <div className="flex items-center gap-2 mb-3">
          <Type size={18} className="text-brand"/>
          <p className="text-xs tracking-widest uppercase text-muted2">Police des titres</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FONT_DISPLAY_CHOICES.map((f) => (
            <button key={f} onClick={() => setFontDisplay(f)} data-testid={`theme-font-display-${f}`}
              className={`text-left p-4 border ${fontDisplay === f ? "border-brand ring-2 ring-brand/40 bg-brand/5" : "border-ink/10 hover:border-brand"}`}>
              <p className="text-[10px] tracking-widest uppercase text-muted2 mb-1">{f}</p>
              <p style={{ fontFamily: `"${f}", serif` }} className="text-3xl">Angelucci&apos;s</p>
            </button>
          ))}
        </div>
      </div>

      <div className="border border-ink/10 bg-cream p-5">
        <div className="flex items-center gap-2 mb-3">
          <Type size={18} className="text-brand"/>
          <p className="text-xs tracking-widest uppercase text-muted2">Police du corps de texte</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {FONT_BODY_CHOICES.map((f) => (
            <button key={f} onClick={() => setFontBody(f)} data-testid={`theme-font-body-${f}`}
              className={`text-left p-4 border ${fontBody === f ? "border-brand ring-2 ring-brand/40 bg-brand/5" : "border-ink/10 hover:border-brand"}`}>
              <p className="text-[10px] tracking-widest uppercase text-muted2 mb-1">{f}</p>
              <p style={{ fontFamily: `"${f}", sans-serif` }} className="text-base">Qualità italiana</p>
            </button>
          ))}
        </div>
      </div>

      <Button onClick={save} data-testid="theme-save"
        className="rounded-none bg-brand hover:bg-brand-hover text-cream uppercase text-xs tracking-widest">
        <Save size={14} className="mr-1"/> Enregistrer & recharger
      </Button>
    </div>
  );
}
