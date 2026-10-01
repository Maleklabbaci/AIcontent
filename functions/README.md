# Cloudflare Pages Functions — Aura Design

Les fonctions Cloudflare sont déployées avec le site Pages et fournissent le backend HTTP de l'application. Elles ne s'exécutent pas avec le serveur Vite standard (`npm run dev`), qui renvoie un stub pour `/api/*`.

## Routes

| Méthode | Route | Description |
| --- | --- | --- |
| `POST` | `/api/generate` | Deux étapes : génération du texte des slides, puis génération d'une image par slide avec l'API Gemini. |
| `POST` | `/api/canva/import` | Envoi d'un fichier PowerPoint multi-calques à Canva Connect et retour de l'URL d'édition. |

## Variables Cloudflare

Dans **Workers & Pages → votre projet → Settings → Variables and Secrets**, ajoutez :

| Variable | Requise | Type | Utilisation |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | Oui pour la génération IA | Secret | Clé Gemini utilisée uniquement par `/api/generate`. |
| `CANVA_ACCESS_TOKEN` | Non | Secret | Jeton serveur de secours pour `/api/canva/import`. N'en définissez un que si le partage de ce compte Canva est intentionnel. |

Ne placez jamais ces secrets dans une variable `VITE_*`, dans le dépôt ou dans le code livré au navigateur.

## Modèles d'image

| Modèle Aura | Modèle API | Points par image |
| --- | --- | ---: |
| Aura Flash | `gemini-2.5-flash-image` | 5 |
| Aura Studio | `gemini-3.1-flash-image` | 10 |
| Aura Pro Max | `gemini-3-pro-image` | 20 |

Les tarifs de l'API peuvent évoluer; vérifiez les prix auprès du fournisseur avant d'activer une offre payante. Le nombre de points affiché par l'application n'est pas, à lui seul, une validation serveur de paiement ou de solde.

## Développement local

`npm run dev` utilise un stub défini dans `vite.config.ts`. Il répond `{ configured: false }` aux appels `/api/*`; cela permet de tester l'interface et les exports de secours, mais pas les générations Gemini ni l'import direct Canva. Utilisez un environnement Pages Functions pour tester réellement ces routes.

## Sécurité et état d'intégration

- `/api/generate` appelle l'API Gemini côté serveur; il ne faut jamais exposer la clé Gemini au navigateur.
- `/api/canva/import` accepte actuellement un jeton envoyé par le client ou un jeton serveur facultatif. Le jeton personnel est stocké côté navigateur par l'application; pour une exploitation multi-utilisateur, privilégiez un flux OAuth et un stockage chiffré côté serveur.
- Le schéma Supabase inclut des tables de suivi des générations, de crédits, de paiements et de parrainages, mais ces fonctions ne sont pas encore raccordées à ces tables. N'utilisez pas le solde local du navigateur comme contrôle de facturation.
