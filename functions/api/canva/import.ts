// Cloudflare Pages Function : POST /api/canva/import
// Envoie le fichier .pptx multi-calques généré directement dans le compte Canva de l'utilisateur
// via Canva Connect API (POST https://api.canva.com/rest/v1/imports) et retourne l'edit_url directe.

interface Env {
  CANVA_ACCESS_TOKEN?: string;
}

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;

  const authHeader = request.headers.get('X-Canva-Token') || env.CANVA_ACCESS_TOKEN;
  if (!authHeader) {
    return new Response(
      JSON.stringify({
        configured: false,
        error: 'CANVA_ACCESS_TOKEN non configuré. Basculement sur le fichier multi-calques Canva.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const titleHeader = request.headers.get('X-Design-Title') || 'Aura Design';
    const titleBase64 = btoa(unescape(encodeURIComponent(titleHeader)));
    const fileBuffer = await request.arrayBuffer();

    const createRes = await fetch('https://api.canva.com/rest/v1/imports', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authHeader}`,
        'Content-Type': 'application/octet-stream',
        'Import-Metadata': JSON.stringify({
          title_base64: titleBase64,
          mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        }),
      },
      body: fileBuffer,
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      return new Response(JSON.stringify({ configured: true, error: errText }), {
        status: createRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const createData = (await createRes.json()) as {
      job?: { id: string; status: string; result?: { designs?: { urls?: { edit_url?: string } }[] } };
    };

    const jobId = createData.job?.id;
    if (!jobId) {
      return new Response(JSON.stringify({ configured: true, error: 'Aucun job ID retourné par Canva' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Poll job status up to 8 times
    for (let attempt = 0; attempt < 8; attempt++) {
      await new Promise((r) => setTimeout(r, 800));
      const pollRes = await fetch(`https://api.canva.com/rest/v1/imports/${jobId}`, {
        headers: { Authorization: `Bearer ${authHeader}` },
      });
      if (!pollRes.ok) break;
      const pollData = (await pollRes.json()) as {
        job?: { status: string; result?: { designs?: { urls?: { edit_url?: string; view_url?: string } }[] } };
      };
      if (pollData.job?.status === 'success') {
        const editUrl = pollData.job.result?.designs?.[0]?.urls?.edit_url;
        if (editUrl) {
          return new Response(JSON.stringify({ configured: true, edit_url: editUrl }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      if (pollData.job?.status === 'failed') {
        break;
      }
    }

    return new Response(JSON.stringify({ configured: true, error: 'Délai dépassé lors de la création Canva' }), {
      status: 504,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ configured: false, error: err instanceof Error ? err.message : 'Erreur interne' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
