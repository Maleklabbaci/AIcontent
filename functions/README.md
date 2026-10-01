# Cloudflare Pages Functions — Backend Aura Design

Ce dossier est automatiquement déployé par **Cloudflare Pages** (aucune configuration build supplémentaire).
Chaque sous-dossier correspond à une route API :

| Route | Fichier | Rôle |
| :--- | :--- | :--- |
| `POST /api/generate` | `functions/api/generate.ts` | Génération IA : route les modèles de la plateforme vers les 3 Nano Banana (Gemini API) |
| `POST /api/canva/import` | `functions/api/canva/import.ts` | Envoi direct du design multi-calques `.pptx` dans le compte Canva de l'utilisateur (Canva Connect `POST /rest/v1/imports`) et retour de l'`edit_url` |

## Variables d'environnement à définir dans Cloudflare Pages

`Paramètres → Fonctions (Functions) → Variables d'environnement` :

| Variable | Description |
| :--- | :--- |
| `GEMINI_API_KEY` | Clé API Google AI Studio (https://aistudio.google.com/apikey) — active la vraie génération IA |
| `CANVA_ACCESS_TOKEN` | *(Optionnel)* Jeton Canva Connect par défaut. Sinon, chaque client colle son propre jeton depuis l'app (Paramètres → Compte Canva) |

## Modèles & tarification en points

| Modèle plateforme | Modèle Google | Coût API | Points déduits / image |
| :--- | :--- | :--- | :--- |
| Aura Flash | `gemini-2.5-flash-image` (Nano Banana 1) | ~0,039 $ | **5 pts** |
| Aura Studio | `gemini-3.1-flash-image` (Nano Banana 2) | ~0,067 $ | **10 pts** |
| Aura Pro Max | `gemini-3-pro-image` (Nano Banana Pro) | ~0,134 $ | **20 pts** |

Facturation : **1 image IA générée = points du modèle** (un carrousel de N slides avec 1 image par slide = N × points).
En dev local (`npm run dev`), un stub Vite répond `{ configured: false }` pour `/api/*` : l'app bascule alors
sur le téléchargement du fichier `.pptx` multi-calques (importable manuellement sur canva.com).
