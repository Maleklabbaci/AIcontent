import { DesignProject, BrandKit, ChatMessage, Session } from '../types';

export const DEFAULT_BRAND_KIT: BrandKit = {
  name: 'AURA STUDIO',
  handle: '@aurastudio.ai',
  logoUrl: '',
  primaryColor: '#F59E0B', // amber-500
  secondaryColor: '#EA580C', // orange-600
  backgroundColor: '#09090B', // zinc-950
  textColor: '#FFFFFF',
  fontFamily: 'Manrope',
  showLogo: true,
  showHandle: true,
  showSlideNumber: true,
};

export const INITIAL_PROJECT: DesignProject = {
  id: 'proj_copywriting_2026',
  title: 'Les 4 Règles d\'Or du Copywriting B2B',
  format: 'scroller', // 4:5
  contentType: 'carousel',
  currentSlideIndex: 0,
  createdAt: 'Aujourd\'hui 14:30',
  updatedAt: 'À l\'instant',
  slides: [
    {
      id: 'slide_1',
      slideNumber: 1,
      tag: 'STRATÉGIE DE CONTENU',
      title: '90% des posts B2B ne convertissent pas.',
      subtitle: 'Voici la structure en 4 étapes que les meilleurs créateurs utilisent pour captiver et vendre en 2026.',
      highlightWord: 'convertissent',
      image: '/src/assets/images/social_abstract_accent_1790812839231.jpg',
      imagePosition: 'background',
      ctaText: 'Faites glisser pour découvrir ➔',
      cardStyle: 'bold',
    },
    {
      id: 'slide_2',
      slideNumber: 2,
      tag: 'RÈGLE #1 · LE HOOK POLARISANT',
      title: 'Tuez le jargon technique dès la 1ère seconde.',
      subtitle: 'Si votre accroche ne pose pas une tension immédiate ou un paradoxe identifiable, votre audience swipe immédiatement.',
      highlightWord: 'immédiate',
      bulletPoints: [
        'Supprimez "Dans le paysage dynamique actuel..."',
        'Commencez par un chiffre contre-intuitif ou une erreur coûteuse',
        'Raccourcissez le hook à moins de 8 mots percutants',
      ],
      cardStyle: 'minimal',
    },
    {
      id: 'slide_3',
      slideNumber: 3,
      tag: 'RÈGLE #2 · LA PREUVE TANGIBLE',
      title: 'Remplacez les adjectifs par des métriques réelles.',
      subtitle: 'Les décideurs sont immunisés contre les promesses floues. Donnez-leur des données indiscutables.',
      stat: {
        value: '+318%',
        label: 'Taux de clics qualifiés mesuré après refonte du framework narratif',
      },
      image: '/src/assets/images/social_marketing_visual_1790812851560.jpg',
      imagePosition: 'bottom',
      cardStyle: 'stat',
    },
    {
      id: 'slide_4',
      slideNumber: 4,
      tag: 'SYNTHÈSE & PASSAGE À L\'ACTION',
      title: 'Prêt à transformer votre portée organique ?',
      subtitle: 'Enregistrez ce post pour l\'appliquer à votre prochaine campagne et partagez-le à votre équipe.',
      bulletPoints: [
        'Étape 1 : Valider le hook paradoxal',
        'Étape 2 : Un seul enseignement par slide',
        'Étape 3 : CTA orienté bénéfice immédiat',
      ],
      ctaText: 'Enregistrer ce post · Suivre @aurastudio.ai',
      cardStyle: 'minimal',
    },
  ],
};

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg_welcome',
    sender: 'assistant',
    content: `Bonjour ! Je suis **Aura Design AI**, votre copilote créatif pour concevoir des visuels percutants pour LinkedIn, Instagram et Twitter.

J'ai initialisé votre carrousel **"Les 4 Règles d'Or du Copywriting B2B"** au format Scroller (4:5). 

Vous pouvez affiner ce design en me demandant par exemple :
- *"Passe ce carrousel au format Story 9:16 avec un fond sombre intense"*
- *"Génère une slide supplémentaire axée sur les erreurs à éviter"*
- *"Rapproche le ton d'une marque de luxe minimaliste"*`,
    timestamp: '14:32',
    suggestedPrompts: [
      'Ajouter un slide sur les erreurs de copywriting',
      'Passer au format Story 9:16',
      'Renforcer le contraste et les accents orange',
      'Créer un poster citation percutant',
    ],
  },
  {
    id: 'msg_user_1',
    sender: 'user',
    content: 'Peux-tu optimiser le contraste du slide 1 et mettre l\'accent sur le mot clé avec notre couleur jaune ambrée ?',
    timestamp: '14:34',
    formatTag: 'scroller',
  },
  {
    id: 'msg_assistant_1',
    sender: 'assistant',
    content: `C'est fait ! J'ai appliqué les modifications suivantes :
- **Typographie amplifiée** : Le mot clé *"convertissent"* est désormais mis en valeur avec votre dégradé ambré signature (#F59E0B ➔ #EA580C).
- **Contraste de fond** : Superposition d'un masque sombre à 70% pour garantir une lisibilité optimale (WCAG AAA).
- **Badge d'accroche** : Kicker minimaliste en haut à gauche pour structurer la hiérarchie.

Le rendu interactif est synchronisé sur le Canvas à droite.`,
    timestamp: '14:35',
    suggestedPrompts: [
      'Générer un hook encore plus agressif',
      'Ajouter une statistique percutante sur le slide 2',
      'Exporter en PNG HD (1080x1350)',
    ],
  },
];

export const MOCK_SESSIONS: Session[] = [
  {
    id: 'sess_1',
    title: 'Les 4 Règles d\'Or Copywriting B2B',
    format: 'scroller',
    lastUpdated: 'Il y a 2 min',
    previewText: 'Carrousel LinkedIn 4 slides · Typographie forte',
    isPinned: true,
  },
  {
    id: 'sess_2',
    title: 'Lancement Produit SaaS v3.0',
    format: 'story',
    lastUpdated: 'Hier 18:20',
    previewText: 'Story Instagram teaser avec compte à rebours',
    isPinned: false,
  },
  {
    id: 'sess_3',
    title: 'Citation Steve Jobs Minimaliste',
    format: 'square',
    lastUpdated: '28 Sept',
    previewText: 'Post carré 1:1 noir profond & accents ambrés',
    isPinned: false,
  },
  {
    id: 'sess_4',
    title: 'Framework Growth : Le Funnel AARRR',
    format: 'scroller',
    lastUpdated: '25 Sept',
    previewText: 'Carrousel éducatif 6 slides avec schémas',
    isPinned: false,
  },
];

export const QUICK_TEMPLATES = [
  {
    id: 'tpl_carrousel_growth',
    title: 'Carrousel 5 Hacks Growth',
    format: 'scroller' as const,
    type: 'carousel' as const,
    prompt: 'Crée un carrousel Scroller 4:5 de 5 slides sur les hacks de croissance produit avec chiffres concrets et design sombre ambré.',
  },
  {
    id: 'tpl_story_event',
    title: 'Story Teaser Masterclass',
    format: 'story' as const,
    type: 'story' as const,
    prompt: 'Génère une Story percutante 9:16 pour annoncer une Masterclass en direct jeudi à 18h avec badge exclusif.',
  },
  {
    id: 'tpl_poster_quote',
    title: 'Poster Citation Inspirante',
    format: 'square' as const,
    type: 'poster' as const,
    prompt: 'Crée un poster carré 1:1 moderne avec une citation sur l\'exécution et la discipline, typographie ultra-grasse.',
  },
  {
    id: 'tpl_comparison',
    title: 'Carrousel Avant / Après',
    format: 'scroller' as const,
    type: 'carousel' as const,
    prompt: 'Crée un carrousel comparatif 4 slides : La méthode traditionnelle vs La méthode Aura AI, avec tableau de gains.',
  },
];
