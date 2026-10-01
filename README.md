<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Aura Design

Générateur de designs IA : posts, stories, carrousels, affiches et fiches produit
(export PNG HD, PDF et Canva multi-calques).

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Configure the environment (`.env.local`):
   - `GEMINI_API_KEY` — clé Google AI (moteur `/api/generate`, Cloudflare Pages Functions)
   - `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` — projet Supabase (auth + sessions distantes)
3. Run the app:
   `npm run dev`

> Sans variables Supabase, l'app démarre en **mode démo** (pas d'écran d'auth, données
> locales). Dès qu'elles sont présentes, **l'authentification est obligatoire** :
> la landing reste publique, tout le reste de l'application exige une session.

## Authentification

- Pages `/login` et `/signup` : carte sombre pleine page (illustration réseau de
  neurones doré), formulaire en 2 colonnes (`/signup` en miroir, illustration à gauche).
- `signUp` envoie `first_name` / `last_name` dans les metadata ; si la confirmation
  d'email est désactivée dans Supabase, l'utilisateur entre directement.
- Mot de passe oublié : `supabase.auth.resetPasswordForEmail`.
- Case « Se souvenir de moi » : le flag `aura_auth_remember` (localStorage) est lu à la
  création du client Supabase — décoché, la session vit dans `sessionStorage` et
  disparaît à la fermeture de l'onglet.
- Erreurs traduites FR / EN / AR (identifiants, email déjà pris, mot de passe court, rate limit).

## Moteur IA (`functions/api/generate.ts`)

- **Langue verrouillée** : si le brief contient « arabe / arabic / darija / عربي », des
  caractères arabes, « anglais » ou « français », cette langue écrase le réglage d'interface
  pour les deux étapes (copywriting + images).
- **Directions artistiques combinatoires** : 40 styles × 16 compositions × 14 lumières
  × 24 palettes × 12 matières × 10 traitements du sujet × 14 humeurs typo = 361 267 200
  combinaisons, × 672 couples de polices ≈ **242,8 milliards de directions** — tirées de
  façon déterministe (FNV-1a + mulberry32), avec détection de domaine (fr/en/ar) et
  polices arabes dédiées quand la langue est l'arabe.
- **Inspiration par modèles garantie** : les templates de l'utilisateur sont toujours
  envoyés comme références (contrat d'ADN visuel) quand le toggle est activé ; les photos
  produit voyagent séparément avec leur contrat de fidélité 100 %. Payload accepté jusqu'à 12 Mo.
