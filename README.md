# Aura Design

**Aura Design** est un studio web de création de contenus visuels pour les réseaux sociaux. Décrivez une idée, choisissez un format et un style, puis préparez des créations adaptées à votre marque.

> Interface disponible en **français, anglais et arabe**. Le dépôt GitHub est public; cela ne signifie pas qu'une licence de réutilisation a été accordée.

## Fonctionnalités

- Création de posts, stories, carrousels, affiches, visuels produit, présentations et autres formats.
- Génération en deux étapes : rédaction du contenu, puis génération des visuels via l'API Gemini côté serveur.
- Espaces de travail et Brand Kits : nom, identifiant social, couleur, logo et polices.
- Bibliothèque de références visuelles pour guider le style des générations.
- Export en PNG HD, PDF et présentation PowerPoint multi-calques importable dans Canva.
- Authentification Supabase par email, réinitialisation du mot de passe et interface de connexion/inscription.
- Modes Flash, Studio et Pro Max, avec suivi des points dans l'interface.

## Technologies

- React 19, TypeScript et Vite
- Tailwind CSS 4 et Motion
- Supabase Auth, Postgres et Storage
- Cloudflare Pages Functions
- API Gemini pour la génération IA
- Canva Connect pour l'import de présentations multi-calques

## Démarrage local

### Prérequis

- Node.js **22 LTS** recommandé
- npm
- Un projet Supabase pour tester l'authentification et les sessions distantes

### Installation

```bash
git clone https://github.com/Maleklabbaci/AIcontent.git
cd AIcontent
npm ci
cp .env.example .env.local
```

Renseignez ensuite les variables Supabase dans `.env.local` :

```dotenv
VITE_SUPABASE_URL=https://<votre-projet>.supabase.co
VITE_SUPABASE_ANON_KEY=<votre-cle-publique>
```

Puis lancez l'application :

```bash
npm run dev
```

L'application est disponible sur `http://localhost:3000`.

### Mode démo local

Sans variables Supabase définies, l'interface démarre en mode démo et conserve une partie des données dans le navigateur. Le serveur Vite local **ne lance pas les Cloudflare Pages Functions** : les appels `/api/*` répondent avec un stub et la génération IA réelle n'est pas activée. Pour tester les fonctions IA, déployez sur Cloudflare Pages ou configurez un environnement local compatible avec Pages Functions.

## Configuration Supabase

1. Créez un projet Supabase et activez le fournisseur d'authentification **Email**.
2. Dans **SQL Editor**, exécutez `supabase/schema.sql` dans ce même projet. Le fichier n'est pas appliqué automatiquement par Git ou par le lancement local.
3. Dans les réglages Auth, configurez les URL autorisées pour le développement local et votre domaine de production.
4. Renseignez `VITE_SUPABASE_URL` et la clé **anon/publishable** dans les variables d'environnement de build.

La clé Supabase anon/publishable est destinée au navigateur : elle n'est pas un secret. La sécurité des données dépend des politiques **RLS** du schéma. **N'utilisez jamais une clé `service_role` dans une variable `VITE_*` ou dans le navigateur.**

### État actuel de la persistance

`supabase/schema.sql` définit le schéma de la plateforme : profils, préférences, projets, modèles, sessions, générations IA, crédits, paiements, abonnements et parrainages, ainsi que des politiques RLS et le bucket privé `aura-assets`.

L'intégration applicative est encore partielle : le code client utilise actuellement Supabase principalement pour les sessions, tandis que plusieurs préférences, Brand Kits, modèles et le solde affiché restent stockés localement. Les tables de génération, de facturation et de parrainage nécessitent encore leur raccordement au backend. **L'existence d'une table SQL ne signifie pas que la fonctionnalité correspondante est déjà synchronisée ou sécurisée de bout en bout.** En particulier, le solde local ne doit pas être considéré comme un solde de paiement fiable.

Les fichiers image doivent être placés dans Supabase Storage et référencés par leur chemin; évitez d'enregistrer des images base64 volumineuses dans les lignes SQL.

## Déploiement Cloudflare Pages

1. Importez le dépôt public dans Cloudflare Pages.
2. Configurez la commande de build `npm run build` et le répertoire de sortie `dist`.
3. Définissez les variables ci-dessous dans les réglages de build/runtime selon leur usage.
4. Redéployez après avoir ajouté ou modifié un secret.

| Variable | Où la définir | Usage |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Variables de build Cloudflare | URL publique du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Variables de build Cloudflare | Clé anon/publishable utilisée par le navigateur; protéger les tables avec RLS |
| `GEMINI_API_KEY` | **Secret** Cloudflare Pages Functions | Appels Gemini depuis le backend; ne jamais préfixer par `VITE_` |
| `CANVA_ACCESS_TOKEN` | Secret Cloudflare, facultatif | Jeton Canva serveur de secours; ne le configurez que si son usage partagé est voulu |

Les fonctions sont dans `functions/api/` et sont publiées sous ces routes :

- `POST /api/generate` — rédaction et génération d'images.
- `POST /api/canva/import` — import d'un fichier PowerPoint multi-calques dans Canva.

Le détail des routes et de leurs variables est dans [`functions/README.md`](functions/README.md).

### Sécurité des intégrations

- `GEMINI_API_KEY` doit rester un secret côté serveur; ne le commitez jamais.
- L'application peut recevoir un jeton Canva fourni par l'utilisateur. Dans la version actuelle, le jeton personnel est conservé dans le stockage navigateur; il ne doit pas être partagé. Une intégration OAuth avec stockage serveur chiffré est préférable pour une exploitation multi-utilisateur.
- Les fonctions Cloudflare actuelles ne constituent pas à elles seules un système complet de facturation ou de débit sécurisé des crédits. Les contrôles de crédit doivent être effectués côté serveur avant d'activer des paiements réels.

## Commandes utiles

```bash
npm run dev     # serveur Vite local
npm run lint    # vérification TypeScript
npm run build   # build de production
npm run preview # aperçu du build
```

## Structure du dépôt

```text
src/                 Interface React, composants et utilitaires
functions/api/       Fonctions Cloudflare pour Gemini et Canva
supabase/schema.sql  Schéma Postgres, RLS et règles Storage
public/              Icônes, manifeste et fichiers statiques
```

## Contribution

Les contributions sont les bienvenues via des issues et des pull requests. Avant une PR, lancez `npm run lint` et `npm run build`. N'incluez jamais de fichiers `.env`, de clés API, de jetons Canva ou de secrets Supabase.

## Licence

Aucun fichier de licence n'est actuellement fourni. La visibilité publique du dépôt ne vaut pas autorisation de réutiliser, distribuer ou commercialiser le code. Ajoutez une licence si vous souhaitez accorder ces droits.
