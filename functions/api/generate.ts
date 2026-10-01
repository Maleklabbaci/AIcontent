// Cloudflare Pages Function: POST /api/generate
// Gemini remains server-side: the browser never receives GEMINI_API_KEY.

interface Env {
  GEMINI_API_KEY?: string;
}

const MODEL_MAP: Record<string, string> = {
  flash: 'gemini-2.5-flash-image',
  studio: 'gemini-3.1-flash-image-preview',
  pro: 'gemini-3-pro-image-preview',
};

interface GenerateBody {
  prompt?: string;
  modelId?: 'flash' | 'studio' | 'pro';
  format?: string;
  slidesCount?: number;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  if (!env.GEMINI_API_KEY) {
    return json({ configured: false, error: 'GEMINI_API_KEY non configurée sur Cloudflare' });
  }

  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return json({ configured: false, error: 'Corps JSON invalide' }, 400);
  }

  const prompt = body.prompt?.trim();
  if (!prompt) return json({ configured: false, error: 'Le prompt est obligatoire' }, 400);

  const format = body.format || 'scroller';
  const slidesCount = Math.min(Math.max(Number(body.slidesCount) || 1, 1), 12);
  const engine = MODEL_MAP[body.modelId || 'flash'] || MODEL_MAP.flash;

  try {
    const textRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Tu es Aura Design AI. Génère un JSON strict pour le sujet suivant : "${prompt.slice(0, 4000)}".
Format: ${format}, Nombre de slides: ${slidesCount}.
Retourne uniquement un objet JSON valide de la forme:
{
  "title": "Titre court du projet",
  "slides": [
    {
      "slideNumber": 1,
      "tag": "TAG EN MAJUSCULES",
      "title": "Titre percutant",
      "subtitle": "Sous-titre explicatif clair",
      "highlightWord": "mot",
      "bulletPoints": ["Point 1", "Point 2", "Point 3"],
      "ctaText": "Appel à l'action ➔"
    }
  ]
}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.8,
          },
        }),
      }
    );

    if (!textRes.ok) {
      const providerError = await textRes.text();
      return json({ configured: true, engine, error: providerError.slice(0, 1000) }, 502);
    }

    const textJson = (await textRes.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const rawText = textJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return json({ configured: true, engine, error: 'Réponse Gemini vide' }, 502);

    let design: unknown;
    try {
      design = JSON.parse(rawText);
    } catch {
      return json({ configured: true, engine, error: 'Réponse Gemini non JSON' }, 502);
    }

    return json({ configured: true, engine, design });
  } catch (err) {
    return json(
      { configured: false, error: err instanceof Error ? err.message : 'Erreur interne Gemini' },
      500
    );
  }
};
