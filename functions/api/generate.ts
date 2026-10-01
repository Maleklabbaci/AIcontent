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

// ---------- Anti-répétition : 5 traitements photo rotationnés par numéro de slide ----------
// Nano Banana a tendance à produire des images quasi identiques pour des prompts
// similaires : on force un archétype de scène différent à chaque slide du deck.
const SCENE_TREATMENTS = [
  {
    scene:
      'An editorial studio still-life: art-directed props related to the subject arranged on sculpted plaster or paper forms, layered heights, one hero material (brushed metal, raw ceramic, frosted glass or textured paper).',
    camera: 'shot on a full-frame camera with an 85mm lens at f/5.6, slight three-quarter angle',
    light: 'one large softbox from the upper left plus a faint rim light from behind, a single deliberate hard shadow edge',
  },
  {
    scene:
      'An extreme macro of a tactile material evoking the subject (fabric weave, stone grain, liquid surface, brushed metal, paper texture or botanical detail) filling the frame with rich micro-detail.',
    camera: 'shot with a 100mm macro lens at f/8, focus stacked, razor-sharp micro-detail in the focal plane',
    light: 'raking side light skimming across the surface to reveal every micro-texture, deep controlled falloff',
  },
  {
    scene:
      'A candid environmental scene evoking the subject\'s real world: a lived-in place with natural asymmetry and imperfect, unstaged arrangements that feel captured, not arranged.',
    camera: 'shot on a 35mm lens at f/2.8 from standing eye level, documentary framing',
    light: 'available light only — low golden-hour sun or a soft north-facing window, real shadows with correct direction and depth',
  },
  {
    scene:
      'A minimal architectural composition: strong lines, one dominant shape, concrete, glass and matte surfaces, museum-like calm.',
    camera: 'shot on a 50mm lens at f/8, precise two-point perspective, perfectly level horizon',
    light: 'hard directional sunlight at a low angle creating long clean shadows and crisp specular edges',
  },
  {
    scene:
      'A refined organic arrangement: natural elements (stone, wood, plants, sand, water) composed with quiet intention, calm and premium.',
    camera: 'shot on a 50mm lens at f/4, medium distance, gentle foreground depth',
    light: 'soft overcast daylight with one subtle warm bounce, delicate natural shadows',
  },
];

function buildImagePrompt(body: Record<string, unknown>, lang: string, hasRefs: boolean, hasProduct: boolean): string | null {
  const slide = body.slide as Record<string, unknown> | undefined;
  const style = body.style === 'light' ? 'light' : 'dark';
  const format = typeof body.format === 'string' ? body.format : '';
  if (!slide || !VALID_FORMATS.has(format)) return null;
  const aspect = FORMAT_ASPECT[format];
  const slideNumber = asInt(slide.slideNumber, 1, 50) ?? 1;
  const total = asInt(body.total, 1, 50) ?? 1;

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
  const brandName = asStr(brand?.name, 1, 40) ?? '';
  const brandHandle = asStr(brand?.handle, 1, 40) ?? '';

  const fonts = body.fonts as Record<string, unknown> | undefined;
  const fTitle = typeof fonts?.title === 'string' && VALID_FONT_NAMES.has(fonts.title) ? fonts.title : '';
  const fBody = typeof fonts?.body === 'string' && VALID_FONT_NAMES.has(fonts.body) ? fonts.body : '';

  const tr = SCENE_TREATMENTS[(slideNumber - 1) % SCENE_TREATMENTS.length];
  const q = (v: string) => JSON.stringify(v);
  const rtl = lang === 'ar';

  const prof = body.profile as Record<string, unknown> | undefined;
  const pt = asStr(prof?.productType, 1, 120);
  const th = asStr(prof?.theme, 1, 120);

  const lines: string[] = [
    'You are a world-class art director and graphic designer. Deliver ONE single, FINISHED, ready-to-publish social media design as a flat image, in aspect ratio ' + aspect + '. It is the final deliverable: all the text below must be rendered inside the image itself.',
    '',
    '=== TEXT TO RENDER (exact, character for character, in ' + (LANG_NAMES[lang] ?? 'français') + (rtl ? ', right-to-left, correctly connected Arabic letters' : '') + ') ===',
    ...(brandName ? ['- Brand name (small, header): ' + q(brandName)] : []),
    ...(total > 1 ? ['- Slide counter (small, header corner): ' + q(String(slideNumber).padStart(2, '0') + ' / ' + String(total).padStart(2, '0'))] : []),
    ...(tag ? ['- Small label above the headline (uppercase, accent color): ' + q(tag)] : []),
    '- HEADLINE (largest text, strong hierarchy, maximum 3 lines): ' + q(title) + (highlight && title.includes(highlight) ? ' — render the word ' + q(highlight) + ' in the accent color' : ''),
    ...(subtitle ? ['- Subtitle (medium, highly readable): ' + q(subtitle)] : []),
    ...(bullets.length ? ['- Short checklist, one line each, with a small check icon: ' + bullets.map(q).join(' | ')] : []),
    ...(cta ? ['- Call-to-action button (pill shape, accent color fill, bold): ' + q(cta)] : []),
    ...(brandHandle ? ['- Footer handle (small): ' + q(brandHandle)] : []),
    'Do not add, translate, abbreviate or invent ANY other text, number, logo or watermark. Every letter must be perfectly spelled, sharp and legible' + (rtl ? '; Arabic text must read right-to-left with correct letter shaping' : '') + '.',
    '',
    '=== TYPOGRAPHY ===',
    fTitle ? 'Headline typeface: ' + fTitle + ' (or the closest look-alike). ' : 'Headline typeface: a bold modern display font. ',
    fBody ? 'Body typeface: ' + fBody + ' (or the closest look-alike).' : 'Body typeface: a clean modern sans-serif.',
    'Clear hierarchy: headline > subtitle > checklist > small labels. Generous line spacing, aligned on one consistent edge' + (rtl ? ' (right-aligned)' : ' (left-aligned)') + '.',
    '',
    '=== LAYOUT & STYLE ===',
    '- Keep a safe margin of at least 8% on every side: no text touches or crosses the frame edge.',
    '- Header at the top (brand + counter), headline block in the vertical middle or lower-middle, call-to-action and handle near the bottom.',
    '- Text must have strong contrast with the background everywhere (use a soft gradient or calm area behind text if needed).',
    style === 'light'
      ? '- Theme: LIGHT. Bright, airy, luminous background (clean whites), dark text.'
      : '- Theme: DARK. Deep rich dark background, white text, premium night mood.',
    '- Accent color: ' + brandColor + ' — use it for the label, the highlighted word, the check icons and the button.',
    '- Visual: integrate ONE premium photographic or 3D-style hero visual that evokes the subject (not literal clip-art), placed so it never covers the text. Photographic direction: ' + tr.scene + ' ' + tr.camera + '; ' + tr.light + '.',
    '- Modern, minimal, agency-level quality. No clutter, no stock-template look, no borders or frames around the whole image.',
    '',
    'Subject of the design: ' + [tag, title, subtitle].filter(Boolean).join(' — '),
    ...(pt || th ? ['Brand universe: ' + (pt ? 'product type ' + pt : '') + (pt && th ? ', ' : '') + (th ? th + ' aesthetic' : '') + ' — stay perfectly consistent with this identity.'] : []),
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
