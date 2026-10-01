// Cloudflare Pages Function : POST /api/generate
// Route les 3 modèles de la plateforme vers les 3 variantes Nano Banana de Google Gemini API :
// - flash (5 pts)  -> gemini-2.5-flash-image (Nano Banana 1)
// - studio (10 pts) -> gemini-3.1-flash-image-preview (Nano Banana 2)
// - pro (20 pts)   -> gemini-3-pro-image-preview (Nano Banana Pro)

interface Env {
  GEMINI_API_KEY?: string;
}

const MODEL_MAP: Record<string, string> = {
  flash: 'gemini-2.5-flash-image',
  studio: 'gemini-3.1-flash-image-preview',
  pro: 'gemini-3-pro-image-preview',
};

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ configured: false, error: 'GEMINI_API_KEY non configurée sur Cloudflare' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = (await request.json()) as {
      prompt: string;
      modelId: 'flash' | 'studio' | 'pro';
      format: string;
      slidesCount: number;
    };

    const geminiImageModel = MODEL_MAP[body.modelId] || MODEL_MAP.flash;

    // 1. Générer la structure copywriting JSON via gemini-2.5-flash
    const textRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Tu es Aura Design AI. Génère un JSON strict pour le sujet suivant : "${body.prompt}".
Format: ${body.format}, Nombre de slides: ${body.slidesCount}.
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
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );

    let slideData = null;
    if (textRes.ok) {
      const textJson = (await textRes.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const rawText = textJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        slideData = JSON.parse(rawText);
      }
    }

    return new Response(
      JSON.stringify({
        configured: true,
        engine: geminiImageModel,
        design: slideData,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ configured: false, error: err instanceof Error ? err.message : 'Erreur IA' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
