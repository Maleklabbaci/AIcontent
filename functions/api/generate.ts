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

  const textPrompt = `Tu es Aura Design AI, directeur artistique spécialisé en réseaux sociaux.
Génère le copywriting d'un design au format ${format} composé de ${slidesCount} slide(s).
Sujet fourni par l'utilisateur : "${prompt}".
Consignes de style : design ${style === 'light' ? 'CLAIR (fond blanc, textes foncés, sobre)' : 'SOMBRE (fond sombre, contraste élevé, premium)'}, ton professionnel et percutant, textes courts qui tiennent dans un visuel.

Réponds UNIQUEMENT avec un JSON valide, sans texte autour, de la forme exacte :
{
  "title": "Titre court du projet",
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

RÈGLES :
- Exactement ${slidesCount} slide(s) dans le tableau "slides".
- Écris TOUS les textes en ${LANG_NAMES[lang] ?? 'français'}.
- Si slidesCount === 1, la slide doit être autonome (hook + valeur + CTA).
- Les bulletPoints sont obligatoires uniquement pour les carrousels/présentations ; pour une slide unique, renvoie un tableau vide.
- Pas d'emojis, pas de guillemets non échappés dans les chaînes.`;

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

  return json({ configured: true, stage: 'copy', design: { title: design.title || '', slides } });
}

// ============================================================
// STAGE 'image' : 1 image (API Interactions, Nano Banana)
// ============================================================
function buildImagePrompt(body: Record<string, unknown>, lang: string): string | null {
  const slide = body.slide as Record<string, unknown> | undefined;
  const brand = body.brand as Record<string, unknown> | undefined;
  const style = body.style === 'light' ? 'light' : 'dark';
  const format = typeof body.format === 'string' ? body.format : '';
  if (!slide || !VALID_FORMATS.has(format)) return null;
  const aspect = FORMAT_ASPECT[format];

  const title = asStr(slide.title, 0, 120) ?? '';
  const tag = asStr(slide.tag, 0, 60) ?? '';
  const subtitle = asStr(slide.subtitle, 0, 220) ?? '';

  const brandColor = /^#[0-9a-fA-F]{6}$/.test(String(brand?.color ?? '')) ? String(brand?.color) : '#F59E0B';

  const lines = [
    'Create ONE premium BACKGROUND ARTWORK for a social media design.',
    'CRITICAL: this artwork is used as a dimmed backdrop behind a text overlay — it must NOT contain any text, letters, numbers, words, typography or logos.',
    `Visual subject (inspiration only, no copy of it): ${tag ? `${tag} — ` : ''}${title}${subtitle ? `. Context: ${subtitle}` : ''}`,
    style === 'light'
      ? 'Style: LIGHT theme — clean white/ivory base, soft airy composition, delicate shadows, premium editorial look.'
      : 'Style: DARK theme — deep charcoal/black base, dramatic lighting, elegant premium look, subtle glow accents.',
    `Accent color: ${brandColor} woven into the artwork tastefully.`,
    'Composition: one strong focal point, generous negative space in the lower half (text will be overlaid there), professional social-media aesthetic.',
    `Exact aspect ratio: ${aspect} (enforced by the API). No watermark, no border, no frame.`,
  ];
  return lines.filter(Boolean).join('\n');
}

async function handleImage(apiKey: string, body: Record<string, unknown>): Promise<Response> {
  const modelId = asStr(body.modelId, 3, 10) || 'flash';
  const format = asStr(body.format, 1, 20) || '';
  const style = body.style === 'light' ? 'light' : 'dark';
  const lang = asStr(body.lang, 2, 2) || 'fr';

  if (!VALID_MODELS.has(modelId) || !VALID_FORMATS.has(format) || !VALID_STYLES.has(style)) {
    return json({ error: 'invalid_payload' }, 400);
  }

  const imagePrompt = buildImagePrompt(body, lang);
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
          input: [{ type: 'text', text: imagePrompt }],
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

  const body = await readJson(request, 200_000);
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
