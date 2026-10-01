# AIcontent — Aura Design AI

Application React/Vite déployée sur **Cloudflare Pages** depuis le dépôt GitHub `Maleklabbaci/AIcontent`.

## Architecture

- **Frontend** : React + Vite, servi depuis Cloudflare Pages.
- **API Gemini** : `POST /api/generate`, Cloudflare Pages Function ; la clé Gemini reste côté Worker.
- **API Canva** : `POST /api/canva/import`, Cloudflare Pages Function ; le token Canva reste côté Worker ou peut être fourni par l’utilisateur.
- **Données** : sessions et messages persistés dans Supabase **DesignAIplatform**, avec une identité Supabase anonyme par navigateur et RLS. `localStorage` reste le repli hors ligne.

## Configuration Supabase

1. Ouvrir le projet Supabase **DesignAIplatform**.
2. Activer **Anonymous Sign-Ins** dans Authentication → Providers.
3. Exécuter [`supabase/schema.sql`](./supabase/schema.sql) dans le SQL Editor.
4. Configurer dans Cloudflare Pages les variables de build `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` pour **Production** et **Preview**.

La clé anon/publishable est une clé publique destinée au navigateur. Elle est protégée par les politiques RLS ; ne jamais mettre une clé `service_role` dans le frontend.

## Secrets Cloudflare Pages

Configurer comme secrets chiffrés des Pages Functions, en production et en preview :

- `GEMINI_API_KEY` — clé Google AI Studio.
- `CANVA_ACCESS_TOKEN` — token Canva Connect par défaut (optionnel si chaque utilisateur renseigne son propre token).

Ne jamais committer ces valeurs dans `.env`, `.env.local`, le dépôt GitHub ou le code source.

## Développement local

```bash
npm install
cp .env.example .env.local
npm run dev
```

En local, les Pages Functions ne sont pas exécutées par Vite ; la génération garde donc un repli déterministe local. En production, le frontend appelle les routes Cloudflare ci-dessus.
