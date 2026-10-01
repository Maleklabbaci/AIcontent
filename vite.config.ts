import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin, type UserConfig} from 'vite';

// En dev local, les Cloudflare Pages Functions (dossier functions/) ne s'exécutent pas.
// Ce plugin renvoie { configured: false } pour /api/* afin que le front bascule
// proprement sur le mode fallback (téléchargement fichier multi-calques Canva).
const devApiStub = (): Plugin => ({
  name: 'aura-dev-api-stub',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url && req.url.startsWith('/api/') && req.method === 'POST') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            configured: false,
            error:
              "Fonction Cloudflare disponible uniquement en production. Configurez GEMINI_API_KEY / CANVA_ACCESS_TOKEN dans les variables Cloudflare Pages.",
          })
        );
        return;
      }
      next();
    });
  },
});

export default defineConfig((): UserConfig => {
  return {
    plugins: [devApiStub(), react(), tailwindcss()] as UserConfig['plugins'],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
