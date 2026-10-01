// Cloudflare Pages Function : POST /api/generate
// ============================================================
// Moteur Aura Design — 2 étapes appelées séparément par le client :
//   stage 'copy'  -> 1 appel TEXTE (gemini-2.5-flash) : JSON copywriting des slides
//   stage 'image' -> 1 appel IMAGE par slide (API Interactions, Nano Banana)
//
// Principes « zéro appel inutile » :
//   - une requête = une action explicite du client, jamais de boucle automatique
//   - aucun retry côté serveur (sauf sonde 404 sur nom de modèle, sans coût)
//   - validation stricte du payload (whitelists + tailles max)
//   - rate limit par IP (fenêtre glissante mémoire, par isolate)
//   - timeout sur chaque appel sortant (AbortController)
//
// Modèles (facturation Google ~$0.039 / $0.067 / $0.134 par image) :
//   flash (5 pts)   -> gemini-2.5-flash-image   (1K)
//   studio (10 pts) -> gemini-3.1-flash-image   (1K)
//   pro (20 pts)    -> gemini-3-pro-image       (2K)

interface Env {
  GEMINI_API_KEY?: string;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

const MODEL_CANDIDATES: Record<string, string[]> = {
  flash: ['gemini-2.5-flash-image'],
  studio: ['gemini-3.1-flash-image'],
  pro: ['gemini-3-pro-image', 'gemini-3-pro-image-preview'],
};

const IMAGE_SIZE: Record<string, string> = { flash: '1K', studio: '1K', pro: '2K' };

const FORMAT_ASPECT: Record<string, string> = {
  post: '4:5',
  scroller: '4:5',
  story: '9:16',
  square: '1:1',
  website: '16:9',
  product: '3:4',
  poster: '2:3',
  presentation: '16:9',
};

const VALID_FORMATS = new Set(Object.keys(FORMAT_ASPECT));
const VALID_MODELS = new Set(Object.keys(MODEL_CANDIDATES));
const VALID_STYLES = new Set(['dark', 'light']);

// Catalogue open source (Google Fonts) — même liste que le client.
const TITLE_FONTS = [
  'Playfair Display', 'Cormorant Garamond', 'DM Serif Display', 'Marcellus', 'Cinzel',
  'Fraunces', 'Libre Baskerville', 'Lora', 'Abril Fatface', 'Bebas Neue', 'Anton',
  'Archivo Black', 'Oswald', 'League Spartan', 'Alfa Slab One', 'Space Grotesk',
  'El Messiri', 'Changa', 'Lalezar', 'Reem Kufi', 'Noto Kufi Arabic', 'Amiri', 'Markazi Text',
  'Dancing Script', 'Great Vibes', 'Caveat', 'Pacifico',
];
const BODY_FONTS = [
  'Inter', 'Manrope', 'Outfit', 'Sora', 'Urbanist', 'Plus Jakarta Sans', 'Work Sans',
  'Figtree', 'Public Sans', 'Nunito Sans', 'Poppins', 'Quicksand', 'Baloo 2', 'Fredoka',
  'Comfortaa', 'JetBrains Mono', 'IBM Plex Mono', 'Space Mono', 'Merriweather', 'Newsreader',
  'Source Serif 4', 'Epilogue', 'Cairo', 'Tajawal', 'Almarai', 'Mada', 'Readex Pro',
  'IBM Plex Sans Arabic', 'Scheherazade New',
];
const VALID_FONT_NAMES = new Set([...TITLE_FONTS, ...BODY_FONTS]);

// Le client met les photos produit dans `references` quand il en attache (fidélité 100 %)
function hasProductInput(body: Record<string, unknown>): boolean {
  return Array.isArray(body.productImages) && body.productImages.length > 0;
}
const VALID_LANGS = new Set(['fr', 'en', 'ar']);

const LANG_NAMES: Record<string, string> = {
  fr: 'français',
  en: 'English',
  ar: 'arabe (العربية)',
};

// ---------- Rate limit mémoire (fenêtre glissante, par isolate) ----------
const buckets = new Map<string, number[]>();
function rateLimit(ip: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  buckets.set(ip, arr);
  if (buckets.size > 5000) buckets.clear(); // garde-fou mémoire
  return true;
}

// ---------- Helpers ----------
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

async function readJson(request: Request, maxBytes: number): Promise<Record<string, unknown> | null> {
  const raw = await request.text();
  if (raw.length > maxBytes) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const asStr = (v: unknown, min: number, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length >= min && s.length <= max ? s : null;
};

const asInt = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === 'number' ? Math.round(v) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// STAGE 'copy' : copywriting (1 appel gemini-2.5-flash, ~$0.002)
// ============================================================
async function handleCopy(apiKey: string, body: Record<string, unknown>): Promise<Response> {
  const prompt = asStr(body.prompt, 1, 1200);
  const format = asStr(body.format, 1, 20);
  const slidesCount = asInt(body.slidesCount, 1, 10);
  const lang = asStr(body.lang, 2, 2) || 'fr';
  const style = asStr(body.style, 4, 5) || 'dark';

  if (!prompt || !format || slidesCount === null || !VALID_FORMATS.has(format) || !VALID_LANGS.has(lang) || !VALID_STYLES.has(style)) {
    return json({ error: 'invalid_payload' }, 400);
  }

  const prof = body.profile as Record<string, unknown> | undefined;
  const productType = asStr(prof?.productType, 1, 120);
  const theme = asStr(prof?.theme, 1, 120);
  const profileLine = productType || theme ? `\n- Contexte marque : ${productType ? `type de produit = ${productType}` : ''}${productType && theme ? ' ; ' : ''}${theme ? `thème visuel = ${theme}` : ''} — tout le copywriting doit coller à cet univers` : '';

  const textPrompt = `Tu es le directeur de création d'Aura Design, studio de contenu social media de niveau agence. Tu écris le copywriting d'un visuel qui doit arrêter le scroll.

BRIEF
- Sujet utilisateur : "${prompt}"
- Format : ${format} — ${slidesCount} slide(s) — thème ${style === 'light' ? 'CLAIR (fond blanc, textes foncés)' : 'SOMBRE (fond sombre, contraste premium)'}
- Langue obligatoire : ${LANG_NAMES[lang] ?? 'français'}${profileLine}.

RÈGLES D'ÉCRITURE (niveau expert)
- Slide 1 = HOOK : max 8 mots, curiosity gap ou promesse concrète. Jamais de généralité creuse.
- 1 slide = 1 seule idée. Progression logique : accroche → preuve/mécanisme → objection → action.
- Titres : max 8 mots, verbes d'action ou chiffres concrets. Sous-titres : max 18 mots, bénéfice tangible.
- tag : 2 à 4 mots en MAJUSCULES. ctaText : verbe + bénéfice (max 6 mots).
- Statistiques et exemples plausibles et spécifiques (chiffres précis > adjectifs).
- Aucun emoji. Aucun jargon creux (« innovant », « révolutionnaire » interdits). Style direct, tutoiement ou vouvoiement cohérent.

RÉPONDS UNIQUEMENT avec ce JSON valide, sans texte autour :
{
  "title": "Titre court du projet",
  "fonts": { "title": "Nom exact du MENU", "body": "Nom exact du MENU" },
  "slides": [
    {
      "slideNumber": 1,
      "tag": "TAG COURT EN MAJUSCULES",
      "title": "Titre percutant (max 8 mots)",
      "subtitle": "Sous-titre clair (max 18 mots)",
      "highlightWord": "mot-clé du titre",
      "bulletPoints": ["Point 1", "Point 2", "Point 3"],
      "ctaText": "Appel à l'action court"
    }
  ]
}

MENU DE POLICES (obligatoirement issues de cette liste)
Polices de TITRES (display/serif) : ${TITLE_FONTS.join(', ')}
Polices de TEXTES (sans/lecture) : ${BODY_FONTS.join(', ')}
Choisis le couple le plus cohérent avec le sujet et l'ambiance (ex: luxe -> Playfair Display + Inter ; tech -> Space Grotesk + Manrope ; fun -> Baloo 2 + Nunito Sans ; affiche/sport -> Bebas Neue + Work Sans${lang === 'ar' ? ' ; ARABE -> titres : El Messiri/Changa/Lalezar/Reem Kufi/Amiri, textes : Cairo/Tajawal/Almarai/Readex Pro' : ''}).

CONTRAINTES DE SORTIE
- Exactement ${slidesCount} slide(s) dans le tableau "slides", numérotées 1..N.
- Si slidesCount === 1 : slide autonome (hook + valeur + CTA), bulletPoints = tableau vide.
- bulletPoints (3 max) uniquement pour les carrousels/présentations.
- highlightWord : un mot qui existe dans le titre.
- "fonts" : title ET body doivent être copiés EXACTEMENT depuis le menu (majuscules identiques).
- Pas d'emojis, pas de guillemets non échappés dans les chaînes JSON.`;

  const res = await fetchWithTimeout(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: textPrompt }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 3000, temperature: 0.8 },
      }),
    },
    30000
  );

  if (!res.ok) {
    return json({ error: 'copy_upstream', status: res.status }, 502);
  }

  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) return json({ error: 'copy_empty' }, 502);

  let design: { title?: string; slides?: unknown[] };
  try {
    design = JSON.parse(raw);
  } catch {
    return json({ error: 'copy_invalid_json' }, 502);
  }

  const slides = Array.isArray(design.slides) ? design.slides.slice(0, 10) : [];
  if (slides.length === 0) return json({ error: 'copy_no_slides' }, 502);

  const rawFonts = (design as { fonts?: { title?: unknown; body?: unknown } }).fonts || {};
  const fonts = {
    title: typeof rawFonts.title === 'string' && VALID_FONT_NAMES.has(rawFonts.title) ? rawFonts.title : 'Space Grotesk',
    body: typeof rawFonts.body === 'string' && VALID_FONT_NAMES.has(rawFonts.body) ? rawFonts.body : 'Inter',
  };
  return json({ configured: true, stage: 'copy', design: { title: design.title || '', fonts, slides } });
}

// ============================================================
// STAGE 'image' : 1 image (API Interactions, Nano Banana)
// ============================================================

// ---------- Directions artistiques : 1 par génération (tirage côté client, identique pour tout un carrousel) ----------
const ART_DIRECTIONS: { name: string; look: string; type: string }[] = [
 {
  "name": "Editorial magazine",
  "look": "Printed-magazine cover feel: generous margins, thin hairline rules, small-caps labels, one large cut-out photographic subject overlapping the headline, calm paper-like or deep tone background, asymmetric layout.",
  "type": "huge elegant high-contrast serif headline, small refined sans for the rest"
 },
 {
  "name": "Swiss minimal",
  "look": "International Typographic Style: strict grid, lots of white space, flush-left text block, one single bold geometric shape or photo crop in the accent color, no decoration, no shadows.",
  "type": "large tight neo-grotesque sans headline, small clean labels"
 },
 {
  "name": "Bold poster",
  "look": "Loud street-poster energy: massive uppercase headline filling the full width and stacked, flat solid color blocks, halftone or grain texture, strong diagonal or cropped cut-out subject, extreme contrast.",
  "type": "ultra-bold condensed uppercase display type"
 },
 {
  "name": "Gradient glass SaaS",
  "look": "Modern tech-product look: soft mesh gradient background built from the accent color and its neighbors, frosted-glass panels with subtle borders, floating UI-like cards and glowing orbs, airy depth.",
  "type": "rounded geometric sans, bold headline, light body"
 },
 {
  "name": "Full-bleed photography",
  "look": "One cinematic full-frame photograph that fills the whole canvas (real subject, natural light, shallow depth of field, film color grade); text sits directly on a calm zone of the photo, no panels, no cards.",
  "type": "clean modern sans, confident size contrast"
 },
 {
  "name": "Retro 70s",
  "look": "Warm 1970s print: sunburst rays, rounded organic shapes, earthy palette (cream, terracotta, mustard, brown) tinted with the accent color, visible paper grain, playful but premium.",
  "type": "chunky rounded retro display type, friendly rounded sans for the rest"
 },
 {
  "name": "Neon cyber",
  "look": "Near-black background with neon glow lines, perspective grid floor, glowing outlines and light trails in the accent color, subtle scanlines, futuristic hardware feel.",
  "type": "techno wide grotesk or monospace headline, crisp small mono labels"
 },
 {
  "name": "Paper collage",
  "look": "Handmade cut-and-paste collage: torn paper edges, tape strips, hand-drawn marker underlines and arrows, cut-out photo subject with a white sticker outline, layered textures, joyful and tactile.",
  "type": "expressive marker or cut-out lettering headline, simple sans for the rest"
 },
 {
  "name": "Luxury minimal",
  "look": "High-end boutique: deep black with warm metallic gold accents or soft cream with ink, thin gold lines, large negative space, ONE perfectly lit hero object, quiet and expensive.",
  "type": "refined light serif or elegant didone headline with wide letter-spaced labels"
 },
 {
  "name": "Playful 3D",
  "look": "Bright candy-color background, soft glossy clay-style 3D objects and icons floating around the text, big friendly shapes, rounded containers, cheerful and energetic.",
  "type": "chunky rounded bold sans headline, friendly rounded body"
 },
 {
  "name": "Brutalist web",
  "look": "Raw brutalist web aesthetic: flat grey or white background, thick black borders, hard rectangular boxes, harsh offset shadows, system-like layout, one loud accent block.",
  "type": "monospace and heavy grotesque mix, uppercase labels"
 },
 {
  "name": "Memphis 80s",
  "look": "Memphis-group pattern play: confetti triangles, squiggles, zigzags, dots and half-circles in pastel plus primary colors, off-grid playful composition on a light base.",
  "type": "bold geometric sans with playful baseline shifts"
 },
 {
  "name": "Bauhaus geometric",
  "look": "Bauhaus composition: circles, triangles and squares in primary tones plus the accent color, diagonal dynamic layout, thick bars, cream paper base.",
  "type": "geometric sans, tightly set, lowercase or uppercase mix"
 },
 {
  "name": "Art deco",
  "look": "Art deco glamour: symmetrical gold fan and sunburst motifs, stepped geometric borders, black with gold and emerald, thin parallel lines.",
  "type": "tall elegant deco display capitals with fine sans labels"
 },
 {
  "name": "Vaporwave",
  "look": "Vaporwave collage: pink-cyan gradient sunset, perspective grid, classical marble bust or palm silhouettes, glitch strips, dreamy nostalgia.",
  "type": "wide retro display type with slight chromatic offset"
 },
 {
  "name": "Y2K chrome",
  "look": "Early-2000s futurism: liquid chrome shapes, glossy bubbly gradients, sparkles and stars, translucent plastic, silver and baby blue with the accent color.",
  "type": "rounded glossy bubbly display type"
 },
 {
  "name": "Risograph print",
  "look": "Risograph print look: two or three spot colors overprinting, visible grain, slight misregistration, textured shapes and halftone gradients on off-white paper.",
  "type": "chunky rounded grotesque with a printed, slightly imperfect feel"
 },
 {
  "name": "Blueprint technical",
  "look": "Engineering blueprint: deep blue grid paper, white linework drawings, dimension lines, small annotations and callouts, technical stamp details.",
  "type": "technical monospace and condensed sans in white"
 },
 {
  "name": "Newspaper tabloid",
  "look": "Broadsheet front page: black-and-white halftone photo, column rules, headline bar with an accent color strip, small caption text blocks.",
  "type": "heavy newspaper serif headline, narrow serif body"
 },
 {
  "name": "Japanese wabi-sabi",
  "look": "Quiet Japanese minimalism: warm off-white textured paper, one expressive ink brushstroke or enso circle, asymmetrical emptiness, subtle red accent seal.",
  "type": "light refined serif or thin sans, generous spacing"
 },
 {
  "name": "Scandinavian soft",
  "look": "Calm Scandinavian lifestyle: muted pastel palette, rounded organic shapes, soft light wood and linen textures, cozy and airy.",
  "type": "soft geometric sans, medium weight"
 },
 {
  "name": "Organic botanical",
  "look": "Lush botanical composition: large detailed leaves and ferns, layered greens, soft natural light and shadow, fresh and natural.",
  "type": "graceful serif headline with light sans body"
 },
 {
  "name": "Watercolor wash",
  "look": "Translucent watercolor washes bleeding into each other, cold-press paper texture, soft edges, hand-painted feel with a few splatters.",
  "type": "hand-lettered or soft brush headline, light sans body"
 },
 {
  "name": "Hand-drawn doodle",
  "look": "Notebook doodle world: ink line doodles, arrows, stars, underlines and little icons around the text on graph or lined paper.",
  "type": "casual handwritten headline, tidy handwritten body"
 },
 {
  "name": "Comic pop-art",
  "look": "Pop-art comic panel: bold black outlines, Ben-Day halftone dots, starburst speech shapes, flat saturated primaries.",
  "type": "comic-book bold lettering headline"
 },
 {
  "name": "Anime key visual",
  "look": "Dynamic anime-style key visual energy: speed lines, dramatic light flares, screentone shading, bold diagonal composition, vivid sky colors.",
  "type": "bold slanted display type with clean sans labels"
 },
 {
  "name": "Isometric scene",
  "look": "Clean isometric illustration of a tiny 3D world related to the subject, pastel palette, crisp edges, soft shadows, scene placed off-center.",
  "type": "friendly geometric sans"
 },
 {
  "name": "Flat vector illustration",
  "look": "Modern flat vector illustration: simple shapes, no gradients, characters or objects with bold limited palette, generous clean backgrounds.",
  "type": "rounded modern sans, bold headline"
 },
 {
  "name": "Continuous line art",
  "look": "Single continuous monoline illustration (face, hands or object) in the accent color over a calm solid background, elegant and minimal.",
  "type": "light elegant sans or thin serif"
 },
 {
  "name": "Duotone photo",
  "look": "A strong photograph rendered in two-color duotone (accent color plus a deep tone), high contrast, bold crop, graphic and modern.",
  "type": "bold grotesque headline in white or cream"
 },
 {
  "name": "Cinematic movie poster",
  "look": "Theatrical one-sheet: dramatic backlighting, teal-and-orange grade, central silhouette or object, atmospheric haze, small credit-style text lines.",
  "type": "tall tracked-out cinematic capitals headline"
 },
 {
  "name": "Film noir",
  "look": "High-contrast black-and-white, hard directional light with venetian-blind shadows, smoky atmosphere, a single accent color touch.",
  "type": "condensed 1940s display capitals"
 },
 {
  "name": "Polaroid scrapbook",
  "look": "Scrapbook table: instant photos with white borders, washi tape, paper clips, handwritten captions, warm vintage tones.",
  "type": "handwritten caption style for body, bold casual headline"
 },
 {
  "name": "Vintage travel poster",
  "look": "1930s lithograph travel poster: flat stylized landscape, limited warm palette, strong simple shapes, textured print grain.",
  "type": "classic art-poster lettering, capitals"
 },
 {
  "name": "Vintage label badge",
  "look": "Old-school packaging label: ornate border frames, round seal badge, ribbon banners, engraved flourishes on cream paper.",
  "type": "ornamental serif and slab capitals"
 },
 {
  "name": "Engraved banknote",
  "look": "Fine engraved linework like a banknote or certificate: guilloche patterns, fine hatching, deep green or navy ink on cream.",
  "type": "engraved serif capitals with fine sans labels"
 },
 {
  "name": "Gothic dark romance",
  "look": "Moody dark romance: black and deep crimson, ornate dark frames, candlelight, velvet textures, dramatic vignette.",
  "type": "ornate high-contrast serif with decorative caps"
 },
 {
  "name": "Cyberpunk city",
  "look": "Rain-soaked cyberpunk street at night: magenta and cyan signage glow, wet reflections, towering buildings, cinematic haze.",
  "type": "angular futuristic display type"
 },
 {
  "name": "Synthwave sunset",
  "look": "Retro synthwave: huge striped sun over a grid horizon, palm silhouettes, purple to orange gradient sky, chrome highlights.",
  "type": "italic chrome-like retro display headline"
 },
 {
  "name": "Cosmic space",
  "look": "Deep-space scene: nebula clouds, stars, a glowing planet, indigo and violet depth, subtle cosmic dust and light bloom.",
  "type": "wide airy modern sans with thin weight labels"
 },
 {
  "name": "Aurora gradient",
  "look": "Smooth blurred aurora mesh gradient with fine film grain, ultra-minimal, soft glowing color transitions, plenty of calm space for text.",
  "type": "clean medium sans, centered or left-aligned"
 },
 {
  "name": "Grain gradient",
  "look": "Noisy blurred color blobs with visible soft grain, modern poster mood, subtle shapes emerging from the gradient.",
  "type": "bold modern sans headline, tight tracking"
 },
 {
  "name": "Liquid abstract",
  "look": "Glossy fluid abstract shapes and marbled ink swirls flowing across the canvas, smooth reflections, rich saturated colors.",
  "type": "modern sans or elegant serif headline over calm area"
 },
 {
  "name": "Marble and gold",
  "look": "Veined white or black marble surface with gold foil lines and edges, refined shadow, premium and calm.",
  "type": "classic serif headline with spaced capitals"
 },
 {
  "name": "3D chrome typography",
  "look": "The headline itself rendered as huge glossy 3D letters (glass, chrome or inflated plastic) as the hero visual, simple backdrop.",
  "type": "chunky inflated 3D lettering for the headline, small sans for the rest"
 },
 {
  "name": "Glassmorphism light",
  "look": "Light airy scene: translucent frosted glass layers over colorful blurred shapes, soft white highlights, delicate borders.",
  "type": "clean contemporary sans, dark text"
 },
 {
  "name": "Neumorphism soft UI",
  "look": "Soft extruded shapes in a single tone with gentle light and dark shadows, tactile buttons and cards, quiet and tidy.",
  "type": "simple rounded sans"
 },
 {
  "name": "Dark dashboard UI",
  "look": "Product-dashboard look: dark UI panels, charts, metric cards and toggles floating in a tilted perspective, glowing accent highlights.",
  "type": "interface sans (Inter-like) with tabular numbers"
 },
 {
  "name": "Phone mockup showcase",
  "look": "A smartphone mockup with a relevant app-like screen floating at an angle next to the text, soft shadow, gradient backdrop.",
  "type": "modern sans, bold headline"
 },
 {
  "name": "Chat conversation",
  "look": "Messaging-app inspired layout: chat bubbles carrying the message in a conversation flow, small avatars-free UI chrome, relatable and social.",
  "type": "rounded messaging-app sans"
 },
 {
  "name": "Quote card",
  "look": "Typography-led quote card: very large opening quotation mark, headline treated as the quote, small attribution line, restrained palette.",
  "type": "large expressive serif or sans quote style"
 },
 {
  "name": "Testimonial stars",
  "look": "Review-card layout: five accent-color stars, quote-style headline, soft card on a clean background, trustworthy feel.",
  "type": "friendly clean sans with medium weight"
 },
 {
  "name": "Giant number hero",
  "look": "One oversized number or symbol as the main graphic, text compactly arranged around it, bold solid background, strong hierarchy.",
  "type": "ultra-bold numerals, compact sans"
 },
 {
  "name": "Split contrast",
  "look": "Two halves of the canvas with contrasting treatments (color vs. mono, before vs. after, dark vs. light) divided by a clean line.",
  "type": "bold sans, aligned to the dividing line"
 },
 {
  "name": "Icon grid infographic",
  "look": "Structured infographic: tidy grid of simple line icons with short labels, clear blocks and connectors, easy to scan.",
  "type": "clear sans with strong hierarchy"
 },
 {
  "name": "Timeline roadmap",
  "look": "A stepped path or timeline with numbered milestones leading to the call-to-action, clean connectors and nodes.",
  "type": "geometric sans with numbered steps"
 },
 {
  "name": "Versus comparison",
  "look": "Two-column comparison with clear contrast between the sides, check and cross marks, bold column headers.",
  "type": "bold sans headings, light body"
 },
 {
  "name": "Product spotlight",
  "look": "Single hero object on a seamless backdrop lit by a dramatic spotlight cone, soft floor reflection, theatrical focus.",
  "type": "clean luxury sans or serif"
 },
 {
  "name": "Pedestal podium",
  "look": "Minimal 3D geometric podiums and plinths in matte pastel tones showcasing a hero object, soft studio light.",
  "type": "rounded modern sans"
 },
 {
  "name": "Levitating objects",
  "look": "Subject objects floating weightlessly with soft cast shadows below on a smooth gradient, playful yet premium.",
  "type": "contemporary sans, medium weight"
 },
 {
  "name": "Flat-lay top view",
  "look": "Top-down flat-lay of curated props arranged with intention on a textured surface (linen, stone, wood), natural daylight.",
  "type": "simple editorial sans or serif"
 },
 {
  "name": "Macro texture hero",
  "look": "Extreme macro of a tactile material (fabric weave, stone, droplets, paper fibers) filling the frame with rich micro-detail and raking light.",
  "type": "minimal sans with generous letter-spacing"
 },
 {
  "name": "Dappled sunlight",
  "look": "Warm minimal wall with dappled leaf shadows and sunlight patches, soft linen tones, tranquil lifestyle mood.",
  "type": "light elegant serif or sans"
 },
 {
  "name": "Golden hour lifestyle",
  "look": "Candid lifestyle photograph in warm golden-hour light, natural imperfect framing, text placed on sky or wall area.",
  "type": "warm humanist sans"
 },
 {
  "name": "Urban street photo",
  "look": "Gritty documentary city photography with wheat-paste poster textures, concrete and layered signage, slight film grain.",
  "type": "condensed grotesque, uppercase"
 },
 {
  "name": "Graffiti wall",
  "look": "Spray-paint street art wall: stencil shapes, drips, tags and layered paint textures in vivid colors.",
  "type": "spray-painted or stencil lettering for the headline"
 },
 {
  "name": "Sticker bomb",
  "look": "Dense layered sticker collage with die-cut white borders, bold outlines, and a clear calm area reserved for text.",
  "type": "bold playful display type"
 },
 {
  "name": "Die-cut sticker",
  "look": "One big glossy die-cut sticker style hero with a thick white outline and subtle peel highlight on a flat color background.",
  "type": "rounded bold sans"
 },
 {
  "name": "Badges and ribbons",
  "look": "Promo layout with award-style badges, ribbons and a starburst, clean and celebratory without clutter.",
  "type": "bold sans with ribbon-banner labels"
 },
 {
  "name": "Sale explosion",
  "look": "Urgent retail promotion: bold red and yellow burst shapes, price-tag styling, angled banners, high energy.",
  "type": "heavy condensed sans capitals"
 },
 {
  "name": "Islamic geometric",
  "look": "Refined Islamic geometric patterns: interlaced star motifs, crescent, lantern shapes, deep green or midnight blue with gold, respectful and elegant.",
  "type": "elegant Arabic-style display or classical serif"
 },
 {
  "name": "Arabic calligraphy art",
  "look": "Large flowing calligraphic flourish as the visual centerpiece within an ornate arch or frame, rich deep colors with gold ink.",
  "type": "calligraphic headline style with clean supporting text"
 },
 {
  "name": "Zellige tile mosaic",
  "look": "North-African zellige tile mosaic patterns in cobalt, turquoise, white and the accent color, crisp geometry framing the text area.",
  "type": "modern clean sans or Kufi-inspired headline"
 },
 {
  "name": "Mediterranean coast",
  "look": "Bright Mediterranean light: whitewashed walls, blue doors and shutters, bougainvillea, deep blue sea, crisp sunshine.",
  "type": "friendly humanist sans"
 },
 {
  "name": "Sahara dunes",
  "look": "Minimal desert landscape: sculpted dunes, long soft shadows, warm sand to rust palette, vast calm sky.",
  "type": "light wide sans"
 },
 {
  "name": "Andalusian arches",
  "look": "Warm terracotta arches and archways framing the subject, carved patterns, soft afternoon light.",
  "type": "elegant serif headline"
 },
 {
  "name": "Artisan souk",
  "look": "Handcrafted market mood: woven textiles, brass, pottery and hand-stitched patterns in warm saturated tones.",
  "type": "warm serif or hand-cut lettering"
 },
 {
  "name": "Elegant floral wedding",
  "look": "Soft romantic florals in blush, ivory and gold, delicate watercolor or photographic blooms, airy veil-like layers.",
  "type": "graceful script headline with refined serif body"
 },
 {
  "name": "Festive confetti",
  "look": "Celebration scene: confetti, streamers, balloons and sparkle on a vibrant background, joyful and energetic.",
  "type": "bold rounded display headline"
 },
 {
  "name": "Kids pastel cartoon",
  "look": "Cute pastel world for children: clouds, stars, smiling shapes, soft rounded characters-free elements, gentle colors.",
  "type": "bubbly rounded font headline"
 },
 {
  "name": "Montessori natural",
  "look": "Calm Montessori aesthetic: natural wooden toys, muted earth tones, simple shapes, soft daylight, uncluttered.",
  "type": "soft rounded sans, calm spacing"
 },
 {
  "name": "Chalkboard",
  "look": "Slate chalkboard texture with hand-drawn chalk illustrations, dust smudges and underlines, classroom charm.",
  "type": "chalk lettering headline, chalk handwriting body"
 },
 {
  "name": "School notebook",
  "look": "Lined or squared notebook page with highlighter marks, margin doodles, paper clips and sticky notes, studious and friendly.",
  "type": "handwriting plus neat marker headline"
 },
 {
  "name": "Sticky-note board",
  "look": "Cork or pastel board covered with colorful sticky notes, pins and string, organized brainstorming energy.",
  "type": "marker handwriting on notes, bold sans headline"
 },
 {
  "name": "Sport dynamic",
  "look": "Athletic energy: sharp diagonal slashes, motion blur trails, powerful cropped subject, high contrast with a vivid accent.",
  "type": "heavy italic condensed sports display type"
 },
 {
  "name": "Gym rim light",
  "look": "Dark gym atmosphere, strong rim lighting on equipment or silhouette, chalk dust, gritty and determined.",
  "type": "bold condensed uppercase sans"
 },
 {
  "name": "Food editorial",
  "look": "Overhead or three-quarter editorial food photography on a rustic table, fresh ingredients, natural window light, appetizing color.",
  "type": "warm serif headline with simple sans"
 },
 {
  "name": "Coffee kraft",
  "look": "Warm cafe vibe: kraft paper, coffee rings, chalk menu touches, steam and ceramic cups, cozy browns.",
  "type": "vintage slab or hand-drawn menu lettering"
 },
 {
  "name": "Beauty soft glow",
  "look": "Soft cosmetic beauty look: blush and nude tones, glossy product curves, water droplets and petals, luminous skin-like light.",
  "type": "delicate high-end serif or thin sans"
 },
 {
  "name": "Fashion lookbook",
  "look": "Clean fashion lookbook: large crops of fabric and garment details, lots of white space, tiny index-style labels, refined.",
  "type": "minimal elegant serif or fine sans in capitals"
 },
 {
  "name": "Streetwear drop",
  "look": "Streetwear release poster: stark black and white, barcode and tag labels, oversized crop, one hot accent color, raw grid.",
  "type": "oversized grotesque and stencil labels"
 },
 {
  "name": "Premium real estate",
  "look": "Architectural exterior or interior at twilight, warm lit windows, clean frame, small gold label chips, aspirational calm.",
  "type": "refined serif headline with clean sans"
 },
 {
  "name": "Corporate clean",
  "look": "Professional business look: crisp white and navy, simple abstract wave or geometric shapes, structured alignment, trustworthy.",
  "type": "corporate sans, medium to bold"
 },
 {
  "name": "Fintech trust",
  "look": "Deep green or blue backdrop with subtle rising line charts and smooth gradient curves, secure and modern, restrained.",
  "type": "modern sans with strong numerals"
 },
 {
  "name": "Health clean",
  "look": "Calm healthcare aesthetic: white, soft teal and sky tones, gentle rounded shapes, light airy photography, reassuring.",
  "type": "friendly rounded sans"
 },
 {
  "name": "AI neural mesh",
  "look": "Abstract glowing network of nodes and connections, luminous mesh in the accent color on deep background, intelligent and futuristic.",
  "type": "wide modern sans, light and bold mix"
 },
 {
  "name": "Sound waveform",
  "look": "Sound waves and audio waveform bars as the core graphic, equalizer glow, microphone or speaker hints, rhythm and voice energy.",
  "type": "bold rounded sans, vibrant"
 },
 {
  "name": "Podcast on-air",
  "look": "Podcast and radio studio feel: microphone, headphones, on-air glow circle, warm dark studio, bold circular framing.",
  "type": "bold sans headline, small mono labels"
 },
 {
  "name": "Film production",
  "look": "Filmmaker's world: cinematic letterbox bars, film strip edges, camera and lens silhouettes, moody grade and soft light.",
  "type": "tracked cinematic capitals"
 },
 {
  "name": "Typographic only",
  "look": "No imagery: the type is the art — enormous letterforms, tight stacking, two-color palette, confident rhythm and scale contrast.",
  "type": "oversized tightly-set grotesque or serif headline"
 }
];

// Description visuelle des polices (un modèle d'image n'a pas les fichiers de police : on décrit le style)
const FONT_LOOK: Record<string, string> = {
  'Playfair Display': 'high-contrast elegant serif', 'Cormorant Garamond': 'delicate refined old-style serif', 'DM Serif Display': 'bold soft display serif',
  'Marcellus': 'classical flared Roman capitals', 'Cinzel': 'inscriptional Roman capitals serif', 'Fraunces': 'soft quirky wonky serif',
  'Libre Baskerville': 'classic book serif', 'Lora': 'warm calligraphic serif', 'Abril Fatface': 'ultra-bold fat-face didone serif',
  'Bebas Neue': 'tall condensed uppercase sans', 'Anton': 'heavy condensed uppercase sans', 'Archivo Black': 'heavy wide grotesque sans',
  'Oswald': 'condensed gothic sans', 'League Spartan': 'bold geometric sans', 'Alfa Slab One': 'heavy slab serif', 'Space Grotesk': 'quirky modern grotesque sans',
  'El Messiri': 'modern Arabic display with calligraphic touch', 'Changa': 'bold modern Arabic sans', 'Lalezar': 'heavy playful Arabic display',
  'Reem Kufi': 'geometric Kufi Arabic', 'Noto Kufi Arabic': 'clean Kufi Arabic', 'Amiri': 'classical Naskh Arabic serif', 'Markazi Text': 'traditional Arabic text serif',
  'Dancing Script': 'flowing casual script', 'Great Vibes': 'formal elegant calligraphic script', 'Caveat': 'handwritten marker script', 'Pacifico': 'rounded retro brush script',
  'Inter': 'neutral clean sans', 'Manrope': 'modern semi-rounded sans', 'Outfit': 'geometric friendly sans', 'Sora': 'wide modern tech sans', 'Urbanist': 'sleek geometric sans',
  'Plus Jakarta Sans': 'contemporary clean sans', 'Work Sans': 'sturdy grotesque sans', 'Figtree': 'friendly geometric sans', 'Public Sans': 'neutral institutional sans',
  'Nunito Sans': 'soft rounded-terminal sans', 'Poppins': 'geometric rounded sans', 'Quicksand': 'light rounded sans', 'Baloo 2': 'chunky rounded playful sans',
  'Fredoka': 'bubbly rounded sans', 'Comfortaa': 'rounded geometric sans', 'JetBrains Mono': 'developer monospace', 'IBM Plex Mono': 'technical monospace',
  'Space Mono': 'retro-futuristic monospace', 'Merriweather': 'sturdy readable serif', 'Newsreader': 'editorial text serif', 'Source Serif 4': 'neutral text serif',
  'Epilogue': 'bold contemporary grotesque', 'Cairo': 'clean modern Arabic sans', 'Tajawal': 'light modern Arabic sans', 'Almarai': 'simple modern Arabic sans',
  'Mada': 'neutral Arabic sans', 'Readex Pro': 'readable modern Arabic sans', 'IBM Plex Sans Arabic': 'technical Arabic sans', 'Scheherazade New': 'traditional Naskh Arabic',
};

// Valeurs par défaut du Brand Kit : jamais écrites dans le visuel (ce sont des placeholders)
const DEFAULT_BRAND_NAMES = new Set(['aura studio', 'ma marque', 'my brand', 'علامتي', 'votre marque', 'your brand']);
const DEFAULT_BRAND_HANDLES = new Set(['@aurastudio.ai', '@aurastudio', '@marque', '@brand']);

function buildImagePrompt(body: Record<string, unknown>, lang: string, hasRefs: boolean, hasProduct: boolean): string | null {
  const slide = body.slide as Record<string, unknown> | undefined;
  const style = body.style === 'light' ? 'light' : 'dark';
  const format = typeof body.format === 'string' ? body.format : '';
  if (!slide || !VALID_FORMATS.has(format)) return null;
  const aspect = FORMAT_ASPECT[format];
  const slideNumber = asInt(slide.slideNumber, 1, 50) ?? 1;
  const total = asInt(body.total, 1, 50) ?? 1;
  const variant = asInt(body.variant, 0, 9999) ?? 0;
  const brief = asStr(body.brief, 0, 400) ?? '';

  const title = asStr(slide.title, 0, 140) ?? '';
  const tag = asStr(slide.tag, 0, 60) ?? '';
  const subtitle = asStr(slide.subtitle, 0, 260) ?? '';
  const highlight = asStr(slide.highlightWord, 0, 40) ?? '';
  const cta = asStr(slide.ctaText, 0, 60) ?? '';
  const bullets = Array.isArray(slide.bulletPoints)
    ? (slide.bulletPoints as unknown[]).map((b) => asStr(b, 1, 120)).filter((b): b is string => !!b).slice(0, 3)
    : [];

  const brand = body.brand as Record<string, unknown> | undefined;
  const brandColor = /^#[0-9a-fA-F]{6}$/.test(String(brand?.color ?? '')) ? String(brand?.color) : '#F59E0B';
  // Le nom / @handle du Brand Kit n'est écrit dans le visuel que s'il a été personnalisé (pas les placeholders par défaut)
  const rawName = asStr(brand?.name, 1, 40) ?? '';
  const rawHandle = asStr(brand?.handle, 1, 40) ?? '';
  const brandName = rawName && !DEFAULT_BRAND_NAMES.has(rawName.toLowerCase()) ? rawName : '';
  const brandHandle = rawHandle && !DEFAULT_BRAND_HANDLES.has(rawHandle.toLowerCase()) ? rawHandle : '';

  // Polices : uniquement si choisies dans le Brand Kit, sinon la direction artistique décide
  const fonts = body.fonts as Record<string, unknown> | undefined;
  const fTitle = typeof fonts?.title === 'string' && VALID_FONT_NAMES.has(fonts.title) ? fonts.title : '';
  const fBody = typeof fonts?.body === 'string' && VALID_FONT_NAMES.has(fonts.body) ? fonts.body : '';

  const dir = ART_DIRECTIONS[variant % ART_DIRECTIONS.length];
  const q = (v: string) => JSON.stringify(v);
  const rtl = lang === 'ar';

  const prof = body.profile as Record<string, unknown> | undefined;
  const pt = asStr(prof?.productType, 1, 120);
  const th = asStr(prof?.theme, 1, 120);

  const lines: string[] = [
    'You are a world-class art director and graphic designer. Deliver ONE single, FINISHED, ready-to-publish social media design as a flat image, in aspect ratio ' + aspect + '. All the text below must be rendered inside the image itself, perfectly spelled.',
    ...(brief ? ['', 'CLIENT BRIEF (highest priority — if it states a style, mood, colors or visual idea, follow it over the art direction below): ' + q(brief)] : []),
    '',
    '=== ART DIRECTION: ' + dir.name + ' ===',
    dir.look,
    'This look must be unmistakable. Do NOT fall back to a generic centered rounded card or a dark card on a dark background.',
    '',
    '=== TEXT TO RENDER (exact, character for character, in ' + (LANG_NAMES[lang] ?? 'français') + (rtl ? ', right-to-left, correctly connected Arabic letters' : '') + ') ===',
    ...(brandName ? ['- Brand name (small): ' + q(brandName)] : []),
    ...(total > 1 ? ['- Slide counter (small): ' + q(String(slideNumber).padStart(2, '0') + ' / ' + String(total).padStart(2, '0'))] : []),
    ...(tag ? ['- Small label above the headline (uppercase, accent color): ' + q(tag)] : []),
    '- HEADLINE (largest text, maximum 3 lines): ' + q(title) + (highlight && title.includes(highlight) ? ' — render the word ' + q(highlight) + ' in the accent color' : ''),
    ...(subtitle ? ['- Subtitle (medium, highly readable): ' + q(subtitle)] : []),
    ...(bullets.length ? ['- Short checklist, one line each, with a small check icon: ' + bullets.map(q).join(' | ')] : []),
    ...(cta ? ['- Call-to-action button (accent color fill, bold): ' + q(cta)] : []),
    ...(brandHandle ? ['- Handle (small): ' + q(brandHandle)] : []),
    'Do not add, translate, abbreviate or invent ANY other text, number, brand name, logo or watermark' + (brandName ? '' : ' (in particular, no brand name or studio name anywhere)') + '. Every letter must be sharp and legible' + (rtl ? '; Arabic must read right-to-left with correct letter shaping' : '') + '.',
    '',
    '=== TYPOGRAPHY ===',
    fTitle || fBody
      ? 'Headline in ' + (fTitle ? (FONT_LOOK[fTitle] || 'a bold display font') + ' (like ' + fTitle + ')' : dir.type) + '; body text in ' + (fBody ? (FONT_LOOK[fBody] || 'a clean sans') + ' (like ' + fBody + ')' : 'a clean sans') + '.'
      : 'Typography for this art direction: ' + dir.type + '.',
    'Clear hierarchy: headline > subtitle > checklist > small labels' + (rtl ? ', text right-aligned' : '') + '.',
    '',
    '=== COMPOSITION & COLOR ===',
    '- Safe margin of at least 8% on every side: no text touches or crosses the frame edge.',
    '- Strong contrast between text and background everywhere.',
    style === 'light'
      ? '- Theme: LIGHT. Bright, luminous overall impression, dark text.'
      : '- Theme: DARK. Deep, rich overall impression, light text.',
    '- Accent color ' + brandColor + ': use it for the label, the highlighted word, the icons and the button.',
    '- Include ONE strong visual that evokes the subject (never literal clip-art), placed so it never covers the text.',
    '',
    'Subject of the design: ' + [tag, title, subtitle].filter(Boolean).join(' — '),
    ...(pt || th ? ['Brand universe: ' + (pt ? 'product type ' + pt : '') + (pt && th ? ', ' : '') + (th ? th + ' aesthetic' : '') + ' — stay consistent with this identity.'] : []),
    ...(hasProduct
      ? [
          '',
          'PRODUCT FIDELITY CONTRACT — the FIRST attached image(s) show a REAL product from the user\'s shop:',
          '- Show THIS EXACT product as the hero visual. Preserve it 100%: exact shape, proportions, colors, label text, logo placement, materials and finish.',
          '- Do NOT redraw, redesign, recolor or distort the product. Integrate it with a soft realistic contact shadow and correct scale.',
        ]
      : []),
    ...(hasRefs && !hasProduct
      ? ['', 'Reference images are attached: match their visual style, mood, color palette and material feel. They are STYLE GUIDANCE ONLY — never copy their text, logos or faces.']
      : []),
  ];
  return lines.join('\n');
}

// Extrait { mime, data } d'un data URL (le vrai MIME, pas un jpeg codé en dur)
function parseDataUrl(r: string): { mime: string; data: string } {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/.exec(r);
  return { mime: m ? m[1] : 'image/jpeg', data: r.slice(r.indexOf(',') + 1) };
}

async function handleImage(apiKey: string, body: Record<string, unknown>): Promise<Response> {
  const modelId = asStr(body.modelId, 3, 10) || 'flash';
  const format = asStr(body.format, 1, 20) || '';
  const style = body.style === 'light' ? 'light' : 'dark';
  const lang = asStr(body.lang, 2, 2) || 'fr';

  if (!VALID_MODELS.has(modelId) || !VALID_FORMATS.has(format) || !VALID_STYLES.has(style)) {
    return json({ error: 'invalid_payload' }, 400);
  }

  // Photos PRODUIT (fidélité 100 %) séparées des références de style
  const products = Array.isArray(body.productImages)
    ? (body.productImages as unknown[])
        .filter((r): r is string => typeof r === 'string' && r.startsWith('data:image/') && r.length <= 300_000)
        .slice(0, 2)
    : [];
  const styleRefs = Array.isArray(body.references)
    ? (body.references as unknown[])
        .filter((r): r is string => typeof r === 'string' && r.startsWith('data:image/') && r.length <= 300_000)
        .slice(0, 3)
    : [];
  const refs = hasProductInput(body) ? products : styleRefs;

  const imagePrompt = buildImagePrompt(body, lang, styleRefs.length > 0, products.length > 0);
  if (!imagePrompt) return json({ error: 'invalid_payload' }, 400);

  const aspect = FORMAT_ASPECT[format];
  const size = IMAGE_SIZE[modelId];
  const candidates = MODEL_CANDIDATES[modelId];

  // On essaie les noms de modèles candidats. Un 404 (modèle introuvable)
  // permet de passer au candidat suivant — une requête 404 ne génère rien
  // et n'est pas facturée. Aucun autre retry.
  const inputImages = [...products, ...(products.length > 0 ? styleRefs.slice(0, 2) : styleRefs)].map(parseDataUrl);
  // image_size n'est supporté que par les modèles Gemini 3 (pas gemini-2.5-flash-image)
  const sendSize = modelId !== 'flash';

  // Gemini 3 (modèles "thinking") peut renvoyer des images intermédiaires (thought: true) :
  // on les ignore et on prend la dernière image finale.
  const extractImage = (data: any): { mime: string; b64: string } | null => {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return null;
    let found: { mime: string; b64: string } | null = null;
    for (const p of parts) {
      if (p?.thought === true) continue;
      const inl = p?.inlineData || p?.inline_data;
      const d = inl?.data;
      if (typeof d === 'string' && d.length > 0) {
        found = { mime: String(inl?.mimeType || inl?.mime_type || 'image/png'), b64: d };
      }
    }
    return found;
  };
  // Raison d'un refus (sécurité, texte à la place de l'image…) pour le diagnostic
  const explainEmpty = (data: any): string => {
    const reason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || '';
    const txt = (data?.candidates?.[0]?.content?.parts || []).find((p: any) => typeof p?.text === 'string')?.text || '';
    return `${reason} ${String(txt).slice(0, 300)}`.trim();
  };

  let lastStatus = 502;
  let lastDetail = '';
  const imgCfg = { aspectRatio: aspect, ...(sendSize ? { imageSize: size } : {}) };
  // Variantes de config image : imageConfig (accepte 4:5), puis responseFormat.image, puis sans config (ratio demandé dans le prompt).
  // Un 400 = requête rejetée, non facturée : on tente la variante suivante.
  const variants: Record<string, unknown>[] = [{ imageConfig: imgCfg }, { responseFormat: { image: imgCfg } }, {}];

  for (const model of candidates) {
    let notFound = false;
    for (const variant of variants) {
      const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  ...inputImages.map((im) => ({ inline_data: { mime_type: im.mime, data: im.data } })),
                  { text: imagePrompt },
                ],
              },
            ],
            generationConfig: { responseModalities: ['IMAGE'], ...variant },
          }),
        },
        90000
      );

      if (res.ok) {
        let data: unknown;
        try {
          data = await res.json();
        } catch {
          return json({ error: 'image_invalid_response' }, 502);
        }
        const img = extractImage(data);
        if (!img) {
          const why = explainEmpty(data);
          console.error('image missing', model, why);
          return json({ error: 'image_missing', detail: why }, 502);
        }
        return json({ configured: true, stage: 'image', model, image: `data:${img.mime};base64,${img.b64}` });
      }

      lastStatus = res.status;
      const errText = await res.text().catch(() => '');
      lastDetail = errText.slice(0, 1500);
      console.error('image upstream error', model, res.status, Object.keys(variant)[0], lastDetail);
      notFound = res.status === 404 || /not found|not_found/i.test(lastDetail);
      if (res.status !== 400) break; // quota, safety, timeout : pas de variante suivante
    }
    if (!notFound) break;
  }

  return json({ error: 'image_upstream', status: lastStatus, detail: lastDetail }, 502);
}

// ============================================================
// Entrée unique
// ============================================================
export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  const apiKey = env.GEMINI_API_KEY;
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';

  if (!apiKey) {
    // Dégradation gracieuse : le client bascule en mode démo local.
    return json({ configured: false, error: 'GEMINI_API_KEY non configurée sur Cloudflare' });
  }

  const body = await readJson(request, 600_000);
  if (!body) return json({ error: 'invalid_payload' }, 400);

  const stage = body.stage;
  try {
    if (stage === 'copy') {
      if (!rateLimit(ip, 10, 60_000)) return json({ error: 'rate_limited' }, 429);
      return await handleCopy(apiKey, body);
    }
    if (stage === 'image') {
      if (!rateLimit(ip, 30, 60_000)) return json({ error: 'rate_limited' }, 429);
      return await handleImage(apiKey, body);
    }
    return json({ error: 'unknown_stage' }, 400);
  } catch (err) {
    const aborted = err instanceof Error && (err.name === 'AbortError' || /abort/i.test(err.message));
    return json({ error: aborted ? 'timeout' : 'server_error' }, aborted ? 504 : 500);
  }
};
