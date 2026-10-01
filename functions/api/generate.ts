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

// ---------- Verrouillage de langue (le client est roi) ----------
// Si le brief demande explicitement une langue — ou s'il est simplement écrit en
// arabe — cette langue écrase le réglage d'interface, pour les 2 étapes (copy + image).
function detectRequestedLang(text: string): string | null {
  const lowered = (text || '').toLowerCase();
  if (/arabe|arabic|darija|بالعربية|عربي/.test(lowered)) return 'ar';
  if (/anglais|english/.test(lowered)) return 'en';
  if (/français|francais|french/.test(lowered)) return 'fr';
  if (/[\u0600-\u06FF]/.test(text || '')) return 'ar';
  return null;
}

/** Tout le texte utile d'une requête (brief + slide + profil) : langue et domaine s'en déduisent. */
function collectBriefText(body: Record<string, unknown>): string {
  const slide = (body.slide || {}) as Record<string, unknown>;
  const prof = (body.profile || {}) as Record<string, unknown>;
  return [body.prompt, body.brief, slide.tag, slide.title, slide.subtitle, slide.ctaText, prof.productType, prof.theme]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join(' \n ');
}

// Polices arabes : seules acceptées quand la langue verrouillée est l'arabe.
const ARABIC_TITLE_FONTS = [
  'El Messiri', 'Changa', 'Lalezar', 'Reem Kufi', 'Noto Kufi Arabic', 'Amiri', 'Markazi Text', 'Scheherazade New',
];
const ARABIC_BODY_FONTS = [
  'Cairo', 'Tajawal', 'Almarai', 'Mada', 'Readex Pro', 'IBM Plex Sans Arabic',
];
const ARABIC_FONTS = new Set([...ARABIC_TITLE_FONTS, ...ARABIC_BODY_FONTS]);
const AR_TITLE_FALLBACK = 'Cairo';
const AR_BODY_FALLBACK = 'Tajawal';

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
- LANGUE VERROUILLÉE (le client est roi — ordre absolu) : TOUT le copywriting (tag, title, subtitle, bulletPoints, ctaText, highlightWord) est rédigé EXCLUSIVEMENT en ${LANG_NAMES[lang] ?? 'français'}, aucun mot d'une autre langue.${lang === 'ar' ? " Écriture arabe complète et naturelle, jamais de franco-arabe en caractères latins ni de translittération." : ''}${profileLine}.

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

MENU DE POLICES (obligatoirement issues de cette liste${lang === 'ar' ? ' — couples 100 % arabes, seuls valides pour cette langue verrouillée' : ''})
Polices de TITRES (display/serif) : ${(lang === 'ar' ? ARABIC_TITLE_FONTS : TITLE_FONTS).join(', ')}
Polices de TEXTES (sans/lecture) : ${(lang === 'ar' ? ARABIC_BODY_FONTS : BODY_FONTS).join(', ')}
${lang === 'ar'
  ? "Toutes les polices sont arabes : choisis le couple le plus juste pour le sujet (par ex. luxe -> Amiri + Cairo ; moderne -> Changa + Tajawal ; impact -> Lalezar + Cairo ; élégant -> El Messiri + Readex Pro)."
  : "Choisis le couple le plus cohérent avec le sujet et l'ambiance (ex: luxe -> Playfair Display + Inter ; tech -> Space Grotesk + Manrope ; fun -> Baloo 2 + Nunito Sans ; affiche/sport -> Bebas Neue + Work Sans)."}

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
  // Langue arabe verrouillée : seules les polices arabes sont acceptées,
  // sinon retour aux valeurs sûres Cairo / Tajawal.
  const fontAllowed = (v: unknown): v is string => typeof v === 'string' && (lang === 'ar' ? ARABIC_FONTS : VALID_FONT_NAMES).has(v);
  const fonts = {
    title: fontAllowed(rawFonts.title) ? rawFonts.title : lang === 'ar' ? AR_TITLE_FALLBACK : 'Space Grotesk',
    body: fontAllowed(rawFonts.body) ? rawFonts.body : lang === 'ar' ? AR_BODY_FALLBACK : 'Inter',
  };
  return json({ configured: true, stage: 'copy', design: { title: design.title || '', fonts, slides } });
}

// ============================================================
// STAGE 'image' : 1 image (API Interactions, Nano Banana)
// ============================================================

// ---------- Moteur de directions artistiques combinatoire ----------
// Le client ne choisit RIEN : la direction artistique de chaque slide est tirée
// de façon déterministe (même brief + même slide = même direction) dans des pools
// indépendants, puis injectée dans le prompt image.
//
//   AD_STYLES (40) × compositions (16) × lumières (14) × palettes (24)
//   × matières (12) × traitements du sujet (10) × humeurs typo (14)
//   = 361 267 200 combinaisons ≈ 361 millions
//   × couples de polices (28 titres × 24 textes = 672)
//   ≈ 242,8 milliards de directions artistiques possibles.

/** Hash FNV-1a 32 bits : transforme un brief en graine stable. */
function hashStr(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** RNG déterministe (mulberry32) : même graine → même séquence. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AD_STYLES: { n: string; d: string }[] = [
  { n: 'Editorial Magazine', d: 'high-end editorial magazine language: generous negative space, refined hierarchy, confident crop' },
  { n: 'Swiss Grid', d: 'Swiss/International style: strict grid, grotesque neutrality, ruthless clarity' },
  { n: 'Brutalist Structure', d: 'brutalist graphic language: raw structure, oversized blocks, unpolished energy' },
  { n: 'Luxury Noir', d: 'luxury noir: deep black field, restrained metallic accents, couture restraint' },
  { n: 'Cinematic Teaser', d: 'cinematic teaser frame: wide anamorphic feel, moody grade, film-title tension' },
  { n: 'Neo-Brutalist Pop', d: 'neo-brutalist pop: thick outlines, flat vivid fills, playful shock' },
  { n: 'Retro 70s', d: '1970s retro: warm earthy inks, rounded geometry, groovy rhythm' },
  { n: 'Art Deco', d: 'art deco: symmetric ornament, fan and stepped motifs, gilded geometry' },
  { n: 'Japanese Minimal', d: 'Japanese minimalism: ma (negative space), quiet asymmetry, paper calm' },
  { n: 'Risograph', d: 'risograph print: two-ink overprint, grainy texture, visible halftone dots' },
  { n: 'Newspaper', d: 'vintage newspaper: columns, masthead rules, ink-on-newsprint texture' },
  { n: 'Constructivist', d: 'constructivist poster: diagonal dynamics, red and black blocks, agitprop punch' },
  { n: 'Y2K Chrome', d: 'Y2K chrome: liquid metal, specular highlights, early-2000s optimism' },
  { n: 'Vaporwave', d: 'vaporwave: pastel neon gradients, grid horizons, retro digital dream' },
  { n: 'Organic Artisanal', d: 'organic artisanal: hand-made textures, natural imperfections, warm craft' },
  { n: 'Food Magazine', d: 'food magazine: appetizing close-ups, styled props, editorial appetite' },
  { n: 'Streetwear Drop', d: 'streetwear drop: bold graphic energy, urban attitude, hype rhythm' },
  { n: 'Corporate Clean', d: 'corporate clean: calm authority, precise alignment, trustworthy restraint' },
  { n: 'Startup Pitch', d: 'startup pitch: crisp data-forward layout, modern SaaS confidence' },
  { n: 'Fitness Impact', d: 'fitness impact: sweat and motion, high-contrast grit, motivational force' },
  { n: 'Kids Playful', d: 'kids playful: rounded shapes, bright primaries, joyful chaos kept under control' },
  { n: 'Fashion Runway', d: 'fashion runway: editorial attitude, seasonal palette, movement' },
  { n: 'Real Estate Premium', d: 'real estate premium: architectural calm, wide volumes, aspirational light' },
  { n: 'Automotive Garage', d: 'automotive garage: metal and oil, engineered drama, motion-ready stance' },
  { n: 'Beauty Editorial', d: 'beauty editorial: flawless macro detail, cosmetic elegance, soft glamour' },
  { n: 'Education Friendly', d: 'education friendly: clear structure, approachable clarity, encouraging tone' },
  { n: 'Event Invitation', d: 'event invitation: ceremonial framing, elegant accents, save-the-date mood' },
  { n: 'Podcast Studio', d: 'podcast studio: warm acoustics, microphone silhouettes, late-night conversation mood' },
  { n: 'Travel Poster', d: 'travel poster: destination drama, warm sun, wanderlust geometry' },
  { n: 'Nature Calm', d: 'nature calm: botanical softness, breathing space, eco serenity' },
  { n: 'Handmade Market', d: 'handmade market: craft-fair charm, kraft paper, small-batch authenticity' },
  { n: 'Tech Noir', d: 'tech noir: dark surfaces, cool glints, precise machinery' },
  { n: 'Collage Zine', d: 'collage zine: cut-out layers, photocopied grit, DIY attitude' },
  { n: 'Soft Gradient', d: 'soft gradient modernism: airy color transitions, calm tech-brand softness' },
  { n: 'Monochrome Editorial', d: 'monochrome editorial: single-tone discipline, tonal nuance, timeless' },
  { n: 'Vintage Label', d: 'vintage label: apothecary emblem, letterpress feel, heritage packaging' },
  { n: 'Neon Night', d: 'neon night: wet reflections, saturated signage glow, nocturnal energy' },
  { n: 'Watercolor', d: 'watercolor: translucent washes, bleeding pigment edges, poetic softness' },
  { n: 'Blueprint', d: 'blueprint: technical linework, measured annotations, engineered precision' },
  { n: 'Maximal Pop', d: 'maximal pop: dense layered shapes, vivid contrast, joyful excess' },
];

const AD_COMPOSITIONS: string[] = [
  'centered hero with symmetric balance and a deliberately calm lower third',
  'off-center hero on the left third, breathing space reserved on the right',
  'diagonal split from bottom-left to top-right with dynamic tension',
  'top-heavy stack with a generous empty foreground',
  'frame-within-a-frame vignette, subject contained inside a soft inner border',
  'rule-of-thirds triple band composition, horizon on the lower third',
  'radial arrangement converging on one bright focal point',
  'flat-lay tabletop grid seen from directly above',
  'portrait crop with heavy negative space on one side',
  'layered depth: blurred foreground, sharp mid-ground subject, calm far background',
  'minimal corner composition with the subject pushed to one extreme corner',
  'full-bleed texture field with one small sculptural object',
  'vertical column rhythm, repeating upright elements with even spacing',
  'cinematic widescreen letterbox bands top and bottom',
  'overhead symmetric still life with mirrored props',
  'loose organic cluster held together by irregular spacing',
];

const AD_LIGHTS: string[] = [
  'one large softbox from the upper left with a gentle falloff',
  'late golden-hour sun raking from the side',
  'cool north-facing window light, soft and even',
  'hard direct light drawing crisp geometric shadows',
  'a single warm practical lamp in a dark room',
  'overcast daylight, shadowless and gentle',
  'backlit rim light with a soft halo',
  'a top-down light pool surrounded by darkness',
  'dappled light filtered through foliage',
  'low-key chiaroscuro with one bright edge',
  'light bounced off a warm wall, wrapped and intimate',
  'neon spill from off-frame signage in two colors',
  'a studio strip light sweeping across a glossy surface',
  'candle-warm ambient glow with deep falloff',
];

const AD_PALETTES: string[] = [
  'Amber Noir (#0B0B0E near-black, #F59E0B warm amber, #F5F1E8 bone white)',
  'Ivory Sage (#F7F4EC, #A8B5A0, #3F4A3C)',
  'Terracotta Sun (#E2725B, #F2C14E, #4A2E24)',
  'Midnight Cobalt (#0A1A3C, #2D6CDF, #E8EEF9)',
  'Blush Linen (#F4E3E1, #D98C8C, #6E4B4B)',
  'Forest Ink (#0E1F17, #1F7A4D, #DCE8DF)',
  'Sandstone (#E8DCC8, #C08457, #3B2F2A)',
  'Electric Berry (#2B0B3A, #E23CD1, #7CF5D5)',
  'Porcelain Blue (#F3F7FA, #7FA8C9, #23405C)',
  'Charcoal Gold (#17161A, #C9A227, #EFE7D3)',
  'Olive Cream (#EFEAD8, #7C8C4A, #2F3320)',
  'Coral Reef (#FF6B5A, #FFD3B6, #1D4E5F)',
  'Plum Velvet (#2A0F2E, #8E4A9B, #E9D5EC)',
  'Arctic Mint (#EAF7F4, #7ED9C3, #1E3D3A)',
  'Rust Navy (#1B2A41, #B7410E, #F0E6D8)',
  'Rose Powder (#FBE9EF, #E48AA7, #5C3A4A)',
  'Desert Dusk (#3A2C3F, #E08A5C, #F2D6B3)',
  'Steel Lime (#23272B, #A3E635, #E5E7EB)',
  'Espresso Cream (#2E2118, #C89F76, #F6EFE6)',
  'Ice Graphite (#E9EDF1, #6B7280, #111827)',
  'Marigold Ink (#1A1207, #F2A007, #FAEBD0)',
  'Sea Glass (#DCEEE9, #57A39B, #1F3B44)',
  'Crimson Bone (#F4EFE6, #A31621, #2B2B2B)',
  'Violet Haze (#241B3A, #9B7EDE, #F3EDFF)',
];

const AD_MATERIALS: string[] = [
  'matte uncoated paper with visible fiber',
  'soft-touch laminate with a whisper sheen',
  'brushed metal with a fine directional grain',
  'raw ceramic with a satin glaze',
  'frosted glass with diffused translucency',
  'warm natural linen with a visible weave',
  'polished stone with mineral veining',
  'kraft recycled board with a rough cut edge',
  'cast concrete with fine pores and chips',
  'high-gloss lacquer with clean reflections',
  'satin film with a subtle halation bloom',
  'hand-torn paper with a deckled edge',
];

const AD_TYPO_MOODS: string[] = [
  'editorial authority: high-contrast display headline with quiet lowercase support',
  'quiet luxury: thin wide letterspacing, small supporting text, restrained hierarchy',
  'bold protest: ultra-heavy condensed caps with tight leading and defiant scale',
  'friendly startup: geometric sans, medium weight, open spacing',
  'fashion editorial: oversized serif answered by hairline captions',
  'playful rounded: soft geometric forms with a bouncing baseline',
  'technical mono: monospaced labels, tabular rhythm, engineered calm',
  'heritage label: small caps, fine rules, centered stacking',
  'brutalist clash: mismatched weights deliberately colliding',
  'cinematic title: a thin uppercase line spread wide with generous tracking',
  'art deco geometry: symmetric caps punctuated by stepped ornaments',
  'handwritten warmth: a script accent over a clean sans base',
  'maximal poster: stacked condensed type filling the top half',
  'minimal whisper: one short line, tiny scale, massive negative space',
];

const AD_SUBJECT_TREATMENTS: string[] = [
  'the subject photographed as a physical object under museum lighting',
  'the subject suggested through silhouette and shadow only',
  'the subject dissolved into abstract texture and color fields',
  'the subject staged as a miniature diorama with tilt-shift depth',
  'the subject isolated on a seamless studio backdrop with a soft contact shadow',
  'the subject caught mid-motion with a subtle directional blur',
  'the subject reflected on a glossy or watery surface',
  'the subject seen through frosted glass or translucent fabric',
  'the subject repeated as a rhythmic series with varying scale',
  'the subject reduced to a single symbolic prop standing for the whole idea',
];

// ---------- Détection de domaine (fr / en / ar) ----------
const AD_DOMAIN_WORDS: Record<string, string[]> = {
  podcast: ['podcast', 'voix off', 'voix-off', 'voice over', 'radio', 'microphone', 'interview', 'épisode', 'بودكاست', 'بودكاست', 'صوت', 'إذاعة', 'حوار', 'مقابلة'],
  food: ['pâtisserie', 'patisserie', 'boulangerie', 'restaurant', 'food', 'cuisine', 'gâteau', 'gateau', 'café', 'cafe', 'pizza', 'burger', 'chocolat', 'traiteur', 'مطعم', 'حلويات', 'مخبزة', 'طعام', 'قهوة', 'كيك', 'مأكولات'],
  fashion: ['mode', 'fashion', 'vêtement', 'vetement', 'clothing', 'lookbook', 'prêt-à-porter', 'boutique de vêtements', 'أزياء', 'ملابس', 'موضة', 'مجموعة أزياء'],
  tech: ['tech', 'startup', 'saas', 'application', 'app', 'logiciel', 'software', 'intelligence artificielle', 'digital', 'plateforme', 'تقنية', 'شركة ناشئة', 'تطبيق', 'برمجة', 'ذكاء اصطناعي', 'منصة'],
  realestate: ['immobilier', 'real estate', 'appartement', 'villa', 'maison', 'terrain', 'agence immobilière', 'promotion immobilière', 'عقار', 'عقارات', 'شقة', 'فيلا', 'منزل', 'بيع عقاري'],
  sport: ['sport', 'fitness', 'gym', 'salle de sport', 'musculation', 'coach sportif', 'entraînement', 'running', 'رياضة', 'لياقة', 'نادي رياضي', 'تدريب', 'كمال أجسام'],
  beauty: ['cosmétique', 'cosmetique', 'beauty', 'beauté', 'beaute', 'maquillage', 'parfum', 'skincare', 'soin', 'institut', 'تجميل', 'مكياج', 'عطر', 'عناية', 'مستحضرات'],
  kids: ['enfant', 'enfants', 'kids', 'bébé', 'bebe', 'jouet', 'crèche', 'école maternelle', 'أطفال', 'طفل', 'لعب', 'روضة', 'حضانة'],
  luxe: ['luxe', 'luxury', 'premium', 'haut de gamme', 'bijou', 'bijoux', 'joaillerie', 'orfèvrerie', 'فخامة', 'فاخر', 'راقٍ', 'ذهبي', 'مجوهرات'],
  events: ['mariage', 'wedding', 'événement', 'evenement', 'event', 'fête', 'anniversaire', 'invitation', 'séminaire', 'salon', 'زواج', 'حفل', 'عرس', 'مناسبة', 'دعوة', 'مؤتمر'],
  education: ['formation', 'cours', 'éducation', 'education', 'école', 'ecole', 'université', 'training', 'e-learning', 'académie', 'تعليم', 'دورة', 'تدريب', 'جامعة', 'مدرسة', 'محاضرة'],
  auto: ['auto', 'voiture', 'garage', 'mécanique', 'mecanique', 'carrosserie', 'pneu', 'automobile', 'concession', 'سيارات', 'سيارة', 'ورشة', 'ميكانيك', 'إطارات'],
};

// Styles privilégiés par domaine (indices dans AD_STYLES) — jamais imposés, juste favorisés.
const AD_DOMAIN_STYLES: Record<string, number[]> = {
  podcast: [27, 4, 10, 34],
  food: [15, 14, 30, 6],
  fashion: [21, 24, 3, 34],
  tech: [31, 33, 18, 17, 38],
  realestate: [22, 17, 0, 8],
  sport: [19, 16, 5, 2],
  beauty: [24, 3, 21, 33],
  kids: [20, 39, 5, 30],
  luxe: [3, 7, 34, 35, 8],
  events: [26, 7, 4, 37],
  education: [25, 33, 17, 9],
  auto: [23, 31, 2, 4],
};

/** Détecte le domaine du brief (fr/en/ar). Renvoie '' si aucun domaine clair. */
function detectDomain(text: string): string {
  const t = (text || '').toLowerCase();
  if (!t.trim()) return '';
  let best = '';
  let bestScore = 0;
  for (const [domain, words] of Object.entries(AD_DOMAIN_WORDS)) {
    let score = 0;
    for (const w of words) {
      if (t.includes(w)) score += w.length > 5 ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = domain;
    }
  }
  return bestScore > 0 ? best : '';
}

// ---------- Polices du moteur (latin + arabes) ----------
const AD_TITLE_FONTS = [
  'Playfair Display', 'Cormorant Garamond', 'DM Serif Display', 'Marcellus', 'Cinzel', 'Fraunces',
  'Libre Baskerville', 'Lora', 'Abril Fatface', 'Bebas Neue', 'Anton', 'Archivo Black', 'Oswald',
  'League Spartan', 'Alfa Slab One', 'Space Grotesk', 'Sora', 'Syne', 'Bricolage Grotesque',
  'Unbounded', 'Clash Display', 'Instrument Serif', 'Italiana', 'Gloock',
  'El Messiri', 'Changa', 'Lalezar', 'Reem Kufi',
];
const AD_BODY_FONTS = [
  'Inter', 'Manrope', 'Outfit', 'Urbanist', 'Plus Jakarta Sans', 'Work Sans', 'Figtree', 'Public Sans',
  'Nunito Sans', 'Poppins', 'Quicksand', 'Baloo 2', 'Fredoka', 'Comfortaa', 'JetBrains Mono',
  'IBM Plex Mono', 'Space Mono', 'Merriweather', 'Newsreader', 'Source Serif 4', 'Epilogue',
  'Noto Kufi Arabic', 'Amiri', 'Markazi Text',
];
// Couples 100 % arabes (langue verrouillée) — incluent Scheherazade New côté titres.
const AD_AR_TITLE_FONTS = ['El Messiri', 'Changa', 'Lalezar', 'Reem Kufi', 'Amiri', 'Markazi Text', 'Scheherazade New', 'Noto Kufi Arabic'];
const AD_AR_BODY_FONTS = ['Cairo', 'Tajawal', 'Almarai', 'Mada', 'Readex Pro', 'IBM Plex Sans Arabic'];

/**
 * Tire UNE direction artistique complète (un tirage par pool, RNG déterministe).
 * look = style + composition + lumière + palette + matière + traitement du sujet
 * type = humeur typographique + couple de polices (couples arabes si lang === 'ar')
 */
function pickDirection(seed: number, domain: string, lang: string): { name: string; look: string; type: string } {
  const rng = mulberry32(seed);
  const preferred = domain ? AD_DOMAIN_STYLES[domain] : undefined;

  // Le domaine privilégie un style 7 fois sur 10, sans jamais l'imposer.
  const styleIdx = preferred && rng() < 0.7
    ? preferred[Math.floor(rng() * preferred.length)]
    : Math.floor(rng() * AD_STYLES.length);
  const style = AD_STYLES[styleIdx];

  const composition = AD_COMPOSITIONS[Math.floor(rng() * AD_COMPOSITIONS.length)];
  const light = AD_LIGHTS[Math.floor(rng() * AD_LIGHTS.length)];
  const palette = AD_PALETTES[Math.floor(rng() * AD_PALETTES.length)];
  const material = AD_MATERIALS[Math.floor(rng() * AD_MATERIALS.length)];
  const treatment = AD_SUBJECT_TREATMENTS[Math.floor(rng() * AD_SUBJECT_TREATMENTS.length)];
  const mood = AD_TYPO_MOODS[Math.floor(rng() * AD_TYPO_MOODS.length)];

  const titlePool = lang === 'ar' ? AD_AR_TITLE_FONTS : AD_TITLE_FONTS;
  const bodyPool = lang === 'ar' ? AD_AR_BODY_FONTS : AD_BODY_FONTS;
  const titleFont = titlePool[Math.floor(rng() * titlePool.length)];
  const bodyFont = bodyPool[Math.floor(rng() * bodyPool.length)];

  const paletteName = palette.split(' (')[0];
  const name = `${style.n} · ${paletteName}`;
  const look = [
    `Style: ${style.d}.`,
    `Composition: ${composition}.`,
    `Light: ${light}.`,
    `Palette: ${palette} — follow these colors as the image's color language.`,
    `Materials & finishes: ${material}.`,
    `Subject treatment: ${treatment}.`,
  ].join(' ');
  const type = lang === 'ar'
    ? `${mood}. Typography direction: ${titleFont} for headlines and ${bodyFont} for supporting text — full Arabic script, right-to-left, correctly connected letterforms, never Latin letters or transliteration.`
    : `${mood}. Typography direction: ${titleFont} for headlines and ${bodyFont} for supporting text.`;

  return { name, look, type };
}

function buildImagePrompt(body: Record<string, unknown>, lang: string, hasRefs: boolean, hasProduct: boolean): string | null {
  const slide = body.slide as Record<string, unknown> | undefined;
  const style = body.style === 'light' ? 'light' : 'dark';
  const format = typeof body.format === 'string' ? body.format : '';
  if (!slide || !VALID_FORMATS.has(format)) return null;
  const aspect = FORMAT_ASPECT[format];
  const slideNumber = asInt(slide.slideNumber, 1, 50) ?? 1;

  const title = asStr(slide.title, 0, 120) ?? '';
  const tag = asStr(slide.tag, 0, 60) ?? '';
  const subtitle = asStr(slide.subtitle, 0, 220) ?? '';

  const brand = body.brand as Record<string, unknown> | undefined;
  const brandColor = /^#[0-9a-fA-F]{6}$/.test(String(brand?.color ?? '')) ? String(brand?.color) : '#F59E0B';

  // ---- DIRECTION ARTISTIQUE COMBINATOIRE (tirée côté serveur, le client ne choisit rien) ----
  const domain = detectDomain(`${body.prompt ?? ''} ${body.brief ?? ''} ${tag} ${title} ${subtitle}`);
  const variant = (hashStr(`${tag}|${title}|${subtitle}|${format}|${style}`) + slideNumber * 0x9e3779b1) >>> 0;
  const dir = pickDirection(variant, domain, lang);

  const lines = [
    // ---- RÔLE & MISSION ----
    'You are the photographer and art director of a premium brand shoot. Deliver ONE single photographic image: a BACKGROUND ARTWORK for a social media design.',
    'The artwork will be dimmed to ~15-20% opacity and placed BEHIND a text overlay. It is pure backdrop.',
    '',
    // ---- SUJET (inspiration, pas illustration littérale) ----
    `Subject inspiration (evoke, do not illustrate literally): ${tag ? `${tag} — ` : ''}${title}${subtitle ? `. Context: ${subtitle}` : ''}`,
    ...(() => {
      const prof = body.profile as Record<string, unknown> | undefined;
      const pt = asStr(prof?.productType, 1, 120);
      const th = asStr(prof?.theme, 1, 120);
      return pt || th ? [`Brand universe: ${pt ? `product type ${pt}` : ''}${pt && th ? ', ' : ''}${th ? `${th} aesthetic` : ''} — stay perfectly consistent with this identity.`] : [];
    })(),
    '',
    // ---- DIRECTION ARTISTIQUE (combinatoire, déterministe, anti-répétition) ----
    `ART DIRECTION for this frame — "${dir.name}"${domain ? ` (domain: ${domain})` : ''}. Follow it precisely:`,
    dir.look,
    `${dir.type} This typography direction is a briefing for the overlay that will be added later — do NOT render any text in the image.`,
    '',
    // ---- THÈME ----
    style === 'light'
      ? 'Theme: LIGHT editorial. Bright, airy, luminous composition; whites that stay clean white (never gray or washed out); soft daylight mood; low-contrast elegance.'
      : 'Theme: DARK editorial. Deep true blacks that keep rich shadow detail (never muddy gray); one confident light source; restrained specular highlights; luxurious night-shoot mood.',
    '',
    // ---- CONTRAT RÉALISME (anti look-IA) ----
    'Realism contract — this MUST look like a real photograph taken by a human photographer:',
    '- Rendered like a frame from a professional shoot on Kodak Portra 400 film: natural muted palette, gentle contrast curve, fine organic film grain.',
    '- True optical physics: physically correct shadow directions, natural light falloff, honest reflections, slight natural softness at frame edges.',
    '- Human imperfection: subtle asymmetry, micro dust or fiber details, materials with real wear. Nothing sterile, nothing plastic, nothing waxy.',
    '- Neutral true-to-life white balance (no yellow or teal cast), restrained saturation. No HDR, no bloom, no glow, no over-sharpening halos.',
    '- It must NOT look like CGI, a 3D render, a video game screenshot, AI art, vector art or an illustration.',
    '',
    // ---- COMPOSITION (contraintes de fond-de-texte) ----
    'Composition rules:',
    '- Exactly ONE focal point, placed off-center on a rule-of-thirds intersection. Never dead-center, never mirrored symmetry.',
    '- Maximum 1-3 visual elements. Zero clutter, zero repeated patterns.',
    '- The lower 45% of the frame stays visually calm (soft surface or gradient) so overlaid headlines remain readable.',
    '',
    // ---- COULEUR D'ACCENT ----
    `Weave the accent color ${brandColor} into ONE small detail only (a reflection, an object, a subtle light tint) — never as a dominant color.`,
    '',
    // ---- INTERDITS ABSOLUS ----
    ...(hasProduct
      ? [
          'PRODUCT FIDELITY CONTRACT — the FIRST attached image(s) show a REAL product from the user\'s shop:',
          '- Show THIS EXACT product in your scene. Preserve it 100%: exact shape, exact proportions, exact colors, exact label text and logo placement, exact materials and finish.',
          '- Do NOT redraw, redesign, restyle, warp, blur, recolor or reinterpret the product in any way. No invented packaging details, no distorted text on the label.',
          '- Integrate it as the hero of the composition with a soft realistic contact shadow and correct scale — professional commercial product photography.',
        ]
      : []),
    ...(hasRefs
      ? [
          "REFERENCE DESIGN CONTRACT — the attached images are the client's previous designs (their templates):",
          '- Extract their exact design DNA: layout grammar, color palette, typography feel, textures, framing, logo and handle placement.',
          '- Carry that DNA into this frame: same color language (hue family, contrast level, accent usage), same material and texture sensibility, same compositional rhythm (where the subject sits, how much empty space is kept, which zone stays visually calm for the overlay), same photographic mood and grade.',
          '- Reserve the same zones the templates use for the brand mark and the @handle (typically a small logo lockup and a bottom signature line) — keep them free of clutter so the mark lands exactly where it does on the client\'s existing designs.',
          '- These references are DESIGN GUIDANCE ONLY — never copy any text, face or exact logo artwork from them, and never introduce legible text into the output.',
        ]
      : []),
    ...(lang === 'ar'
      ? [
          'ABSOLUTE SCRIPT LOCK: every text is in ARABIC ONLY, real Arabic script (the Arabic Unicode block), never Latin letters, never transliteration, right-to-left direction, correctly shaped and connected letterforms with proper contextual forms.',
        ]
      : []),
    'Strictly forbidden: any text, letters, numbers, typography, captions, signatures, logos, watermarks, UI elements, borders, frames, split screens, collages, image grids, distorted faces, extra fingers, plastic skin, vignettes, light leaks, lens flares, fisheye distortion.',
  ];
  return lines.join('\n');
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
        .filter((r): r is string => typeof r === 'string' && r.startsWith('data:image/') && r.length <= 2_000_000)
        .slice(0, 3)
    : [];
  // Les modèles (templates) accompagnent TOUJOURS la génération, y compris avec
  // des photos produit : produit(s) d'abord (contrat de fidélité), puis modèles.
  const attachmentRefs = [...products, ...styleRefs];

  const imagePrompt = buildImagePrompt(body, lang, styleRefs.length > 0, products.length > 0);
  if (!imagePrompt) return json({ error: 'invalid_payload' }, 400);

  const aspect = FORMAT_ASPECT[format];
  const size = IMAGE_SIZE[modelId];
  const candidates = MODEL_CANDIDATES[modelId];

  // On essaie les noms de modèles candidats. Un 404 (modèle introuvable)
  // permet de passer au candidat suivant — une requête 404 ne génère rien
  // et n'est pas facturée. Aucun autre retry.
  let lastStatus = 502;
  for (const model of candidates) {
    const res = await fetchWithTimeout(
      'https://generativelanguage.googleapis.com/v1beta/interactions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          model,
          input: [
            ...attachmentRefs.map((r) => ({
              type: 'image',
              mime_type: (r.slice(5, r.indexOf(';')) || 'image/jpeg') as string,
              data: r.slice(r.indexOf(',') + 1),
            })),
            { type: 'text', text: imagePrompt },
          ],
          response_format: { type: 'image', mime_type: 'image/png', aspect_ratio: aspect, image_size: size },
        }),
      },
      90000
    );

    if (res.ok) {
      let data: {
        output_image?: { data?: string };
        steps?: { content?: { type?: string; data?: string }[] }[];
      };
      try {
        data = await res.json();
      } catch {
        return json({ error: 'image_invalid_response' }, 502);
      }
      let b64: string | undefined = data.output_image?.data;
      if (!b64 && Array.isArray(data.steps)) {
        for (const step of data.steps) {
          const found = step.content?.find((c) => c.type === 'image' && typeof c.data === 'string' && c.data.length > 0);
          if (found?.data) {
            b64 = found.data;
            break;
          }
        }
      }
      if (!b64) return json({ error: 'image_missing' }, 502);
      return json({ configured: true, stage: 'image', model, image: `data:image/png;base64,${b64}` });
    }

    lastStatus = res.status;
    const errText = await res.text().catch(() => '');
    const notFound = res.status === 404 || /not found|not_found|unsupported/i.test(errText.slice(0, 500));
    if (!notFound) break; // vraie erreur (quota, safety, timeout) : on ne force pas
  }

  return json({ error: 'image_upstream', status: lastStatus }, 502);
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

  // 12 Mo : les modèles (templates) et les photos produit voyagent en data URLs
  // dans le même payload que le prompt.
  const body = await readJson(request, 12_000_000);
  if (!body) return json({ error: 'invalid_payload' }, 400);

  // ---- LANGUE VERROUILLÉE (le client est roi) ----
  // Si le brief demande une langue (ou s'il est écrit en arabe), elle est imposée
  // AVANT les deux étapes : copywriting ET images sont donc dans la même langue.
  const forcedLang = detectRequestedLang(collectBriefText(body));
  if (forcedLang) body.lang = forcedLang;

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
