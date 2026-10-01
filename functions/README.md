# Cloudflare Pages Functions — Backend Aura Design

Ce dossier est automatiquement déployé par **Cloudflare Pages**. Chaque sous-dossier correspond à une route API :

| Route | Fichier | Rôle |
| :--- | :--- | :--- |
| `POST /api/generate` | `functions/api/generate.ts` | Génération de structure copywriting via Gemini côté serveur |
| `POST /api/canva/import` | `functions/api/canva/import.ts` | Import du fichier `.pptx` multi-calques via Canva Connect |

## Secrets Pages Functions

À définir comme **secrets chiffrés**, dans les environnements Production et Preview du projet Pages `aicontent` :

| Variable | Description |
| :--- | :--- |
| `GEMINI_API_KEY` | Clé Google AI Studio — active la génération Gemini côté Cloudflare |
| `CANVA_ACCESS_TOKEN` | Token Canva Connect par défaut ; facultatif si chaque utilisateur renseigne son propre token |

Le frontend ne reçoit jamais ces deux valeurs. La route Canva envoie le fichier vers Canva via le token Worker et retourne uniquement l’URL d’édition ou une erreur contrôlée.

Les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont des variables de build publiques destinées au client Supabase. Les données sont protégées par l’identité Auth anonyme et les politiques RLS définies dans `supabase/schema.sql`.
