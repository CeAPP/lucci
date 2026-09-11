import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Palette, Type, Upload, Save } from "lucide-react";
import api from "@/lib/api";
import { FONT_DISPLAY_CHOICES, FONT_BODY_CHOICES } from "@/lib/ThemeProvider";

// Config of the CMS blocks per page. `kind`: "text" (single line), "long" (textarea), "image" (URL).
const PAGES = {
  landing: {
    label: "Accueil",
    blocks: [
      { key: "hero_eyebrow", label: "Ligne de titre (au-dessus du grand titre)", kind: "text" },
      { key: "hero_title", label: "Grand titre", kind: "text" },
      { key: "hero_subtitle", label: "Sous-titre (italique)", kind: "text" },
      { key: "hero_cta_order", label: "Bouton principal — texte", kind: "text" },
      { key: "hero_cta_book", label: "Bouton secondaire — texte", kind: "text" },
      { key: "hero_image", label: "Image principale (hero)", kind: "image" },
      { key: "story_eyebrow", label: "Section Histoire — surtitre", kind: "text" },
      { key: "story_title_1", label: "Section Histoire — début du titre", kind: "text" },
      { key: "story_title_2", label: "Section Histoire — mot en italique", kind: "text" },
      { key: "story_title_3", label: "Section Histoire — fin du titre", kind: "text" },
      { key: "story_p1", label: "Section Histoire — 1er paragraphe", kind: "long" },
      { key: "story_p2", label: "Section Histoire — 2ᵉ paragraphe", kind: "long" },
      { key: "story_cta", label: "Section Histoire — texte du bouton", kind: "text" },
      { key: "story_image", label: "Section Histoire — image", kind: "image" },
      { key: "cat_resto_label", label: "Bloc Ristorante — titre", kind: "text" },
      { key: "cat_resto_tag", label: "Bloc Ristorante — étiquette", kind: "text" },
      { key: "cat_resto_desc", label: "Bloc Ristorante — description", kind: "text" },
      { key: "cat_resto_image", label: "Bloc Ristorante — image", kind: "image" },
      { key: "cat_epi_label", label: "Bloc Épicerie — titre", kind: "text" },
      { key: "cat_epi_tag", label: "Bloc Épicerie — étiquette", kind: "text" },
      { key: "cat_epi_desc", label: "Bloc Épicerie — description", kind: "text" },
      { key: "cat_epi_image", label: "Bloc Épicerie — image", kind: "image" },
    ],
  },
  story: {
    label: "Histoire",
    blocks: [
      { key: "eyebrow", label: "Surtitre", kind: "text" },
      { key: "title", label: "Titre", kind: "text" },
      { key: "image", label: "Image en tête (optionnel)", kind: "image" },
      { key: "p1", label: "1er paragraphe", kind: "long" },
      { key: "p2", label: "2ᵉ paragraphe", kind: "long" },
      { key: "motto_it", label: "Devise (italien)", kind: "text" },
      { key: "motto_fr", label: "Devise (français)", kind: "text" },
    ],
  },
  contact: {
    label: "Contact",
    blocks: [
      { key: "eyebrow", label: "Surtitre", kind: "text" },
      { key: "title", label: "Titre", kind: "text" },
      { key: "intro", label: "Texte d'introduction (optionnel)", kind: "long" },
      { key: "image", label: "Image en tête (optionnelle)", kind: "image" },
    ],
  },
  reservation: {
    label: "Réserver",
    blocks: [
      { key: "eyebrow", label: "Surtitre", kind: "text" },
      { key: "title", label: "Titre", kind: "text" },
      { key: "intro", label: "Texte d'introduction", kind: "long" },
      { key: "image", label: "Image en tête (optionnelle)", kind: "image" },
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
        <p className="text-sm text-muted2 mt-1">Les changements s&apos;appliquent au site public dès que tu enregistres. Les champs vides gardent les valeurs par défaut du template.</p>
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

// ---- Page editor ----
function PageEditor({ pageId, config, currentBlocks, onSaved }) {
  const [values, setValues] = useState({});
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

  return (
    <div className="space-y-5">
      <div className="flex justify-end sticky top-16 z-10 py-2 bg-cream-surface">
        <Button onClick={save} data-testid={`site-save-${pageId}`}
          className="rounded-none bg-brand hover:bg-brand-hover text-cream uppercase text-xs tracking-widest">
          <Save size={14} className="mr-1"/> Enregistrer
        </Button>
      </div>
      {config.blocks.map((b) => (
        <BlockEditor key={b.key} block={b} value={values[b.key] || ""} onChange={(v) => setValue(b.key, v)} pageId={pageId} />
      ))}
    </div>
  );
}

function BlockEditor({ block, value, onChange, pageId }) {
  const fileRef = useState(null)[0]; // eslint-disable-line no-unused-vars
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
    <div className="border border-ink/10 bg-cream p-4">
      <Label className="text-xs tracking-widest uppercase text-muted2">{block.label}</Label>
      <p className="text-[10px] text-muted2/70 mb-2 font-mono">{pageId}.{block.key}</p>
      {block.kind === "text" && (
        <Input value={value} onChange={(e) => onChange(e.target.value)}
          data-testid={`site-${pageId}-${block.key}`}
          className="rounded-none bg-transparent border-ink/20" />
      )}
      {block.kind === "long" && (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)}
          data-testid={`site-${pageId}-${block.key}`}
          rows={5} className="rounded-none bg-transparent border-ink/20 font-body" />
      )}
      {block.kind === "image" && (
        <div>
          <div className="flex flex-col sm:flex-row gap-2 items-start">
            <Input value={value} onChange={(e) => onChange(e.target.value)}
              placeholder="URL de l'image ou téléverse un fichier →"
              data-testid={`site-${pageId}-${block.key}`}
              className="rounded-none bg-transparent border-ink/20 flex-1" />
            <label className="inline-flex items-center gap-1 px-3 py-2 border border-brand text-brand hover:bg-brand hover:text-cream text-xs tracking-widest uppercase cursor-pointer">
              <Upload size={12}/> {uploading ? "..." : "Téléverser"}
              <input type="file" accept="image/*" hidden
                data-testid={`site-${pageId}-${block.key}-file`}
                onChange={(e) => uploadImage(e.target.files?.[0])} />
            </label>
          </div>
          {value && (
            <img src={value} alt="" className="mt-3 max-h-40 object-cover border border-ink/10" />
          )}
        </div>
      )}
    </div>
  );
}

// ---- Theme editor ----
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
      // Reload theme immediately in current session
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
