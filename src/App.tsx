import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Plus,
  Search,
  Palette,
  Settings,
  MoreVertical,
  ChevronDown,
  Paperclip,
  ArrowUp,
  Share2,
  Download,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Layers,
  Smartphone,
  Square,
  ThumbsUp,
  ThumbsDown,
  Maximize2,
  Trash2,
  Sliders,
  X,
  Image as ImageIcon,
  CheckCircle2,
  ExternalLink,
  Menu,
  UploadCloud,
  Globe,
  ShoppingBag,
  BadgePercent,
  Quote,
  Instagram,
  Moon,
  Sun,
  Gift,
  Wand2,
  Presentation,
  Languages,
  CircleHelp,
  Info,
  Zap,
  LogOut,
  FileImage,
  FileText,
  ArrowLeft,
  Lightbulb,
  Rocket,
  PencilRuler,
  RefreshCw
} from 'lucide-react';

// Sync des sessions via Supabase (si configuré) — sinon localStorage seul
import { isSupabaseConfigured } from './lib/supabase';
import { deleteRemoteSession, loadRemoteSessions, saveRemoteSession } from './utils/remoteStorage';
import { createEditableCanvaPptx } from './utils/canvaExport';
import { createPdfFromJpegs, pxToPt } from './utils/pdfExport';
import imgAbstract from './assets/images/social_abstract_accent_1790812839231.jpg';
import imgMarketing from './assets/images/social_marketing_visual_1790812851560.jpg';

// Format types
type FormatType = 'post' | 'scroller' | 'story' | 'square' | 'website' | 'product' | 'poster' | 'presentation';
type Lang = 'fr' | 'en' | 'ar';
type PlanId = 'free' | 'starter' | 'pro' | 'business';

interface Slide {
  id: string;
  slideNumber: number;
  heroShot?: boolean;
  tag: string;
  title: string;
  subtitle: string;
  highlightWord?: string;
  bulletPoints?: string[];
  stat?: { value: string; label: string };
  image?: string;
  ctaText?: string;
}

interface DesignContent {
  format: FormatType;
  title: string;
  slides: Slide[];
  activeSlideIndex: number;
  style?: 'dark' | 'light';
  fonts?: FontPair;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  images?: string[];
  design?: DesignContent;
  suggestions?: string[];
}

interface RecentSession {
  id: string;
  title: string;
  format: FormatType;
  projectId?: string;
}

// ===== ESPACES (PROJETS / BRAND KITS) =====
interface BrandProject {
  id: string;
  name: string;
  handle: string;
  color: string;
  logo?: string | null;
  titleFont?: string;
  bodyFont?: string;
}

const slugify = (str: string) =>
  (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const chipHue = (cmd: string) => {
  let h = 0;
  for (let i = 0; i < cmd.length; i++) h = (h * 31 + cmd.charCodeAt(i)) % 360;
  return h;
};
const ChipBadge = ({ cmd, label, lang }: { cmd: string; label: Loc; lang: Lang }) => {
  const h = chipHue(cmd);
  return (
    <span
      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold"
      style={{ backgroundColor: `hsl(${h}, 75%, 90%)`, color: `hsl(${h}, 60%, 32%)` }}
    >
      {label[lang].charAt(0).toUpperCase()}
    </span>
  );
};

const getInitialProjects = (): BrandProject[] => {
  try {
    const raw = localStorage.getItem('aura_projects_v1');
    if (raw) {
      const parsed = JSON.parse(raw) as BrandProject[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  // Migration depuis l'ancien Brand Kit unique
  const b = loadBrand();
  return [{ id: 'p1', name: b.name && b.name !== 'Ma marque' ? b.name : '', handle: b.handle || '@votrecompte', color: b.color || '#F59E0B', logo: null }];
};

// Commandes slash de format : /post /carrousel /story /carre /site /produit /affiche /presentation
const FORMAT_SLASH: { id: FormatType; keys: string[] }[] = [
  { id: 'post', keys: ['post', 'feed'] },
  { id: 'scroller', keys: ['carrousel', 'carousel', 'slides'] },
  { id: 'story', keys: ['story', 'stories', 'reel'] },
  { id: 'square', keys: ['carre', 'square', 'citation'] },
  { id: 'website', keys: ['site', 'website', 'landing'] },
  { id: 'product', keys: ['produit', 'product', 'packshot', 'ecommerce'] },
  { id: 'poster', keys: ['affiche', 'poster', 'flyer'] },
  { id: 'presentation', keys: ['presentation', 'pitch', 'deck'] },
];

// ===== CHIPS D'AMBIANCE (dizaines de styles pour différencier les prompts) =====
const STYLE_CHIPS: { cmd: string; label: { fr: string; en: string; ar: string }; desc: { fr: string; en: string; ar: string } }[] = [
  { cmd: 'minimaliste', label: { fr: 'Minimaliste', en: 'Minimalist', ar: 'بسيط' }, desc: { fr: 'Épuré, beaucoup de blanc', en: 'Clean, lots of white space', ar: 'بسيط، مساحات بيضاء واسعة' } },
  { cmd: 'luxe', label: { fr: 'Luxe & premium', en: 'Luxury & premium', ar: 'فاخر وراقٍ' }, desc: { fr: 'Dorures, élégance haut de gamme', en: 'Gold accents, high-end elegance', ar: 'لمسات ذهبية وأناقة فاخرة' } },
  { cmd: 'vintage', label: { fr: 'Vintage rétro', en: 'Vintage retro', ar: 'كلاسيكي قديم' }, desc: { fr: 'Rétro, grain ancien, tons chauds', en: 'Retro, aged grain, warm tones', ar: 'ريترو وملمس قديم وألوان دافئة' } },
  { cmd: 'neon', label: { fr: 'Néon cyberpunk', en: 'Cyberpunk neon', ar: 'نيون مستقبلي' }, desc: { fr: 'Néons éclatants, nuit urbaine', en: 'Bright neons, urban night vibe', ar: 'نيونات ساطعة وأجواء ليلية' } },
  { cmd: 'pastel', label: { fr: 'Pastel doux', en: 'Soft pastel', ar: 'باستيل ناعم' }, desc: { fr: 'Couleurs douces et apaisantes', en: 'Soft, soothing colors', ar: 'ألوان هادئة ومريحة' } },
  { cmd: 'corporate', label: { fr: 'Corporate pro', en: 'Corporate pro', ar: 'مهني رسمي' }, desc: { fr: 'Professionnel, sérieux, entreprise', en: 'Professional, serious, business', ar: 'مهني وجاد وطابع شركة' } },
  { cmd: 'fun', label: { fr: 'Fun & coloré', en: 'Fun & colorful', ar: 'ممتع وملون' }, desc: { fr: 'Coloré, joueur, plein d’énergie', en: 'Colorful, playful, full of energy', ar: 'ملون ومرح ومليء بالطاقة' } },
  { cmd: 'elegant', label: { fr: 'Élégant', en: 'Elegant', ar: 'أنيق' }, desc: { fr: 'Sophistiqué, raffiné, classique', en: 'Sophisticated, refined, classic', ar: 'راقٍ ومصقول وكلاسيكي' } },
  { cmd: 'audacieux', label: { fr: 'Audacieux', en: 'Bold', ar: 'جريء' }, desc: { fr: 'Contrastes forts qui attirent l’œil', en: 'Strong contrasts that catch the eye', ar: 'تباينات قوية تجذب العين' } },
  { cmd: 'dramatique', label: { fr: 'Dramatique', en: 'Dramatic', ar: 'درامي' }, desc: { fr: 'Ombres profondes, ambiance cinéma', en: 'Deep shadows, cinematic mood', ar: 'ظلال عميقة وأجواء سينمائية' } },
  { cmd: 'dore', label: { fr: 'Doré scintillant', en: 'Golden shimmer', ar: 'ذهبي لامع' }, desc: { fr: 'Touches dorées brillantes', en: 'Shiny golden accents', ar: 'لمسات ذهبية لامعة' } },
  { cmd: 'naturel', label: { fr: 'Naturel organique', en: 'Natural organic', ar: 'طبيعي عضوي' }, desc: { fr: 'Tons terreux, matières brutes', en: 'Earthy tones, raw textures', ar: 'ألوان ترابية وخامات طبيعية' } },
  { cmd: 'tech', label: { fr: 'Tech futuriste', en: 'Futuristic tech', ar: 'تقني مستقبلي' }, desc: { fr: 'Futuriste, bleu électrique', en: 'Futuristic, electric blue', ar: 'مستقبلي وأزرق كهربائي' } },
  { cmd: 'romantique', label: { fr: 'Romantique', en: 'Romantic', ar: 'رومانسي' }, desc: { fr: 'Tendre, délicat, tons rosés', en: 'Tender, delicate, rosy tones', ar: 'ناعم ورقيق ودرجات وردية' } },
  { cmd: 'sportif', label: { fr: 'Sportif énergique', en: 'Energetic sporty', ar: 'رياضي حيوي' }, desc: { fr: 'Dynamique, mouvement, énergie', en: 'Dynamic, motion, energy', ar: 'ديناميكي وحركة وطاقة' } },
  { cmd: 'food', label: { fr: 'Food appétissant', en: 'Appetizing food', ar: 'طعام شهي' }, desc: { fr: 'Appétissant, chaud, gourmand', en: 'Appetizing, warm, tasty', ar: 'شهي ودافئ ويليق بالطعام' } },
  { cmd: 'boho', label: { fr: 'Boho chic', en: 'Boho chic', ar: 'بوهو شيك' }, desc: { fr: 'Bohème, terreux, artisanal', en: 'Bohemian, earthy, artisanal', ar: 'بوهيمي وترابي وحرفي' } },
  { cmd: 'gradient', label: { fr: 'Dégradés vifs', en: 'Vivid gradients', ar: 'تدرجات نابضة' }, desc: { fr: 'Fonds en dégradés vifs', en: 'Vivid gradient backgrounds', ar: 'خلفيات بتدرجات نابضة' } },
  { cmd: 'monochrome', label: { fr: 'Monochrome', en: 'Monochrome', ar: 'أحادي اللون' }, desc: { fr: 'Une seule couleur, ses nuances', en: 'One color, all its shades', ar: 'لون واحد بكل درجاته' } },
  { cmd: 'collage', label: { fr: 'Collage magazine', en: 'Magazine collage', ar: 'كولاج مجلة' }, desc: { fr: 'Découpage magazine, superpositions', en: 'Magazine cutouts, layered elements', ar: 'قصاصات مجلة وعناصر متراكبة' } },
];

// Nombre de projets autorisés par pack
const PACK_PROJECT_LIMIT: Record<PlanId, number> = { free: 1, starter: 3, pro: 10, business: Infinity };

const FORMATS: Record<
  FormatType,
  {
    label: string;
    short: string;
    w: number;
    h: number;
    aspect: string;
    kind: 'carousel' | 'single';
    Icon: React.ComponentType<{ className?: string }>;
    tag: string;
    cta: string;
    sub: string;
  }
> = {
  post: { label: 'Post 4:5', short: '4:5', w: 1080, h: 1350, aspect: 'aspect-[4/5] max-w-md', kind: 'single', Icon: Instagram, tag: 'POST FEED', cta: 'Enregistrer ➔', sub: 'Un visuel unique au format du carrousel, pour occuper un maximum de place dans le feed.' },
  scroller: { label: 'Carrousel 4:5', short: '4:5', w: 1080, h: 1350, aspect: 'aspect-[4/5] max-w-md', kind: 'carousel', Icon: Layers, tag: 'CARROUSEL', cta: 'Enregistrer ➔', sub: '' },
  story: { label: 'Story 9:16', short: '9:16', w: 1080, h: 1920, aspect: 'aspect-[9/14] max-w-sm', kind: 'single', Icon: Smartphone, tag: 'STORY IMPACT', cta: 'Swipe up ➔', sub: 'Une stratégie claire et 3 principes immuables pour transformer votre visibilité.' },
  square: { label: 'Post carré 1:1', short: '1:1', w: 1080, h: 1080, aspect: 'aspect-square max-w-md', kind: 'single', Icon: Square, tag: 'POST CARRÉ', cta: 'Enregistrer ➔', sub: 'Une stratégie claire et 3 principes immuables pour transformer votre visibilité.' },
  website: { label: 'Site web 16:9', short: '16:9', w: 1920, h: 1080, aspect: 'aspect-video max-w-2xl', kind: 'single', Icon: Globe, tag: 'SITE WEB · SECTION HERO', cta: 'Démarrer maintenant ➔', sub: 'Une page d\'accueil claire : promesse, preuve et appel à l\'action visibles dès l\'arrivée.' },
  product: { label: 'Produit 3:4', short: '3:4', w: 1200, h: 1600, aspect: 'aspect-[3/4] max-w-md', kind: 'single', Icon: ShoppingBag, tag: 'FICHE PRODUIT', cta: 'Ajouter au panier ➔', sub: 'Un visuel fort, des bénéfices concrets et une preuve sociale pour convertir dès la première visite.' },
  poster: { label: 'Affiche 2:3', short: '2:3', w: 1200, h: 1800, aspect: 'aspect-[2/3] max-w-sm', kind: 'single', Icon: FileImage, tag: 'AFFICHE · ÉVÉNEMENT', cta: 'Réservez votre place ➔', sub: 'Une accroche immédiate, une hiérarchie nette et une information clé lisible à distance.' },
  presentation: { label: 'Présentation 16:9', short: '16:9', w: 1920, h: 1080, aspect: 'aspect-video max-w-2xl', kind: 'carousel', Icon: Presentation, tag: 'PRÉSENTATION', cta: 'Suivant ➔', sub: '' },
};
const FORMAT_ORDER: FormatType[] = ['post', 'scroller', 'story', 'square', 'website', 'product', 'poster', 'presentation'];

const I18N: Record<Lang, Record<string, string>> = {
  fr: { newDesign: 'Nouveau design', search: 'Recherche', templates: 'Templates', recents: 'Récents', greeting: 'Bonjour', subtitle: "On travaille sur quoi aujourd'hui ?", placeholder: "Décrivez le design à créer...", share: 'Partager', settings: 'Paramètres', language: 'Langue', help: "Obtenir de l'aide", learnMore: 'En savoir plus', upgrade: 'Tarifs & Packs', logout: 'Se déconnecter', plan: 'Pack', commands: 'Commandes', styleGrp: 'Style', ambianceGrp: 'Ambiance', spacesGrp: 'Espaces', appliedToSend: "Appliqué à l'envoi", addToDesign: 'Ajouter au design', uploadPhoto: 'Uploader une photo', addAmbiance: 'Ajouter une ambiance', slashTip: 'Astuce : tapez « / » pour les commandes rapides.', ambianceAdded: 'Ambiance ajoutée', ambianceReplaced: 'Ambiance remplacée', ambianceRemoved: 'Ambiance retirée', maxChips: 'Maximum 3 ambiances par design.', appliedNext: 'appliqué à la prochaine génération', styleDark: 'Design sombre', styleLight: 'Design clair', chooseAmbiance: 'Choisir une ambiance', packs: 'Packs', lowBalance: 'Solde faible — voir les packs', noSessions: 'Aucune session trouvée.', backToStudio: "Retour à l'atelier", currentBadge: 'ACTUEL', packCurrent: 'Pack actuel', popular: 'LE PLUS POPULAIRE', surDevis: 'Sur devis', forever: 'pour toujours', perMonth: '/ mois', projectDefault: 'Projet', spaceDeleted: 'Espace supprimé.', keepOneSpace: 'Impossible : gardez au moins un espace.', spaceCreated: 'Espace créé — configurez son Brand Kit !', spaceActivated: 'activé — Brand Kit appliqué !', packLimitHit: 'projet(s) maximum dans votre pack. Passez à un pack supérieur !', pricingBadge: 'TARIFS & PACKS', pricingTitleA: 'Choisissez votre', pricingTitleB: 'pack', pricingTitleC: ', générez en liberté', yourBalance: 'Votre solde actuel', chooseYourPack: 'Choisissez votre pack', tipsTitle: 'BONS REFLEXES', brandTitle: 'Espaces & Brand Kit', brandSub: 'Chaque espace possède sa propre identité : logo, nom, @handle et couleur appliqués automatiquement à tous vos designs.', mySpaces: 'Mes espaces', activeBadge: 'ACTIF', unnamed: 'Sans nom', deleteSpace: 'Supprimer cet espace', newSpace: 'Nouvel espace', limitReached: 'Limite du pack atteinte', limitReachedSub: "Passez à un pack supérieur pour plus d'espaces", activeSpace: 'Espace actif', savedAuto: 'Enregistré automatiquement ✓', logoLabel: 'Logo de la marque', logoDrag: 'Glissez votre logo ou parcourez', logoHint: 'PNG, JPG, SVG — carré recommandé', logoImported: 'Logo importé', logoReplace: 'Cliquer pour remplacer', remove: 'Retirer', brandNameLabel: 'Nom de la marque', brandHandleLabel: 'Identifiant social (@handle)', handleHint: 'Affiché en bas de chaque design, avec une coche de vérification.', brandColorLabel: "Couleur d'accentuation", colorHint: "Utilisée pour les tags, chiffres clés, boutons et bordures. Code :", previewLive: 'Aperçu en direct', previewTag: 'Nouvelle collection', previewPlaceholder: 'Votre marque', previewCta: 'Votre CTA ici ➔', previewNote: "Cet aperçu utilise vos réglages en temps réel. Tout est appliqué à l'écran, en PNG HD, PDF et dans l'export multi-calques Canva.", ambianceInfo: 'Ambiance', freeBadge: 'GRATUIT', refWelcome: 'Code d’invitation {r} détecté — vos 20 points de bienvenue vous attendent !', exportUnsupported: 'Export impossible sur ce navigateur.', exportingSlide: 'Export du slide {n} en cours...', slideDownloaded: 'Slide {n} téléchargé !', exportingAll: 'Export de {n} slides en cours...', exportingPdf: 'Export PDF de {n} slide(s) en cours...', resizedTo: 'Design décliné en {f} — gratuit !', textCopied: 'Texte copié !', linkCopiedClip: 'Lien copié dans le presse-papier !', insufficient: 'Solde insuffisant : {n} points requis ({c} restants).', pointsSpent: '−{n} points · solde : {c} pts', generatedMany: '{n} slides générés !', generatedOne: 'Nouveau design généré !', customColor: 'Couleur personnalisée', hideSidebar: 'Masquer la barre latérale', showSidebar: 'Ouvrir la barre latérale', searchSessions: 'Rechercher une session...', changeProject: 'Changer de projet / espace de travail', yourPack: 'Votre pack', copyText: 'Copier le texte', exportAllPdf: 'Exporter tous les slides en un seul PDF', openInCanvaTip: 'Ouvrir ce design éditable dans votre compte Canva', removePhoto: 'Retirer la photo', addPhotoOrVibe: 'Ajouter une photo ou une ambiance', carouselTip: 'Nombre de slides du carrousel', modelTip: 'Modèle de génération', defaultBrand: 'Ma marque', newProject: 'Nouveau projet', editBrandKit: 'Modifier le Brand Kit', referFriend: 'Parrainer un ami', loggedOutTitle: 'Vous êtes déconnecté', loggedOutSub: 'À bientôt sur Aura Design.', relogin: 'Se reconnecter', resizeTitle: 'Décliner en', resizeHint: 'Décliner ce design dans un autre format (gratuit)', editOnCanva: 'Modifier sur Canva', prevSlide: 'Précédent', nextSlide: 'Suivant', aiThinking: 'Génération de votre design en cours...', slideProgress: 'Slide {i}/{n}…', engineError: 'Le moteur IA n’a pas répondu. Aucun point débité — réessaie.', partialGen: '{a}/{b} images générées — {p} points débités.', aiIntroOne: 'Voici votre nouveau design au format **{fmt}**', aiIntroMany: 'Voici votre carrousel de **{n} slides** au format **{fmt}**', aiStyleLight: 'en **style clair**', aiPhotos: 'avec {n} photo(s) intégrée(s)', aiChips: '— ambiance : **{chips}**', aiCanvasTip: 'Le Canvas ci-dessous vous permet de le visualiser et de l’exporter en haute résolution.', sugRefine: 'Affiner le texte du Slide 1', sugRegenSlides: 'Régénérer avec {n} slides', sugToCarousel: 'Passer en format Carrousel 4:5', sugExportPng: 'Exporter en PNG HD', sugExportPdf: 'Exporter en PDF', photoAdded: 'Photo ajoutée au message', canvaConnectedToast: 'Compte Canva connecté ! Prochain export : envoi automatique.', slideCopied: 'Contenu du slide copié !', canvaOpened: 'Design ouvert dans votre compte Canva !', canvaExportFail: 'Export Canva impossible.', pdfUnsupported: 'Export PDF impossible sur ce navigateur.', pdfFail: 'Export PDF impossible.', canvaFallback: 'Import automatique indisponible — fichier multi-calques téléchargé.', feedbackThanks: 'Merci pour votre retour !', pdfDownloaded: 'PDF téléchargé !', pleaseWaitGenerating: 'Patientez, génération en cours...', personalizeIdea: 'Personnalisez votre idée puis envoyez', feedbackSaved: 'Retour enregistré.', sessionDeleted: 'Session supprimée.', allSlidesDownloaded: 'Tous les slides sont téléchargés !', canvaPreparing: 'Préparation du fichier multi-calques...', addTemplates: 'Ajouter des modèles', templatesTitle: 'Bibliothèque de modèles', templateSaved: 'Modèle enregistré', tplSavedCount: '{n} modèle(s) enregistré(s)', libFull: 'Bibliothèque pleine (24 max) — supprime un modèle.', developMe: 'Fais-moi développer', developMeSub: 'Ajoute tes modèles, décris ton produit et ton thème — l’IA apprend ton univers et s’y tient.', productTypeLabel: 'Type de produit', productTypePh: 'Ex : pâtisserie, vêtements, cosmétiques…', themeLabel: 'Thème / style visuel', themePh: 'Ex : chaleureux et artisanal, luxe minimaliste…', aiProductExact: 'avec ton produit intégré à l’identique', fontTitleLabel: 'Police des titres', fontBodyLabel: 'Police des textes', fontAuto: 'Auto — l’IA choisit', resizedMsg: 'Voici votre design **décliné au format {fmt}** — même contenu, nouvelles proportions. Le recyclage entre formats est **gratuit** !', tplHint: 'Tes modèles servent de référence de style : l’IA s’en inspire à chaque génération pour se rapprocher de ton identité.', useTplToggle: 'Guider l’IA avec mes modèles', tplEmpty: 'Aucun modèle pour l’instant. Ajoute tes meilleures créations !', removeTpl: 'Supprimer ce modèle', aiRefUsed: '— inspirée de tes modèles', photoSavedTpl: 'Photo enregistrée dans tes modèles', addPhotoShort: 'Ajouter photo', designFormat: 'Format du design', formatSet: 'Format actif :', slidesCount: 'Nombre de slides', carouselSet: 'Carrousel configuré à {n} slides', modelHeader: 'Modèle de génération', modelSet: 'Modèle actif : {m} · {p} pts/image', seePacks: 'Voir les packs', aiRemark: 'Aura AI génère des visuels optimisés pour LinkedIn, Instagram et X. Vérifiez les textes avant publication.', firstName: 'Prénom', canvaAccount: 'Compte Canva', connectedBadge: 'CONNECTÉ', notConnectedBadge: 'NON CONNECTÉ', clearHistory: "Effacer l'historique des sessions", historyCleared: 'Historique effacé.', aboutP1: 'est un générateur de designs par IA : posts et stories pour les réseaux sociaux, carrousels, sites web, fiches produit, affiches et présentations.', aboutP2: 'Décrivez ce que vous voulez, choisissez un format, puis exportez votre création en PNG haute définition avec votre Brand Kit.', version: 'Version 1.0', canvaTitle: 'Connecter votre compte Canva', canvaIntroA: 'Ouvrez vos designs', canvaIntroB: '100% éditables', canvaIntroC: '(textes, calques et couleurs séparés) directement dans votre éditeur Canva.', canvaStep1: 'Créez une app gratuite sur', canvaStep2: "Copiez votre jeton d'accès personnel.", canvaStep3: 'Collez-le ici : vos prochains exports arriveront', canvaStep3B: 'automatiquement dans votre compte Canva', canvaOk: 'Compte Canva connecté — envoi automatique actif.', canvaTokenLabel: "Jeton d'accès Canva", canvaTokenPh: 'Collez votre jeton ici...', disconnect: 'Déconnecter', updateToken: 'Mettre à jour le jeton', connectCanva: 'Connecter Canva', canvaDisconnected: 'Compte Canva déconnecté.', referTitle: 'Parrainez vos amis', refStep1: 'Partagez votre lien', refStep2: 'Votre pote reçoit 20 pts', refStep3: 'Il paye un pack → vous gagnez 50 pts', yourCode: "Votre code d'invitation", copyLink: 'Copier le lien', linkCopied: 'Lien de parrainage copié !', copyFail: 'Copie impossible.', shareWa: 'Partager sur WhatsApp', waText: "Crée des designs de fou avec l'IA sur Aura Design — 20 points offerts avec mon lien :", referNote: "Les 50 points sont crédités automatiquement sur votre solde dès que votre filleul active son premier pack payant. Pas de limite : 3 filleuls = 150 points !", },
  en: { newDesign: 'New design', search: 'Search', templates: 'Templates', recents: 'Recents', greeting: 'Hello', subtitle: 'What are we working on today?', placeholder: 'Describe the design to create...', share: 'Share', settings: 'Settings', language: 'Language', help: 'Get help', learnMore: 'Learn more', upgrade: 'Pricing & Packs', logout: 'Log out', plan: 'Pack', commands: 'Commands', styleGrp: 'Style', ambianceGrp: 'Vibe', spacesGrp: 'Spaces', appliedToSend: 'Applied to next send', addToDesign: 'Add to design', uploadPhoto: 'Upload a photo', addAmbiance: 'Add a vibe', slashTip: 'Tip: type "/" for quick commands.', ambianceAdded: 'Vibe added', ambianceReplaced: 'Vibe replaced', ambianceRemoved: 'Vibe removed', maxChips: 'Up to 3 vibes per design.', appliedNext: 'applied to the next generation', styleDark: 'Dark design', styleLight: 'Light design', chooseAmbiance: 'Choose a vibe', packs: 'Packs', lowBalance: 'Low balance — view packs', noSessions: 'No sessions found.', backToStudio: 'Back to studio', currentBadge: 'CURRENT', packCurrent: 'Current pack', popular: 'MOST POPULAR', surDevis: 'Custom quote', forever: 'forever', perMonth: '/ month', projectDefault: 'Project', spaceDeleted: 'Space deleted.', keepOneSpace: "Can't remove: keep at least one space.", spaceCreated: 'Space created — set up its Brand Kit!', spaceActivated: 'activated — Brand Kit applied!', packLimitHit: 'space(s) max in your pack. Upgrade to add more!', pricingBadge: 'PRICING & PACKS', pricingTitleA: 'Pick your', pricingTitleB: 'pack', pricingTitleC: ', create freely', yourBalance: 'Your current balance', chooseYourPack: 'Choose your pack', tipsTitle: 'GOOD TO KNOW', brandTitle: 'Spaces & Brand Kit', brandSub: 'Each space has its own identity: logo, name, @handle and accent color applied to all your designs.', mySpaces: 'My spaces', activeBadge: 'ACTIVE', unnamed: 'Unnamed', deleteSpace: 'Delete this space', newSpace: 'New space', limitReached: 'Pack limit reached', limitReachedSub: 'Upgrade to a higher pack for more spaces', activeSpace: 'Active space', savedAuto: 'Auto-saved ✓', logoLabel: 'Brand logo', logoDrag: 'Drag your logo or browse', logoHint: 'PNG, JPG, SVG — square recommended', logoImported: 'Logo imported', logoReplace: 'Click to replace', remove: 'Remove', brandNameLabel: 'Brand name', brandHandleLabel: 'Social handle (@handle)', handleHint: 'Shown at the bottom of every design, with a verified check.', brandColorLabel: 'Accent color', colorHint: 'Used for tags, key stats, buttons and borders. Code:', previewLive: 'Live preview', previewTag: 'New collection', previewPlaceholder: 'Your brand', previewCta: 'Your CTA here ➔', previewNote: 'This preview uses your live settings. Applied on screen, in PNG HD, PDF and the multi-layer Canva export.', ambianceInfo: 'Vibe', freeBadge: 'FREE', refWelcome: 'Invite code {r} detected — your 20 welcome points are waiting!', exportUnsupported: 'Export not supported in this browser.', exportingSlide: 'Exporting slide {n}...', slideDownloaded: 'Slide {n} downloaded!', exportingAll: 'Exporting {n} slides...', exportingPdf: 'PDF export of {n} slide(s) in progress...', resizedTo: 'Design resized to {f} — free!', textCopied: 'Text copied!', linkCopiedClip: 'Link copied to clipboard!', insufficient: 'Insufficient balance: {n} points required ({c} left).', pointsSpent: '−{n} points · balance: {c} pts', generatedMany: '{n} slides generated!', generatedOne: 'New design generated!', customColor: 'Custom color', hideSidebar: 'Hide sidebar', showSidebar: 'Open sidebar', searchSessions: 'Search a session...', changeProject: 'Switch project / workspace', yourPack: 'Your pack', copyText: 'Copy text', exportAllPdf: 'Export all slides as one PDF', openInCanvaTip: 'Open this editable design in your Canva account', removePhoto: 'Remove photo', addPhotoOrVibe: 'Add a photo or a vibe', carouselTip: 'Carousel slide count', modelTip: 'Generation model', defaultBrand: 'My brand', newProject: 'New project', editBrandKit: 'Edit Brand Kit', referFriend: 'Refer a friend', loggedOutTitle: 'You are logged out', loggedOutSub: 'See you soon on Aura Design.', relogin: 'Log back in', resizeTitle: 'Resize to', resizeHint: 'Resize this design to another format (free)', editOnCanva: 'Edit on Canva', prevSlide: 'Previous', nextSlide: 'Next', aiThinking: 'Generating your design...', slideProgress: 'Slide {i}/{n}…', engineError: 'The AI engine did not respond. No points charged — try again.', partialGen: '{a}/{b} images generated — {p} points charged.', aiIntroOne: 'Here is your new design in **{fmt}** format', aiIntroMany: 'Here is your carousel — **{n} slides** in **{fmt}** format', aiStyleLight: 'in **light style**', aiPhotos: 'with {n} photo(s) included', aiChips: '— vibe: **{chips}**', aiCanvasTip: 'The Canvas below lets you view it and export in high resolution.', sugRefine: 'Refine Slide 1 text', sugRegenSlides: 'Regenerate with {n} slides', sugToCarousel: 'Switch to 4:5 Carousel format', sugExportPng: 'Export as PNG HD', sugExportPdf: 'Export as PDF', photoAdded: 'Photo added to the message', canvaConnectedToast: 'Canva account connected! Next export: auto-send.', slideCopied: 'Slide content copied!', canvaOpened: 'Design opened in your Canva account!', canvaExportFail: 'Canva export failed.', pdfUnsupported: 'PDF export not supported in this browser.', pdfFail: 'PDF export failed.', canvaFallback: 'Auto-import unavailable — multi-layer file downloaded.', feedbackThanks: 'Thanks for your feedback!', pdfDownloaded: 'PDF downloaded!', pleaseWaitGenerating: 'Hold on, generation in progress...', personalizeIdea: 'Customize your idea then send', feedbackSaved: 'Feedback saved.', sessionDeleted: 'Session deleted.', allSlidesDownloaded: 'All slides downloaded!', canvaPreparing: 'Preparing the multi-layer file...', addTemplates: 'Add templates', templatesTitle: 'Template library', templateSaved: 'Template saved', tplSavedCount: '{n} template(s) saved', libFull: 'Library full (24 max) — delete a template.', developMe: 'Develop with me', developMeSub: 'Add your templates, describe your product and theme — the AI learns your universe and sticks to it.', productTypeLabel: 'Product type', productTypePh: 'E.g.: bakery, clothing, cosmetics…', themeLabel: 'Visual theme / style', themePh: 'E.g.: warm and artisanal, minimal luxury…', aiProductExact: 'with your product reproduced exactly', fontTitleLabel: 'Headline font', fontBodyLabel: 'Body font', fontAuto: 'Auto — the AI picks', resizedMsg: 'Here is your design **resized to {fmt}** — same content, new proportions. Recycling between formats is **free**!', tplHint: 'Your templates act as style references: the AI draws inspiration from them on every generation to match your identity.', useTplToggle: 'Let the AI learn from my templates', tplEmpty: 'No templates yet. Add your best creations!', removeTpl: 'Delete this template', aiRefUsed: '— inspired by your templates', photoSavedTpl: 'Photo saved to your templates', addPhotoShort: 'Add photo', designFormat: 'Design format', formatSet: 'Active format:', slidesCount: 'Number of slides', carouselSet: 'Carousel set to {n} slides', modelHeader: 'Generation model', modelSet: 'Active model: {m} · {p} pts/image', seePacks: 'View packs', aiRemark: 'Aura AI generates visuals optimized for LinkedIn, Instagram and X. Review texts before publishing.', firstName: 'First name', canvaAccount: 'Canva account', connectedBadge: 'CONNECTED', notConnectedBadge: 'NOT CONNECTED', clearHistory: 'Clear session history', historyCleared: 'History cleared.', aboutP1: 'is an AI design generator: social posts and stories, carousels, websites, product shots, posters and presentations.', aboutP2: 'Describe what you want, pick a format, then export your creation in high-definition PNG with your Brand Kit.', version: 'Version 1.0', canvaTitle: 'Connect your Canva account', canvaIntroA: 'Open your designs', canvaIntroB: '100% editable', canvaIntroC: '(texts, layers and colors separated) directly in your Canva editor.', canvaStep1: 'Create a free app on', canvaStep2: 'Copy your personal access token.', canvaStep3: 'Paste it here: your next exports will land', canvaStep3B: 'automatically in your Canva account', canvaOk: 'Canva account connected — auto-send active.', canvaTokenLabel: 'Canva access token', canvaTokenPh: 'Paste your token here...', disconnect: 'Disconnect', updateToken: 'Update token', connectCanva: 'Connect Canva', canvaDisconnected: 'Canva account disconnected.', referTitle: 'Refer your friends', refStep1: 'Share your link', refStep2: 'Your friend gets 20 pts', refStep3: 'They buy a pack → you earn 50 pts', yourCode: 'Your invite code', copyLink: 'Copy link', linkCopied: 'Referral link copied!', copyFail: 'Copy failed.', shareWa: 'Share on WhatsApp', waText: 'Create amazing AI designs on Aura Design — 20 free points with my link:', referNote: 'The 50 points are credited automatically to your balance as soon as your referral activates their first paid pack. No limit: 3 referrals = 150 points!', },
  ar: { newDesign: 'تصميم جديد', search: 'بحث', brandKit: 'هوية العلامة', templates: 'قوالب', recents: 'الأخيرة', greeting: 'مرحباً', subtitle: 'على ماذا سنعمل اليوم؟', placeholder: 'صف التصميم المطلوب...', share: 'مشاركة', settings: 'الإعدادات', language: 'اللغة', help: 'احصل على مساعدة', learnMore: 'اعرف المزيد', upgrade: 'ترقية الباقة', logout: 'تسجيل الخروج', plan: 'الباقة', commands: 'الأوامر', styleGrp: 'النمط', ambianceGrp: 'الأجواء', spacesGrp: 'المساحات', appliedToSend: 'يُطبق عند الإرسال', addToDesign: 'أضف إلى التصميم', uploadPhoto: 'تحميل صورة', addAmbiance: 'أضف أجواءً', slashTip: 'نصيحة: اكتب "/" للأوامر السريعة.', ambianceAdded: 'تمت إضافة الأجواء', ambianceReplaced: 'تم استبدال الأجواء', ambianceRemoved: 'تمت إزالة الأجواء', maxChips: 'الحد الأقصى 3 أجواء لكل تصميم.', appliedNext: 'سيُطبق على التوليد التالي', styleDark: 'تصميم داكن', styleLight: 'تصميم فاتح', chooseAmbiance: 'اختر أجواءً', packs: 'الباقات', lowBalance: 'الرصيد منخفض — اعرض الباقات', noSessions: 'لا توجد جلسات.', backToStudio: 'العودة إلى الاستوديو', currentBadge: 'الحالي', packCurrent: 'الباقة الحالية', popular: 'الأكثر شيوعاً', surDevis: 'حسب الطلب', forever: 'للأبد', perMonth: '/ شهر', projectDefault: 'مشروع', spaceDeleted: 'تم حذف المساحة.', keepOneSpace: 'غير ممكن: احتفظ بمساحة واحدة على الأقل.', spaceCreated: 'تم إنشاء المساحة — جهّز هوية علامتها!', spaceActivated: 'مفعّلة — تم تطبيق هوية العلامة!', packLimitHit: 'مساحة كحد أقصى في باقتك. رقِّ باقتك لإضافة المزيد!', pricingBadge: 'الأسعار والباقات', pricingTitleA: 'اختر', pricingTitleB: 'باقتك', pricingTitleC: ' وأنشئ بحرية', yourBalance: 'رصيدك الحالي', chooseYourPack: 'اختر باقتك', tipsTitle: 'نصائح مهمة', brandTitle: 'المساحات وهوية العلامة', brandSub: 'لكل مساحة هويتها الخاصة: الشعار والاسم والمعرّف واللون تُطبق تلقائياً على كل تصميماتك.', mySpaces: 'مساحاتي', activeBadge: 'نشطة', unnamed: 'بدون اسم', deleteSpace: 'احذف هذه المساحة', newSpace: 'مساحة جديدة', limitReached: 'بلغت حد الباقة', limitReachedSub: 'رقِّ باقتك للحصول على مساحات أكثر', activeSpace: 'المساحة النشطة', savedAuto: 'محفوظ تلقائياً ✓', logoLabel: 'شعار العلامة', logoDrag: 'أسقط شعارك أو تصفح', logoHint: 'PNG, JPG, SVG — يفضّل مربع', logoImported: 'تم استيراد الشعار', logoReplace: 'انقر للاستبدال', remove: 'إزالة', brandNameLabel: 'اسم العلامة', brandHandleLabel: 'معرّف التواصل (@handle)', handleHint: 'يظهر أسفل كل تصميم مع علامة التوثيق.', brandColorLabel: 'لون التمييز', colorHint: 'يُستخدم للوسوم والأرقام المفتاحية والأزرار والحدود. الرمز:', previewLive: 'معاينة مباشرة', previewTag: 'مجموعة جديدة', previewPlaceholder: 'علامتك', previewCta: 'زر الإجراء هنا ➔', previewNote: 'تستخدم هذه المعاينة إعداداتك المباشرة. تُطبق على الشاشة وفي PNG HD وPDF وتصدير Canva متعدد الطبقات.', ambianceInfo: 'أجواء', freeBadge: 'مجاناً', refWelcome: 'تم اكتشاف رمز الدعوة {r} — 20 نقطة الترحيب الخاصة بك في انتظارك!', exportUnsupported: 'التصدير غير مدعوم في هذا المتصفح.', exportingSlide: 'جارٍ تصدير الشريحة {n}...', slideDownloaded: 'تم تنزيل الشريحة {n}!', exportingAll: 'جارٍ تصدير {n} شرائح...', exportingPdf: 'جارٍ تصدير PDF لـ{n} شريحة...', resizedTo: 'تم تحويل التصميم إلى {f} — مجاناً!', textCopied: 'تم نسخ النص!', linkCopiedClip: 'تم نسخ الرابط إلى الحافظة!', insufficient: 'الرصيد غير كافٍ: {n} نقطة مطلوبة (متبقٍ {c}).', pointsSpent: '−{n} نقطة · الرصيد: {c}', generatedMany: 'تم توليد {n} شرائح!', generatedOne: 'تم توليد تصميم جديد!', customColor: 'لون مخصص', hideSidebar: 'إخفاء الشريط الجانبي', showSidebar: 'فتح الشريط الجانبي', searchSessions: 'ابحث عن جلسة...', changeProject: 'تغيير المشروع / مساحة العمل', yourPack: 'باقتك', copyText: 'نسخ النص', exportAllPdf: 'تصدير كل الشرائح في PDF واحد', openInCanvaTip: 'افتح هذا التصميم القابل للتعديل في حسابك على Canva', removePhoto: 'إزالة الصورة', addPhotoOrVibe: 'أضف صورة أو أجواءً', carouselTip: 'عدد شرائح الكاروسيل', modelTip: 'نموذج التوليد', defaultBrand: 'علامتي', newProject: 'مشروع جديد', editBrandKit: 'تعديل هوية العلامة', referFriend: 'أحِل صديقاً', loggedOutTitle: 'تم تسجيل خروجك', loggedOutSub: 'إلى اللقاء على Aura Design.', relogin: 'إعادة الاتصال', resizeTitle: 'تحويل إلى', resizeHint: 'حوّل هذا التصميم إلى صيغة أخرى (مجاناً)', editOnCanva: 'تعديل في Canva', prevSlide: 'السابق', nextSlide: 'التالي', aiThinking: 'جارٍ توليد تصميمك...', slideProgress: 'الشريحة {i}/{n}…', engineError: 'لم يستجب محرك الذكاء الاصطناعي. لم تُخصم أي نقاط — أعد المحاولة.', partialGen: 'تم توليد {a}/{b} صورة — خُصم {p} نقطة.', aiIntroOne: 'إليك تصميمك الجديد بصيغة **{fmt}**', aiIntroMany: 'إليك الكاروسيل — **{n} شرائح** بصيغة **{fmt}**', aiStyleLight: 'ب**نمط فاتح**', aiPhotos: 'مع {n} صورة مدمجة', aiChips: '— أجواء: **{chips}**', aiCanvasTip: 'يسمح لك Canvas أدناه بعرضه وتصديره بجودة عالية.', sugRefine: 'حسّن نص الشريحة 1', sugRegenSlides: 'أعد التوليد بـ{n} شرائح', sugToCarousel: 'حوّل إلى كاروسيل 4:5', sugExportPng: 'صدّر PNG HD', sugExportPdf: 'صدّر PDF', photoAdded: 'تمت إضافة الصورة إلى الرسالة', canvaConnectedToast: 'تم ربط حساب Canva! التصدير القادم: إرسال تلقائي.', slideCopied: 'تم نسخ محتوى الشريحة!', canvaOpened: 'تم فتح التصميم في حسابك على Canva!', canvaExportFail: 'فشل تصدير Canva.', pdfUnsupported: 'تصدير PDF غير مدعوم في هذا المتصفح.', pdfFail: 'فشل تصدير PDF.', canvaFallback: 'الاستيراد التلقائي غير متاح — تم تنزيل الملف متعدد الطبقات.', feedbackThanks: 'شكراً على ملاحظاتك!', pdfDownloaded: 'تم تنزيل PDF!', pleaseWaitGenerating: 'انتظر، جارٍ التوليد...', personalizeIdea: 'خصّص فكرتك ثم أرسل', feedbackSaved: 'تم حفظ الملاحظة.', sessionDeleted: 'تم حذف الجلسة.', allSlidesDownloaded: 'تم تنزيل كل الشرائح!', canvaPreparing: 'جارٍ تحضير الملف متعدد الطبقات...', addTemplates: 'أضف قوالب', templatesTitle: 'مكتبة القوالب', templateSaved: 'تم حفظ القالب', tplSavedCount: 'تم حفظ {n} قالب', libFull: 'المكتبة ممتلئة (24 كحد أقصى) — احذف قالباً.', developMe: 'طوّر معي', developMeSub: 'أضف قوالبيك وصف منتجك وثيمك — الذكاء الاصطناعي يتعلّم عالمك ويلتزم به.', productTypeLabel: 'نوع المنتج', productTypePh: 'مثال: حلويات، ملابس، مستحضرات تجميل…', themeLabel: 'الثيم / الأسلوب البصري', themePh: 'مثال: دافئ وحرفي، فخامة بسيطة…', aiProductExact: 'مع منتجك مدمجاً كما هو تماماً', fontTitleLabel: 'خط العناوين', fontBodyLabel: 'خط النصوص', fontAuto: 'تلقائي — الذكاء الاصطناعي يختار', resizedMsg: 'إليك تصميمك **محوّلاً إلى {fmt}** — نفس المحتوى بأبعاد جديدة. إعادة التدوير بين الصيغ **مجانية**!', tplHint: 'قوالبيك مرجع للأسلوب: يستلهم منها الذكاء الاصطناعي في كل توليد ليقترب من هويتك.', useTplToggle: 'دع الذكاء الاصطناعي يتعلم من قوالبي', tplEmpty: 'لا توجد قوالب بعد. أضف أفضل تصميماتك!', removeTpl: 'احذف هذا القالب', aiRefUsed: '— مستوحاة من قوالبيك', photoSavedTpl: 'تم حفظ الصورة في قوالبيك', addPhotoShort: 'أضف صورة', designFormat: 'صيغة التصميم', formatSet: 'الصيغة النشطة:', slidesCount: 'عدد الشرائح', carouselSet: 'تم ضبط الكاروسيل على {n} شرائح', modelHeader: 'نموذج التوليد', modelSet: 'النموذج النشط: {m} · {p} نقطة/صورة', seePacks: 'عرض الباقات', aiRemark: 'يولّد Aura AI تصاميم محسّنة لـLinkedIn وInstagram وX. راجع النصوص قبل النشر.', firstName: 'الاسم الأول', canvaAccount: 'حساب Canva', connectedBadge: 'متصل', notConnectedBadge: 'غير متصل', clearHistory: 'مسح سجل الجلسات', historyCleared: 'تم مسح السجل.', aboutP1: 'هو مولّد تصاميم بالذكاء الاصطناعي: منشورات وستوريات للشبكات الاجتماعية، كاروسيل، مواقع، صور منتجات، ملصقات وعروض تقديمية.', aboutP2: 'صِف ما تريد، اختر صيغة، ثم صدّر تصميمك بجودة PNG عالية مع هوية علامتك.', version: 'الإصدار 1.0', canvaTitle: 'اربط حسابك في Canva', canvaIntroA: 'افتح تصاميمك', canvaIntroB: 'قابلة للتعديل 100%', canvaIntroC: '(نصوص وطبقات وألوان منفصلة) مباشرة في محرر Canva.', canvaStep1: 'أنشئ تطبيقاً مجانياً على', canvaStep2: 'انسخ رمز الوصول الشخصي.', canvaStep3: 'الصقه هنا: ستصل صادراتك القادمة', canvaStep3B: 'تلقائياً إلى حسابك في Canva', canvaOk: 'تم ربط حساب Canva — الإرسال التلقائي مفعّل.', canvaTokenLabel: 'رمز وصول Canva', canvaTokenPh: 'الصق رمزك هنا...', disconnect: 'قطع الاتصال', updateToken: 'تحديث الرمز', connectCanva: 'ربط Canva', canvaDisconnected: 'تم فصل حساب Canva.', referTitle: 'أحِل أصدقاءك', refStep1: 'شارك رابطك', refStep2: 'صديقك يحصل على 20 نقطة', refStep3: 'يشتري باقة → تربح 50 نقطة', yourCode: 'رمز الدعوة', copyLink: 'انسخ الرابط', linkCopied: 'تم نسخ رابط الدعوة!', copyFail: 'فشل النسخ.', shareWa: 'شارك على واتساب', waText: 'أنشئ تصاميم مذهلة بالذكاء الاصطناعي على Aura Design — 20 نقطة مجاناً عبر رابطي:', referNote: 'تُضاف النقاط الخمسون تلقائياً إلى رصيدك فور تفعيل المُحال أول باقة مدفوعة. بلا حدود: 3 إحالات = 150 نقطة!', },
};
const LANGS: { id: Lang; label: string }[] = [
  { id: 'fr', label: 'Français' },
  { id: 'en', label: 'English' },
  { id: 'ar', label: 'العربية' },
];
const FAQ_BY_LANG: Record<Lang, { q: string; a: string }[]> = {
  fr: [
    { q: 'Quels types de designs puis-je créer ?', a: 'Posts et stories pour les réseaux sociaux, carrousels, sites web, fiches produit, affiches et présentations. Choisissez le format dans la barre de saisie.' },
    { q: 'Comment exporter mon design ?', a: "Dans le Canvas, cliquez sur « PNG HD » pour télécharger le slide affiché, ou utilisez la suggestion « Télécharger les slides en PNG » pour tout exporter." },
    { q: 'Comment appliquer ma marque ?', a: "Ouvrez Brand Kit : logo, nom, identifiant et couleur d'accentuation sont appliqués à tous vos designs." },
    { q: 'Raccourcis utiles', a: 'Entrée pour envoyer, Échap pour fermer une fenêtre ou un menu.' },
  ],
  en: [
    { q: 'What kinds of designs can I create?', a: 'Social posts and stories, carousels, websites, product shots, posters and presentations. Pick the format in the input bar.' },
    { q: 'How do I export my design?', a: 'In the Canvas, click “PNG HD” to download the displayed slide, or use the “Download slides as PNG” suggestion to export everything.' },
    { q: 'How do I apply my brand?', a: 'Open Brand Kit: logo, name, handle and accent color are applied to all your designs.' },
    { q: 'Useful shortcuts', a: 'Enter to send, Esc to close a window or menu.' },
  ],
  ar: [
    { q: 'ما أنواع التصاميم التي يمكنني إنشاؤها؟', a: 'منشورات وستوريات للشبكات الاجتماعية، كاروسيل، مواقع، صور منتجات، ملصقات وعروض تقديمية. اختر الصيغة من شريط الكتابة.' },
    { q: 'كيف أصدّر تصميمي؟', a: 'في Canvas، انقر «PNG HD» لتنزيل الشريحة المعروضة، أو استخدم اقتراح «تنزيل الشرائح PNG» لتصدير الكل.' },
    { q: 'كيف أطبّق علامتي؟', a: 'افتح هوية العلامة: الشعار والاسم والمعرّف ولون التمييز تُطبق على كل تصميماتك.' },
    { q: 'اختصارات مفيدة', a: 'Enter للإرسال، Esc لإغلاق نافذة أو قائمة.' },
  ],
};

interface TemplateItem { id: string; data: string; name: string; at: number }
interface BrandProfile { productType: string; theme: string }

const TEMPLATE_MAX = 24;

const downscaleDataUrl = (dataUrl: string, max = 512, quality = 0.72): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('img'));
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('ctx'));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });

const downscaleImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => resolve(downscaleDataUrl(reader.result as string));
    reader.readAsDataURL(file);
  });

interface FontPair { title: string; body: string }

// Catalogue open source (Google Fonts) — chargé à la demande, rien n'est embarqué.
// L'IA choisit dans ce catalogue selon le sujet/l'ambiance ; l'utilisateur peut
// figer les polices de sa marque dans le Brand Kit.
const TITLE_FONTS: { name: string; vibe: string }[] = [
  { name: 'Playfair Display', vibe: 'luxe éditorial' },
  { name: 'Cormorant Garamond', vibe: 'élégance classique' },
  { name: 'DM Serif Display', vibe: 'éditorial moderne' },
  { name: 'Marcellus', vibe: 'premium intemporel' },
  { name: 'Cinzel', vibe: 'majestueux' },
  { name: 'Fraunces', vibe: 'artisanal chaleureux' },
  { name: 'Libre Baskerville', vibe: 'sérieux classique' },
  { name: 'Lora', vibe: 'littéraire doux' },
  { name: 'Abril Fatface', vibe: 'mode magazine' },
  { name: 'Bebas Neue', vibe: 'impact affiche' },
  { name: 'Anton', vibe: 'impact maximal' },
  { name: 'Archivo Black', vibe: 'audacieux poster' },
  { name: 'Oswald', vibe: 'condensé sport' },
  { name: 'League Spartan', vibe: 'jeune audacieux' },
  { name: 'Alfa Slab One', vibe: 'fun rétro' },
  { name: 'Space Grotesk', vibe: 'tech moderne' },
  { name: 'El Messiri', vibe: 'arabe élégant' },
  { name: 'Changa', vibe: 'arabe impact' },
  { name: 'Lalezar', vibe: 'arabe display' },
  { name: 'Reem Kufi', vibe: 'arabe kufi moderne' },
  { name: 'Noto Kufi Arabic', vibe: 'arabe géométrique' },
  { name: 'Amiri', vibe: 'arabe classique' },
  { name: 'Markazi Text', vibe: 'arabe éditorial' },
  { name: 'Dancing Script', vibe: 'manuscrit romantique' },
  { name: 'Great Vibes', vibe: 'signature luxe' },
  { name: 'Caveat', vibe: 'manuscrit casual' },
  { name: 'Pacifico', vibe: 'rétro fun' },
];
const BODY_FONTS: { name: string; vibe: string }[] = [
  { name: 'Inter', vibe: 'neutre universel' },
  { name: 'Manrope', vibe: 'moderne doux' },
  { name: 'Outfit', vibe: 'géométrique jeune' },
  { name: 'Sora', vibe: 'startup tech' },
  { name: 'Urbanist', vibe: 'épuré' },
  { name: 'Plus Jakarta Sans', vibe: 'chaleureux moderne' },
  { name: 'Work Sans', vibe: 'pro humaniste' },
  { name: 'Figtree', vibe: 'amical lisible' },
  { name: 'Public Sans', vibe: 'institutionnel' },
  { name: 'Nunito Sans', vibe: 'rond doux' },
  { name: 'Poppins', vibe: 'géométrique populaire' },
  { name: 'Quicksand', vibe: 'léger fun' },
  { name: 'Baloo 2', vibe: 'fun arrondi' },
  { name: 'Fredoka', vibe: 'fun amical' },
  { name: 'Comfortaa', vibe: 'doux futuriste' },
  { name: 'JetBrains Mono', vibe: 'code tech' },
  { name: 'IBM Plex Mono', vibe: 'tech éditorial' },
  { name: 'Space Mono', vibe: 'tech rétro' },
  { name: 'Merriweather', vibe: 'serif lisible' },
  { name: 'Newsreader', vibe: 'presse éditorial' },
  { name: 'Source Serif 4', vibe: 'serif pro' },
  { name: 'Epilogue', vibe: 'mode moderne' },
  { name: 'Cairo', vibe: 'arabe sans moderne' },
  { name: 'Tajawal', vibe: 'arabe épuré' },
  { name: 'Almarai', vibe: 'arabe lisible' },
  { name: 'Mada', vibe: 'arabe minimal' },
  { name: 'Readex Pro', vibe: 'arabe moderne' },
  { name: 'IBM Plex Sans Arabic', vibe: 'arabe corporate' },
  { name: 'Scheherazade New', vibe: 'arabe traditionnel' },
];
const DEFAULT_FONTS: FontPair = { title: 'Space Grotesk', body: 'Inter' };
const VALID_FONT_NAMES = new Set([...TITLE_FONTS, ...BODY_FONTS].map((f) => f.name));

const fontCache = new Set<string>();
const ensureFontLoaded = (family: string, weights: number[] = [400, 600, 700]): Promise<void> => {
  if (!family || fontCache.has(family)) return Promise.resolve();
  fontCache.add(family);
  const id = family.replace(/[^a-z0-9]/gi, '');
  if (!document.getElementById(`gf_${id}`)) {
    const link = document.createElement('link');
    link.id = `gf_${id}`;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${weights.join(';')}&display=swap`;
    document.head.appendChild(link);
  }
  return Promise.all(weights.map((w) => document.fonts.load(`${w} 32px "${family}"`).catch(() => null))).then(() => undefined);
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
};

async function slideToPngBlob(
  slide: Slide,
  format: FormatType,
  total: number,
  brand: { name: string; handle: string; color: string },
  opts?: { watermark?: boolean; mime?: 'image/png' | 'image/jpeg'; light?: boolean; fonts?: FontPair }
): Promise<Blob | null> {
  const { w, h } = FORMATS[format];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const titleFont = opts?.fonts?.title || DEFAULT_FONTS.title;
  const bodyFont = opts?.fonts?.body || DEFAULT_FONTS.body;
  try {
    await Promise.all([
      ensureFontLoaded(titleFont, [600, 700]),
      ensureFontLoaded(bodyFont, [400, 500, 600, 700]),
    ]);
  } catch {}
  const FT = (weight: number, size: number) => `${weight} ${size}px "${titleFont}", Poppins, system-ui, sans-serif`;
  const F = (weight: number, size: number) => `${weight} ${size}px "${bodyFont}", Poppins, system-ui, sans-serif`;
  const isLight = !!opts?.light;

  ctx.fillStyle = isLight ? '#FFFFFF' : '#18181b';
  ctx.fillRect(0, 0, w, h);

  if (slide.image) {
    const img = await loadImage(slide.image);
    if (img) {
      const r = Math.max(w / img.width, h / img.height);
      ctx.globalAlpha = slide.heroShot ? 1 : 0.22;
      ctx.drawImage(img, (w - img.width * r) / 2, (h - img.height * r) / 2, img.width * r, img.height * r);
      ctx.globalAlpha = 1;
    }
  }
  const grad = ctx.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0, isLight ? 'rgba(255,255,255,0.97)' : 'rgba(9,9,11,0.95)');
  grad.addColorStop(0.6, isLight ? 'rgba(255,255,255,0.75)' : 'rgba(9,9,11,0.7)');
  grad.addColorStop(1, isLight ? 'rgba(255,255,255,0.05)' : 'rgba(9,9,11,0.1)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const pad = 90;
  ctx.textBaseline = 'alphabetic';

  // Header
  ctx.fillStyle = brand.color;
  ctx.beginPath();
  ctx.roundRect(pad, 80, 56, 56, 14);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.font = F(700, 22);
  ctx.textAlign = 'center';
  ctx.fillText(brand.name.slice(0, 2).toUpperCase(), pad + 28, 116);
  ctx.textAlign = 'left';
  ctx.fillStyle = isLight ? '#18181B' : '#fff';
  ctx.font = F(600, 28);
  ctx.fillText(brand.name.toUpperCase(), pad + 76, 117);
  ctx.textAlign = 'right';
  ctx.fillStyle = brand.color;
  ctx.font = F(600, 26);
  ctx.fillText(`${String(slide.slideNumber).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, w - pad, 116);
  ctx.textAlign = 'left';

  // Body
  const big = format === 'story' ? 88 : w > h ? 70 : 78;
  const maxW = Math.min(w - pad * 2, 1100);
  let y = Math.round(h * 0.26);

  ctx.fillStyle = brand.color;
  ctx.font = FT(600, 26);
  ctx.fillText(slide.tag.toUpperCase(), pad, y);
  y += 90;

  ctx.font = FT(700, big);
  ctx.fillStyle = isLight ? '#18181B' : '#fff';
  for (const line of wrapLines(ctx, slide.title, maxW)) {
    ctx.fillText(line, pad, y);
    y += big * 1.18;
  }
  y += 20;

  ctx.font = F(400, 36);
  ctx.fillStyle = isLight ? '#52525B' : '#d4d4d8';
  for (const line of wrapLines(ctx, slide.subtitle, maxW)) {
    ctx.fillText(line, pad, y);
    y += 54;
  }
  y += 24;

  if (slide.stat) {
    ctx.font = FT(700, 120);
    ctx.fillStyle = brand.color;
    ctx.fillText(slide.stat.value, pad, y + 100);
    y += 150;
    ctx.font = F(400, 30);
    ctx.fillStyle = isLight ? '#71717A' : '#a1a1aa';
    for (const line of wrapLines(ctx, slide.stat.label, maxW)) {
      ctx.fillText(line, pad, y + 20);
      y += 44;
    }
  }

  if (slide.bulletPoints) {
    ctx.font = F(500, 34);
    for (const bp of slide.bulletPoints) {
      ctx.fillStyle = brand.color;
      ctx.beginPath();
      ctx.arc(pad + 14, y - 10, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isLight ? '#3F3F46' : '#e4e4e7';
      for (const line of wrapLines(ctx, bp, maxW - 60)) {
        ctx.fillText(line, pad + 50, y);
        y += 50;
      }
      y += 12;
    }
  }

  // Footer
  ctx.fillStyle = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.15)';
  ctx.fillRect(pad, h - 150, w - pad * 2, 2);
  ctx.fillStyle = isLight ? '#18181B' : '#fff';
  ctx.font = F(600, 28);
  ctx.textAlign = 'left';
  ctx.fillText(brand.handle, pad, h - 90);
  if (slide.ctaText) {
    ctx.textAlign = 'right';
    ctx.fillStyle = brand.color;
    ctx.font = FT(600, 24);
    ctx.fillText(slide.ctaText.slice(0, 40), w - pad, h - 90);
    ctx.textAlign = 'left';
  }

  // Filigrane pack Gratuit
  if (opts?.watermark) {
    const wmText = 'Fait avec Aura Design';
    ctx.font = F(600, 24);
    const tw = ctx.measureText(wmText).width;
    const pw = tw + 80;
    const ph = 50;
    const px0 = (w - pw) / 2;
    const py0 = h - 74;
    ctx.fillStyle = isLight ? 'rgba(24,24,27,0.08)' : 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.roundRect(px0, py0, pw, ph, 25);
    ctx.fill();
    ctx.strokeStyle = isLight ? 'rgba(24,24,27,0.22)' : 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = isLight ? '#F59E0B' : 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(px0 + 30, py0 + ph / 2, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isLight ? 'rgba(24,24,27,0.85)' : 'rgba(255,255,255,0.92)';
    ctx.textAlign = 'left';
    ctx.fillText(wmText, px0 + 50, py0 + ph / 2 + 8);
    ctx.textAlign = 'left';
  }

  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), opts?.mime || 'image/png', opts?.mime === 'image/jpeg' ? 0.92 : undefined)
  );
}

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
};

const inferOpts = (text: string): { format?: FormatType; count?: number } => {
  const l = text.toLowerCase();
  const has = (...k: string[]) => k.some((x) => l.includes(x));
  const format: FormatType | undefined = has('carrousel', 'carousel')
    ? 'scroller'
    : has('story')
    ? 'story'
    : has('site web', 'website', 'landing', 'page d\'accueil')
    ? 'website'
    : has('présentation', 'presentation', 'pitch deck')
    ? 'presentation'
    : has('fiche produit', 'produit', 'packshot', 'product')
    ? 'product'
    : has('affiche', 'poster', 'flyer')
    ? 'poster'
    : has('carré', 'citation')
    ? 'square'
    : undefined;
  const m = l.match(/(\d+)\s*slides/);
  return { format, count: m ? Math.max(2, Math.min(12, parseInt(m[1], 10))) : undefined };
};

const loadBrand = (): { name?: string; handle?: string; color?: string } => {
  try {
    return JSON.parse(localStorage.getItem('aura_brand') || '{}');
  } catch {
    return {};
  }
};

// Réinitialise les états obsolètes de l'ancien système (ex. plan Pro mémorisé avec 0 points)
try {
  if (!localStorage.getItem('aura_pricing_v2')) {
    localStorage.removeItem('aura_plan');
    localStorage.removeItem('aura_credits');
    localStorage.setItem('aura_pricing_v2', '1');
  }
} catch {}

const loadJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export type ModelId = 'flash' | 'studio' | 'pro';

const getReferralCode = (): string => {
  try {
    let code = localStorage.getItem('aura_ref_code');
    if (!code) {
      code = `AURA-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      localStorage.setItem('aura_ref_code', code);
    }
    return code;
  } catch {
    return 'AURA-DESIGN';
  }
};
type Loc = { fr: string; en: string; ar: string };
const MODELS: { id: ModelId; name: string; points: number; desc: Loc; badge?: string }[] = [
  { id: 'flash', name: 'Aura Flash', points: 5, badge: 'ÉCO', desc: { fr: 'Rapide et économique — parfait pour les petits visuels et posts quotidiens.', en: 'Fast & affordable — perfect for small visuals and daily posts.', ar: 'سريع واقتصادي — مثالي للتصاميم الصغيرة والمنشورات اليومية.' } },
  { id: 'studio', name: 'Aura Studio', points: 10, desc: { fr: 'HD équilibré — le juste milieu qualité / points pour vos contenus réguliers.', en: 'Balanced HD — the quality/points sweet spot for your regular content.', ar: 'جودة HD متوازنة — الوسط المثالي بين الجودة والنقاط لمحتواك المنتظم.' } },
  { id: 'pro', name: 'Aura Pro Max', points: 20, badge: 'MAX QUALITÉ', desc: { fr: 'Qualité maximale — réservé aux projets et campagnes importants.', en: 'Maximum quality — reserved for major projects and campaigns.', ar: 'أقصى جودة — مخصص للمشاريع والحملات المهمة.' } },
];
const MODEL_POINTS: Record<ModelId, number> = { flash: 5, studio: 10, pro: 20 };

// ---------- PACKS COMMERCIAUX (Option A) ----------
// 1 image générée = 5 pts (Flash) / 10 pts (Studio) / 20 pts (Pro Max)
const PRICING: {
  id: PlanId | 'business';
  name: Loc;
  price?: string;
  period?: Loc;
  points?: Loc;
  tagline: Loc;
  features: Record<Lang, string[]>;
  cta: Loc;
  highlight?: boolean;
  ribbon?: Loc;
}[] = [
  {
    id: 'free',
    name: { fr: 'Gratuit', en: 'Free', ar: 'مجاني' },
    price: '0 DA',
    period: { fr: 'pour toujours', en: 'forever', ar: 'للأبد' },
    points: { fr: '20 points offerts', en: '20 free points', ar: '20 نقطة مجاناً' },
    tagline: { fr: 'Pour découvrir la magie', en: 'Discover the magic', ar: 'لاكتشاف السحر' },
    features: {
      fr: ['20 points de bienvenue', 'Aura Flash inclus (5 pts/image)', 'Export PNG HD', '1 Brand Kit', 'Export multi-calques Canva'],
      en: ['20 welcome points', 'Aura Flash included (5 pts/image)', 'PNG HD export', '1 Brand Kit', 'Multi-layer Canva export'],
      ar: ['20 نقطة ترحيبية', 'Aura Flash مضمّن (5 نقاط/صورة)', 'تصدير PNG HD', 'هوية علامة واحدة', 'تصدير Canva متعدد الطبقات'],
    },
    cta: { fr: 'Commencer gratuitement', en: 'Start for free', ar: 'ابدأ مجاناً' },
  },
  {
    id: 'starter',
    name: { fr: 'Starter', en: 'Starter', ar: 'ستارتر' },
    price: '1 900 DA',
    period: { fr: '/ mois', en: '/ month', ar: '/ شهر' },
    points: { fr: '150 points / mois', en: '150 points / month', ar: '150 نقطة / شهر' },
    tagline: { fr: 'Pour les créateurs & indépendants', en: 'For creators & freelancers', ar: 'للمبدعين والمستقلين' },
    features: {
      fr: ['150 points chaque mois', 'Les 3 modèles : Flash · Studio · Pro Max', 'Carrousels multi-slides', 'Export PNG HD illimité', 'Brand Kit complet (logo, couleurs)', 'Envoi direct vers Canva'],
      en: ['150 points every month', 'All 3 models: Flash · Studio · Pro Max', 'Multi-slide carousels', 'Unlimited PNG HD export', 'Full Brand Kit (logo, colors)', 'Direct send to Canva'],
      ar: ['150 نقطة كل شهر', 'النماذج الثلاثة: Flash · Studio · Pro Max', 'كاروسيل متعدد الشرائح', 'تصدير PNG HD غير محدود', 'هوية علامة كاملة (شعار، ألوان)', 'إرسال مباشر إلى Canva'],
    },
    cta: { fr: 'Choisir Starter', en: 'Choose Starter', ar: 'اختر ستارتر' },
    highlight: true,
    ribbon: { fr: 'LE PLUS POPULAIRE', en: 'MOST POPULAR', ar: 'الأكثر شيوعاً' },
  },
  {
    id: 'pro',
    name: { fr: 'Pro', en: 'Pro', ar: 'برو' },
    price: '4 900 DA',
    period: { fr: '/ mois', en: '/ month', ar: '/ شهر' },
    points: { fr: '450 points / mois', en: '450 points / month', ar: '450 نقطة / شهر' },
    tagline: { fr: 'Pour les marques en croissance', en: 'For growing brands', ar: 'للعلامات النامية' },
    features: {
      fr: ['450 points chaque mois', 'Les 3 modèles : Flash · Studio · Pro Max', 'Carrousels multi-slides illimités', 'Export PNG HD illimité', '3 Brand Kits multiples', 'Envoi direct vers Canva', 'Support prioritaire'],
      en: ['450 points every month', 'All 3 models: Flash · Studio · Pro Max', 'Unlimited multi-slide carousels', 'Unlimited PNG HD export', '3 Brand Kits', 'Direct send to Canva', 'Priority support'],
      ar: ['450 نقطة كل شهر', 'النماذج الثلاثة: Flash · Studio · Pro Max', 'كاروسيل متعدد الشرائح غير محدود', 'تصدير PNG HD غير محدود', '3 هويات علامات', 'إرسال مباشر إلى Canva', 'دعم ذو أولوية'],
    },
    cta: { fr: 'Choisir Pro', en: 'Choose Pro', ar: 'اختر برو' },
  },
  {
    id: 'business',
    name: { fr: 'Business & Agences', en: 'Business & Agencies', ar: 'الأعمال والوكالات' },
    price: 'Sur devis',
    period: { fr: 'tarification négociée', en: 'negotiated pricing', ar: 'تسعير تفاوضي' },
    points: { fr: 'Points sur mesure', en: 'Custom points', ar: 'نقاط حسب الطلب' },
    tagline: { fr: 'Volume élevé, équipe & revente', en: 'High volume, teams & resale', ar: 'حجم كبير، فرق وإعادة بيع' },
    features: {
      fr: ['Volume de points personnalisé', 'Tarifs dégressifs par volume', 'Espace multi-équipes', 'Droits commerciaux (revendeur)', 'Onboarding & support dédié'],
      en: ['Custom points volume', 'Volume-based tiered pricing', 'Multi-team workspace', 'Commercial rights (reseller)', 'Dedicated onboarding & support'],
      ar: ['حجم نقاط مخصص', 'أسعار تنازلية حسب الحجم', 'مساحة متعددة الفرق', 'حقوق تجارية (إعادة بيع)', 'تهيئة ودعم مخصصان'],
    },
    cta: { fr: "Contacter l'équipe", en: 'Contact the team', ar: 'تواصل مع الفريق' },
  },
];

const PRICING_TIPS: { icon: 'lightbulb' | 'rocket'; tone: 'eco' | 'pro'; title: Loc; text: Loc }[] = [
  {
    icon: 'lightbulb',
    tone: 'eco',
    title: { fr: 'Petits visuels, posts quotidiens, stories simples ?', en: 'Small visuals, daily posts, simple stories?', ar: 'تصاميم صغيرة، منشورات يومية، ستوريات بسيطة؟' },
    text: {
      fr: 'Économisez vos points avec Aura Flash (5 pts) — rapide, léger et parfait pour les contenus du quotidien.',
      en: 'Save your points with Aura Flash (5 pts) — fast, light and perfect for everyday content.',
      ar: 'وفّر نقاطك مع Aura Flash (5 نقاط) — سريع وخفيف ومثالي للمحتوى اليومي.',
    },
  },
  {
    icon: 'rocket',
    tone: 'pro',
    title: { fr: 'Lancement produit, campagne majeure, visuel premium ?', en: 'Product launch, major campaign, premium visual?', ar: 'إطلاق منتج، حملة كبرى، تصميم فاخر؟' },
    text: {
      fr: 'Utilisez Aura Pro Max (20 pts) : la qualité maximale pour vos projets les plus importants. Aura Studio (10 pts) reste le juste milieu HD.',
      en: 'Use Aura Pro Max (20 pts): maximum quality for your most important projects. Aura Studio (10 pts) is the HD middle ground.',
      ar: 'استخدم Aura Pro Max (20 نقطة): أقصى جودة لأهم مشاريعك. Aura Studio (10 نقاط) هو الوسط المتوازن بجودة HD.',
    },
  },
];

// ============================================================
// PAGE /pricing — design d'origine (grille de packs), localisée
// ============================================================
function PricingPage({
  currentPlan,
  credits,
  lang,
  onChoose,
  onBack,
}: {
  currentPlan: PlanId;
  credits: number;
  lang: Lang;
  onChoose: (packId: PlanId) => void;
  onBack: () => void;
}) {
  const packName = (id: PlanId) => PRICING.find((pk) => pk.id === id)?.name[lang] || '';

  return (
    <div className="relative h-screen w-screen overflow-hidden font-sans text-gray-900 antialiased">
      <div className="aurora" aria-hidden="true">
        <span className="blob blob-a" />
        <span className="blob blob-b" />
        <span className="blob blob-c" />
        <span className="blob blob-d" />
      </div>

      <div className="relative z-10 h-full overflow-y-auto">
        <header className="sticky top-0 z-20 backdrop-blur-md bg-white/75 border-b border-orange-200/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <button type="button" onClick={onBack} className="flex items-center gap-2.5 cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4 text-white stroke-[2.5]" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-900 text-lg tracking-tight">Aura</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-200/80 text-gray-700">Design</span>
              </div>
            </button>
            <div className="flex items-center gap-2">
              <span dir="ltr" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200/80 text-xs font-bold text-gray-800">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                {credits}
              </span>
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gray-900 hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                {I18N[lang].backToStudio}
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-10 space-y-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 via-orange-50/70 to-white px-6 sm:px-10 pt-10 pb-8 border border-orange-100 shadow-sm mt-6">
            <div className="aurora opacity-40" aria-hidden="true">
              <span className="blob blob-a" />
              <span className="blob blob-b" />
            </div>
            <div className="relative z-10 text-center space-y-3 max-w-2xl mx-auto">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-amber-200/70 text-[11px] font-bold text-amber-700 shadow-xs">
                <Zap className="w-3 h-3" />
                {I18N[lang].pricingBadge}
              </span>
              <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight">
                {I18N[lang].pricingTitleA}{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">{I18N[lang].pricingTitleB}</span>
                {I18N[lang].pricingTitleC}
              </h2>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {MODELS.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200/80 shadow-xs text-xs font-semibold text-gray-700">
                    {m.name}
                    <span dir="ltr" className="font-bold text-amber-600 bg-amber-100/80 px-1.5 py-0.5 rounded-full">{m.points} pts</span>
                  </span>
                ))}
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-gray-200 shadow-xs text-xs font-semibold text-gray-700">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                {I18N[lang].yourBalance} :
                <span className="font-bold text-amber-600">{credits}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {PRICING.map((pk) => {
              const isCurrent = pk.id === currentPlan && pk.price !== 'Sur devis';
              const isDevis = pk.price === 'Sur devis';
              return (
                <div
                  key={pk.id}
                  className={`relative rounded-3xl border flex flex-col gap-4 p-5 transition-all ${
                    pk.highlight
                      ? 'border-amber-400 bg-gradient-to-b from-amber-50/80 to-white shadow-lg shadow-amber-100/60 xl:-translate-y-1'
                      : isCurrent
                      ? 'border-orange-300 bg-orange-50/40'
                      : 'border-gray-200 bg-white/80 hover:border-amber-300/70 hover:shadow-md'
                  }`}
                >
                  {pk.ribbon && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold tracking-wider shadow-sm whitespace-nowrap">
                      {pk.ribbon[lang]}
                    </span>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">{pk.name[lang]}</h4>
                      {isCurrent && (
                        <span className="text-[9px] font-bold text-orange-700 bg-orange-100 border border-orange-200 px-1.5 py-0.5 rounded-full">
                          {I18N[lang].currentBadge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500">{pk.tagline[lang]}</p>
                  </div>

                  <div className="flex items-end gap-1.5">
                    <span className={`text-2xl font-bold tracking-tight ${pk.highlight ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-500' : 'text-gray-900'}`}>
                      {pk.price}
                    </span>
                    {pk.period && <span className="text-[11px] text-gray-400 pb-1">{pk.period[lang]}</span>}
                  </div>

                  {pk.points && (
                    <div className={`flex items-center gap-1.5 w-fit px-3 py-1 rounded-full text-[11px] font-bold border ${
                      pk.highlight ? 'bg-amber-100/80 text-amber-800 border-amber-200' : 'bg-gray-100 text-gray-700 border-gray-200'
                    }`}>
                      <Zap className="w-3 h-3 text-amber-500" />
                      {pk.points[lang]}
                    </div>
                  )}

                  <ul className="space-y-2 flex-1 pt-1">
                    {pk.features[lang].map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                        <Check className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5 stroke-[2.5]" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    disabled={isCurrent}
                    onClick={() => {
                      if (isDevis) {
                        window.location.href = 'mailto:contact@auradesign.dz?subject=Pack%20Business%20%26%20Agences%20%E2%80%94%20Aura%20Design';
                        return;
                      }
                      onChoose(pk.id as PlanId);
                    }}
                    className={`w-full px-3 py-2.5 rounded-full text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-gray-100 text-gray-400 cursor-default'
                        : pk.highlight
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-md shadow-amber-200/60 cursor-pointer'
                        : 'bg-gray-900 hover:bg-black text-white cursor-pointer'
                    }`}
                  >
                    {isCurrent ? I18N[lang].packCurrent : pk.cta[lang]}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRICING_TIPS.map((tip) => (
              <div
                key={tip.title.en}
                className={`flex items-start gap-3 rounded-2xl border p-4 ${
                  tip.tone === 'eco' ? 'border-emerald-200/80 bg-emerald-50/40' : 'border-amber-200/80 bg-amber-50/50'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tip.tone === 'eco' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                  {tip.icon === 'lightbulb' ? <Lightbulb className="w-4 h-4" /> : <Rocket className="w-4 h-4" />}
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-gray-900">{tip.title[lang]}</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{tip.text[lang]}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-gray-400 text-center leading-relaxed max-w-xl mx-auto">
            {lang === 'fr' && "Les points sont déduits uniquement lorsque vous générez un visuel — un point non utilisé reste dans votre solde. L'export PNG HD, l'export multi-calques Canva et l'envoi vers votre compte Canva sont toujours inclus gratuitement."}
            {lang === 'en' && 'Points are only deducted when you generate a visual — unused points stay in your balance. PNG HD export, multi-layer Canva export and sending to your Canva account are always included for free.'}
            {lang === 'ar' && 'تُخصم النقاط فقط عند توليد تصميم — والنقاط غير المستخدمة تبقى في رصيدك. تصدير PNG HD وتصدير Canva متعدد الطبقات والإرسال إلى حسابك في Canva مشمولة دائماً مجاناً.'}
          </p>
        </main>
      </div>
    </div>
  );
}

// ============================================================
// PAGE /home — LANDING PUBLIQUE (localisée)
// ============================================================
function LandingPage({
  credits,
  lang,
  onEnter,
  onPricing,
  onReferral,
}: {
  credits: number;
  lang: Lang;
  onEnter: () => void;
  onPricing: () => void;
  onReferral: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const T = {
    fr: {
      badge: "NOUVEAU · 20 POINTS OFFERTS À L'INSCRIPTION",
      titleA: 'Des designs qui', titleB: 'vendent', titleC: ', générés en seconde.',
      sub: 'Posts, stories, carrousels, affiches et fiches produit pour vos réseaux sociaux. Décrivez votre idée — l’IA s’occupe du reste, avec votre logo et vos couleurs.',
      cta1: 'Commencer gratuitement', cta2: 'Voir les packs',
      noCard: 'Sans carte bancaire', fast: 'Prêt en 10 secondes', pts: `20 points sur votre compte`,
      howTitle: 'Comment ça marche ?', howBadge: 'SIMPLE COMME BONJOUR',
      whyBadge: 'POURQUOI AURA DESIGN', whyTitleA: 'Tout ce qu’il faut pour', whyTitleB: 'briller', whyTitleC: ' sur les réseaux',
      steps: [
        { n: '1', title: 'Décrivez votre idée', text: '« Post de lancement pour ma boutique de bijoux » — une phrase suffit, l’IA fait le reste.' },
        { n: '2', title: 'Choisissez modèle & format', text: 'Flash, Studio ou Pro Max — puis Post, Story, Carrousel, Affiche…' },
        { n: '3', title: 'Exportez partout', text: 'PNG HD, PDF multi-pages ou envoi direct dans votre compte Canva, calques éditables inclus.' },
      ],
      features: [
        { icon: Sparkles, title: '3 modèles IA', text: 'Aura Flash pour la vitesse, Studio pour le HD, Pro Max pour vos plus gros projets.' },
        { icon: PencilRuler, title: 'Export Canva multi-calques', text: 'Vos textes et éléments restent modifiables calque par calque dans Canva.' },
        { icon: Maximize2, title: 'Magic Resize gratuit', text: 'Déclinez un design en Story, Post, Affiche ou 16:9 sans dépenser un point.' },
        { icon: FileText, title: 'PNG HD & PDF', text: 'Exportez un slide ou tout le carrousel, qualité maximale pour l’impression et le web.' },
        { icon: Palette, title: 'Brand Kit intégré', text: 'Logo, nom, @handle et couleur d’accent appliqués automatiquement à chaque design.' },
        { icon: Smartphone, title: 'Installable comme une app', text: 'Aura Design s’installe sur votre téléphone — créez où que vous soyez, même hors ligne.' },
      ],
      refBadge: 'PARRAINAGE',
      refTitleA: 'Gagnez', refTitleB: '50 points', refTitleC: 'quand votre pote souscrit un pack',
      refText: "Partagez votre lien d'invitation : votre ami démarre avec 20 points de bienvenue, et vous recevez 50 points dès qu'il active son premier pack payant.",
      refCta: "Obtenir mon lien d'invitation",
      finalTitle: 'Prêt à créer votre premier design ?', finalSub: '20 points offerts — de quoi générer vos 4 premiers visuels, sans payer.',
      studio: 'Atelier', pricing: 'Tarifs & Packs', referral: 'Parrainage', madeIn: 'Créé en Algérie 🇩🇿',
      slide1: 'Lancement', slide1T: "Votre marque mérite d'être vue.", slide1S: 'Des visuels pro, générés par l’IA en quelques secondes.', slide1C: 'Découvrir ➔',
      slide2Tag: 'Conseil #1', slide2T: 'Publiez tous les jours sans y passer vos soirées.', slide2B: ['Un visuel par jour, généré en 10s', 'Votre logo et vos couleurs', 'Export direct vers Canva'], slide2C: 'Enregistrer ➔',
      slide3Tag: 'Événement', slide3T: 'Vente flash ce week-end.', slide3S: 'Sur toute la boutique, samedi & dimanche seulement.', slide3C: 'Réserver ma place ➔',
    },
    en: {
      badge: 'NEW · 20 FREE POINTS WHEN YOU SIGN UP',
      titleA: 'Designs that', titleB: 'sell', titleC: ', generated in seconds.',
      sub: 'Posts, stories, carousels, posters and product shots for your social media. Describe your idea — the AI handles the rest, with your logo and colors.',
      cta1: 'Start for free', cta2: 'View packs',
      noCard: 'No credit card', fast: 'Ready in 10 seconds', pts: '20 points on your account',
      howTitle: 'How it works', howBadge: 'EASY AS PIE',
      whyBadge: 'WHY AURA DESIGN', whyTitleA: 'Everything you need to', whyTitleB: 'shine', whyTitleC: ' on social media',
      steps: [
        { n: '1', title: 'Describe your idea', text: '“Launch post for my jewelry shop” — one sentence is enough, the AI does the rest.' },
        { n: '2', title: 'Pick model & format', text: 'Flash, Studio or Pro Max — then Post, Story, Carousel, Poster…' },
        { n: '3', title: 'Export anywhere', text: 'PNG HD, multi-page PDF or direct send to your Canva account, editable layers included.' },
      ],
      features: [
        { icon: Sparkles, title: '3 AI models', text: 'Aura Flash for speed, Studio for HD, Pro Max for your biggest projects.' },
        { icon: PencilRuler, title: 'Multi-layer Canva export', text: 'Your texts and elements stay editable layer by layer in Canva.' },
        { icon: Maximize2, title: 'Free Magic Resize', text: 'Turn a design into Story, Post, Poster or 16:9 without spending a point.' },
        { icon: FileText, title: 'PNG HD & PDF', text: 'Export one slide or the whole carousel, max quality for print and web.' },
        { icon: Palette, title: 'Built-in Brand Kit', text: 'Logo, name, @handle and accent color applied automatically to every design.' },
        { icon: Smartphone, title: 'Installs like an app', text: 'Aura Design installs on your phone — create anywhere, even offline.' },
      ],
      refBadge: 'REFERRAL',
      refTitleA: 'Earn', refTitleB: '50 points', refTitleC: 'when a friend subscribes to a pack',
      refText: 'Share your invite link: your friend starts with 20 welcome points, and you get 50 points as soon as they activate their first paid pack.',
      refCta: 'Get my invite link',
      finalTitle: 'Ready to create your first design?', finalSub: '20 free points — enough for your first 4 visuals, without paying.',
      studio: 'Studio', pricing: 'Pricing & Packs', referral: 'Referral', madeIn: 'Made in Algeria 🇩🇿',
      slide1: 'Launch', slide1T: 'Your brand deserves to be seen.', slide1S: 'Pro visuals, AI-generated in seconds.', slide1C: 'Discover ➔',
      slide2Tag: 'Tip #1', slide2T: 'Post every day without spending your evenings.', slide2B: ['One visual a day, generated in 10s', 'Your logo and colors', 'Direct export to Canva'], slide2C: 'Save ➔',
      slide3Tag: 'Event', slide3T: 'Flash sale this weekend.', slide3S: 'Store-wide, Saturday & Sunday only.', slide3C: 'Book my spot ➔',
    },
    ar: {
      badge: 'جديد · 20 نقطة مجاناً عند التسجيل',
      titleA: 'تصاميم', titleB: 'تبيع', titleC: '، تُولَّد في ثوانٍ.',
      sub: 'منشورات وستوريات وكاروسيل وملصقات وصور منتجات لشبكاتك الاجتماعية. صِف فكرتك — والذكاء الاصطناعي يتولى الباقي، بشعارك وألوانك.',
      cta1: 'ابدأ مجاناً', cta2: 'اعرض الباقات',
      noCard: 'بدون بطاقة بنكية', fast: 'جاهز في 10 ثوانٍ', pts: '20 نقطة في حسابك',
      howTitle: 'كيف يعمل؟', howBadge: 'بسيط جداً',
      whyBadge: 'لماذا AURA DESIGN', whyTitleA: 'كل ما تحتاجه لـ', whyTitleB: 'تتألق', whyTitleC: ' على الشبكات الاجتماعية',
      steps: [
        { n: '1', title: 'صِف فكرتك', text: '«منشور إطلاق لمتجري المجوهرات» — جملة واحدة تكفي، والذكاء الاصطناعي يقوم بالباقي.' },
        { n: '2', title: 'اختر النموذج والصيغة', text: 'Flash أو Studio أو Pro Max — ثم Post أو Story أو Carrousel أو Poster…' },
        { n: '3', title: 'صدّر إلى كل مكان', text: 'PNG HD أو PDF متعدد الصفحات أو إرسال مباشر إلى حسابك في Canva، مع طبقات قابلة للتعديل.' },
      ],
      features: [
        { icon: Sparkles, title: '3 نماذج ذكاء اصطناعي', text: 'Aura Flash للسرعة، Studio لجودة HD، وPro Max لأكبر مشاريعك.' },
        { icon: PencilRuler, title: 'تصدير Canva متعدد الطبقات', text: 'تبقى نصوصك وعناصرك قابلة للتعديل طبقة بطبقة في Canva.' },
        { icon: Maximize2, title: 'تغيير الحجم مجاناً', text: 'حوّل التصميم إلى Story أو Post أو Poster أو 16:9 دون إنفاق نقطة.' },
        { icon: FileText, title: 'PNG HD وPDF', text: 'صدّر شريحة واحدة أو الكاروسيل كاملاً، بأعلى جودة للطباعة والويب.' },
        { icon: Palette, title: 'هوية علامة مدمجة', text: 'الشعار والاسم والمعرّف ولون التمييز تُطبق تلقائياً على كل تصميم.' },
        { icon: Smartphone, title: 'يُثبَّت كتطبيق', text: 'يُثبَّت Aura Design على هاتفك — أنشئ من أي مكان، حتى دون اتصال.' },
      ],
      refBadge: 'دعوة الأصدقاء',
      refTitleA: 'اربح', refTitleB: '50 نقطة', refTitleC: 'عندما يشترك صديقك في باقة',
      refText: 'شارك رابط الدعوة: يبدأ صديقك بـ20 نقطة ترحيبية، وتحصل أنت على 50 نقطة فور تفعيله أول باقة مدفوعة.',
      refCta: 'احصل على رابط الدعوة',
      finalTitle: 'جاهز لإنشاء تصميمك الأول؟', finalSub: '20 نقطة مجاناً — تكفي لأول 4 تصاميم لك، بدون دفع.',
      studio: 'الاستوديو', pricing: 'الأسعار والباقات', referral: 'دعوة الأصدقاء', madeIn: 'صُنع في الجزائر 🇩🇿',
      slide1: 'إطلاق', slide1T: 'علامتك تستحق أن تُرى.', slide1S: 'تصاميم احترافية بتوليد الذكاء الاصطناعي في ثوانٍ.', slide1C: 'اكتشف ➔',
      slide2Tag: 'نصيحة #1', slide2T: 'انشر كل يوم دون أن تستهلك أمسياتك.', slide2B: ['تصميم يومي، يُولَّد في 10 ثوانٍ', 'شعارك وألوانك', 'تصدير مباشر إلى Canva'], slide2C: 'احفظ ➔',
      slide3Tag: 'حدث', slide3T: 'تخفيضات هذا الأسبوع.', slide3S: 'على المتجر كله، السبت والأحد فقط.', slide3C: 'احجز مكان ➔',
    },
  }[lang];

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden font-sans text-gray-900 antialiased">
      <div className="aurora fixed" aria-hidden="true">
        <span className="blob blob-a" />
        <span className="blob blob-b" />
        <span className="blob blob-c" />
        <span className="blob blob-d" />
      </div>

      <div className="relative z-10">
        <header
          className={`sticky top-0 z-30 transition-all duration-300 ${
            scrolled
              ? 'backdrop-blur-md bg-white/75 border-b border-orange-200/40 shadow-sm'
              : 'bg-transparent border-b border-transparent'
          }`}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4 text-white stroke-[2.5]" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-900 text-lg tracking-tight">Aura</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-200/80 text-gray-700">Design</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onPricing} className="px-3.5 py-1.5 rounded-full text-xs font-bold text-gray-700 hover:bg-white/80 transition-colors cursor-pointer">
                {T.pricing}
              </button>
              <button type="button" onClick={onEnter} className="px-4 py-1.5 rounded-full bg-gray-900 hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer shadow-sm">
                {T.studio}
              </button>
            </div>
          </div>
        </header>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-10 text-center space-y-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-amber-200/70 text-[11px] font-bold text-amber-700 shadow-xs">
            <Zap className="w-3 h-3" />
            {T.badge}
          </span>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.08] max-w-3xl mx-auto">
            {T.titleA} <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">{T.titleB}</span>
            {T.titleC}
          </h1>
          <p className="text-sm sm:text-base text-gray-600 max-w-xl mx-auto leading-relaxed">{T.sub}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={onEnter} className="px-6 py-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-sm font-bold shadow-lg shadow-amber-200/70 transition-all cursor-pointer">
              {T.cta1}
            </button>
            <button type="button" onClick={onPricing} className="px-6 py-3 rounded-full bg-white border border-gray-200 hover:border-amber-300 text-gray-800 text-sm font-bold transition-all cursor-pointer">
              {T.cta2}
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] font-semibold text-gray-500">
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" />{T.noCard}</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" />{T.fast}</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" />{credits > 0 ? `${credits} pts` : T.pts}</span>
          </div>

          <div className="relative max-w-3xl mx-auto mt-12">
            <div className="flex items-end justify-center gap-4 sm:gap-6">
              <div className="hidden sm:block w-52 rotate-[-4deg] translate-y-2 hover:rotate-[-2deg] transition-transform duration-300">
                <div className="rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl p-4 aspect-[4/5] flex flex-col justify-between text-left overflow-hidden">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-amber-500 flex items-center justify-center text-[7px] font-bold text-black">A</div>
                    <span className="text-[8px] font-bold tracking-wider text-white uppercase">Aura Studio</span>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[8px] font-bold uppercase tracking-wider text-amber-400">{T.slide1}</span>
                    <h3 className="text-sm font-semibold text-white leading-snug">{T.slide1T}</h3>
                    <p className="text-[9px] text-zinc-400 leading-relaxed">{T.slide1S}</p>
                  </div>
                  <div className="flex items-center justify-between text-[8px] text-zinc-500 border-t border-zinc-800 pt-2">
                    <span className="text-white font-semibold">@aura.design</span>
                    <span className="text-amber-400 font-bold">{T.slide1C}</span>
                  </div>
                </div>
              </div>
              <div className="w-60 sm:w-72 hover:-translate-y-1 transition-transform duration-300">
                <div className="rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-5 aspect-square flex flex-col justify-between text-left overflow-hidden relative">
                  <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-amber-500/20 blur-2xl" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center text-[9px] font-bold text-black">A</div>
                      <span className="text-[9px] font-bold tracking-wider text-white uppercase">Aura Studio</span>
                    </div>
                    <span dir="ltr" className="text-[8px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">01 / 05</span>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">{T.slide2Tag}</span>
                    <h3 className="text-lg font-semibold text-white leading-snug">{T.slide2T}</h3>
                    <div className="space-y-1 pt-1">
                      {T.slide2B.map((b) => (
                        <div key={b} className="flex items-center gap-1.5 text-[9px] text-zinc-300">
                          <span className="w-3 h-3 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[7px]">✓</span>
                          {b}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-zinc-500 border-t border-zinc-800 pt-2.5">
                    <span className="text-white font-semibold">@aura.design</span>
                    <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">{T.slide2C}</span>
                  </div>
                </div>
              </div>
              <div className="hidden sm:block w-48 rotate-[4deg] translate-y-2 hover:rotate-[2deg] transition-transform duration-300">
                <div className="rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl p-4 aspect-[2/3] flex flex-col justify-between text-left overflow-hidden">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-amber-500 flex items-center justify-center text-[7px] font-bold text-black">A</div>
                    <span className="text-[8px] font-bold tracking-wider text-white uppercase">Aura Studio</span>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[8px] font-bold uppercase tracking-wider text-amber-400">{T.slide3Tag}</span>
                    <h3 className="text-sm font-semibold text-white leading-snug">{T.slide3T}</h3>
                    <div className="text-xl font-bold text-amber-400">-30%</div>
                    <p className="text-[9px] text-zinc-400">{T.slide3S}</p>
                  </div>
                  <div className="text-center text-[8px] font-bold text-black bg-amber-400 rounded-full py-1.5">{T.slide3C}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-center space-y-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-amber-200/70 text-[11px] font-bold text-amber-700 shadow-xs">
              <Sparkles className="w-3 h-3" />
              {T.howBadge}
            </span>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">{T.howTitle}</h2>
          </div>
          <div className="relative mt-10">
            <div className="hidden sm:block absolute top-7 left-[16%] right-[16%] h-0.5 rounded-full bg-gradient-to-r from-amber-300/0 via-orange-300 to-amber-300/0" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6">
              {T.steps.map((st) => (
                <div key={st.n} className="relative group text-center">
                  <div className="relative z-10 mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white font-bold text-lg flex items-center justify-center shadow-lg shadow-amber-300/50 rotate-3 group-hover:rotate-6 group-hover:scale-110 transition-transform duration-300">
                    {st.n}
                    <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full border-2 border-orange-300" />
                  </div>
                  <div className="-mt-8 rounded-3xl border border-gray-200/80 bg-white/90 backdrop-blur pt-11 pb-6 px-6 space-y-2 shadow-sm group-hover:shadow-xl group-hover:shadow-amber-100/70 group-hover:border-amber-300/60 group-hover:-translate-y-1 transition-all duration-300">
                    <h3 className="font-semibold text-gray-900">{st.title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed max-w-[26ch] mx-auto">{st.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-center space-y-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-amber-200/70 text-[11px] font-bold text-amber-700 shadow-xs">
              <Zap className="w-3 h-3" />
              {T.whyBadge}
            </span>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
              {T.whyTitleA} <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">{T.whyTitleB}</span>
              {T.whyTitleC}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
            {T.features.map((f, i) => (
              <div key={f.title} className="group relative rounded-3xl bg-white/90 backdrop-blur border border-gray-200/80 p-6 overflow-hidden hover:-translate-y-1.5 hover:shadow-xl hover:shadow-amber-100/70 hover:border-amber-300/60 transition-all duration-300">
                <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br from-amber-200/60 to-orange-200/40 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute top-0 left-6 right-6 h-0.5 rounded-full bg-gradient-to-r from-amber-400/0 via-amber-400 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-200/70 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300">
                      <f.icon className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <span className="text-[11px] font-bold tracking-wider text-gray-200 group-hover:text-amber-300 transition-colors duration-300">0{i + 1}</span>
                  </div>
                  <h3 className="mt-4 font-semibold text-gray-900 text-sm">{f.title}</h3>
                  <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-orange-50/60 to-white p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white border border-amber-200 text-[10px] font-bold text-amber-700">
                <Gift className="w-3 h-3" />
                {T.refBadge}
              </span>
              <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-gray-900">
                {T.refTitleA} <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">{T.refTitleB}</span> {T.refTitleC}
              </h2>
              <p className="text-xs text-gray-600 max-w-lg leading-relaxed">{T.refText}</p>
            </div>
            <button type="button" onClick={onReferral} className="shrink-0 px-5 py-2.5 rounded-full bg-gray-900 hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer shadow-md">
              {T.refCta}
            </button>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">{T.finalTitle}</h2>
          <p className="text-sm text-gray-500">{T.finalSub}</p>
          <button type="button" onClick={onEnter} className="px-7 py-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-sm font-bold shadow-lg shadow-amber-200/70 transition-all cursor-pointer">
            {T.cta1}
          </button>
        </section>

        <footer className="border-t border-orange-200/40 bg-white/65 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-gray-500">
            <span>© 2026 Aura Design — {T.madeIn}</span>
            <div className="flex items-center gap-4 font-semibold">
              <button type="button" onClick={onEnter} className="hover:text-gray-900 cursor-pointer transition-colors">{T.studio}</button>
              <button type="button" onClick={onPricing} className="hover:text-gray-900 cursor-pointer transition-colors">{T.pricing}</button>
              <button type="button" onClick={onReferral} className="hover:text-gray-900 cursor-pointer transition-colors">{T.referral}</button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ============================================================
// PAGE /brand — Espaces & Brand Kit (page dédiée)
// ============================================================
function BrandPage({
  lang,
  projects,
  activeProjectId,
  plan,
  credits,
  brandName,
  brandHandle,
  brandColor,
  brandLogo,
  titleFont,
  bodyFont,
  onSwitch,
  onCreate,
  onDelete,
  onName,
  onHandle,
  onColor,
  onLogo,
  onFonts,
  onBack,
  onPricing,
}: {
  lang: Lang;
  projects: BrandProject[];
  activeProjectId: string;
  plan: PlanId;
  credits: number;
  brandName: string;
  brandHandle: string;
  brandColor: string;
  brandLogo: string | null;
  titleFont: string;
  bodyFont: string;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onName: (v: string) => void;
  onHandle: (v: string) => void;
  onColor: (v: string) => void;
  onFonts: (title: string, body: string) => void;
  onLogo: (dataUrl: string | null) => void;
  onBack: () => void;
  onPricing: () => void;
}) {
  const t = I18N[lang];
  const [dragging, setDragging] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const limit = PACK_PROJECT_LIMIT[plan];

  const handleLogo = (file: File) => {
    if (file && (file.type.startsWith('image/') || file.name.endsWith('.svg'))) {
      const reader = new FileReader();
      reader.onload = (e) => onLogo(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden font-sans text-gray-900 antialiased">
      <div className="aurora" aria-hidden="true">
        <span className="blob blob-a" />
        <span className="blob blob-b" />
        <span className="blob blob-c" />
        <span className="blob blob-d" />
      </div>

      <div className="relative z-10 h-full overflow-y-auto">
        <header className="sticky top-0 z-20 backdrop-blur-md bg-white/75 border-b border-orange-200/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <button type="button" onClick={onBack} className="flex items-center gap-2.5 cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4 text-white stroke-[2.5]" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-900 text-lg tracking-tight">Aura</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-200/80 text-gray-700">Design</span>
              </div>
            </button>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200/80 text-xs font-bold text-gray-800">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span dir="ltr">{credits}</span>
              </span>
              <button type="button" onClick={onBack} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gray-900 hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer">
                <ArrowLeft className="w-3.5 h-3.5" />
                {t.backToStudio}
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-14">
          <div className="pt-8 pb-6 space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{t.brandTitle}</h1>
            <p className="text-sm text-gray-500">{t.brandSub}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">
            {/* --- Liste des espaces --- */}
            <section className="rounded-3xl border border-gray-200 bg-white/90 backdrop-blur p-4 space-y-2">
              <div className="flex items-center justify-between px-1 pb-1">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.mySpaces}</h2>
                <span className="text-[10px] font-bold text-gray-400">
                  {projects.length}/{limit === Infinity ? '∞' : limit}
                </span>
              </div>
              {projects.map((pk) => {
                const isActive = pk.id === activeProjectId;
                return (
                  <div
                    key={pk.id}
                    className={`group rounded-2xl border p-3 transition-all cursor-pointer ${
                      isActive ? 'border-amber-400 bg-amber-50/60 shadow-sm' : 'border-gray-200 hover:border-amber-300/60 hover:bg-gray-50'
                    }`}
                    onClick={() => onSwitch(pk.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden text-sm font-bold text-white shadow-sm"
                        style={{ backgroundColor: pk.color }}
                      >
                        {pk.logo ? <img src={pk.logo} alt="" className="w-full h-full object-contain p-1" /> : (pk.name || t.unnamed).slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">{pk.name || t.unnamed}</h3>
                          {isActive && (
                            <span className="text-[9px] font-bold text-orange-700 bg-orange-100 border border-orange-200 px-1.5 py-0.5 rounded-full shrink-0">{t.activeBadge}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 truncate">{pk.handle}</p>
                      </div>
                      {projects.length > 1 && (
                        <button
                          type="button"
                          title={t.deleteSpace}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(pk.id);
                          }}
                          className="p-1.5 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {projects.length < limit ? (
                <button
                  type="button"
                  onClick={onCreate}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-amber-400/70 bg-amber-50/40 hover:bg-amber-50 px-3 py-3 text-xs font-bold text-amber-800 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {t.newSpace}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onPricing}
                  className="w-full flex flex-col items-center gap-1 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-xs font-bold text-gray-500 hover:border-amber-300 hover:text-amber-700 cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    {t.limitReached}
                  </span>
                  <span className="text-[10px] font-semibold text-gray-400">{t.limitReachedSub}</span>
                </button>
              )}
            </section>

            {/* --- Éditeur du Brand Kit actif --- */}
            <section className="rounded-3xl border border-gray-200 bg-white/90 backdrop-blur p-6 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-200/70">
                    <Palette className="w-4.5 h-4.5 w-[18px] h-[18px]" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">{t.brandKit}</h2>
                    <p className="text-[11px] text-gray-400">{t.activeSpace} : {brandName || t.unnamed}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">{t.savedAuto}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Formulaire */}
                <div className="space-y-4">
                  {/* Logo */}
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1.5">{t.logoLabel}</label>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragging(false);
                        if (e.dataTransfer.files?.[0]) handleLogo(e.dataTransfer.files[0]);
                      }}
                      onClick={() => logoInputRef.current?.click()}
                      className={`border-dashed border-2 ${dragging ? 'border-amber-500 bg-amber-50/50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'} rounded-2xl p-4 text-center cursor-pointer transition-colors flex items-center justify-center gap-3`}
                    >
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleLogo(e.target.files[0]);
                          e.target.value = '';
                        }}
                      />
                      {brandLogo ? (
                        <>
                          <img src={brandLogo} alt="Logo" className="w-11 h-11 object-contain rounded-xl border border-gray-200 bg-white p-1 shadow-xs" />
                          <div className="text-left">
                            <p className="text-xs font-bold text-gray-900">{t.logoImported}</p>
                            <p className="text-[11px] text-gray-500">{t.logoReplace}</p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onLogo(null);
                            }}
                            className="ml-2 text-xs text-red-500 hover:text-red-700 font-semibold cursor-pointer"
                          >
                            Retirer
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-3">
                          <UploadCloud className="w-7 h-7 text-gray-400" />
                          <div className="text-left">
                            <p className="text-xs font-semibold text-gray-700">{t.logoDrag}</p>
                            <p className="text-[11px] text-gray-400">{t.logoHint}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1.5">{t.brandNameLabel}</label>
                    <input
                      type="text"
                      value={brandName}
                      onChange={(e) => onName(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-amber-500"
                      placeholder="Ex: Boutique Sarah"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1.5">{t.brandHandleLabel}</label>
                    <input
                      type="text"
                      value={brandHandle}
                      onChange={(e) => onHandle(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-amber-500"
                      placeholder="@votrecompte"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">{t.handleHint}</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1.5">{t.brandColorLabel}</label>
                    <div className="flex flex-wrap items-center gap-2">
                      {['#F59E0B', '#EA580C', '#EAB308', '#F97316', '#2563EB', '#059669', '#7C3AED', '#DC2626'].map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => onColor(color)}
                          className={`w-8 h-8 rounded-full border-2 transition-transform ${brandColor === color ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      <label
                        className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer relative overflow-hidden"
                        title={t.customColor}
                      >
                        <span className="text-[10px] font-mono font-bold text-gray-500">HEX</span>
                        <input type="color" value={brandColor} onChange={(e) => onColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                      </label>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{t.colorHint} <span className="font-mono">{brandColor.toUpperCase()}</span></p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1.5">{t.fontTitleLabel}</label>
                      <select
                        value={titleFont}
                        onChange={(e) => onFonts(e.target.value, bodyFont)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        <option value="">{t.fontAuto}</option>
                        {TITLE_FONTS.map((f) => (
                          <option key={f.name} value={f.name} style={{ fontFamily: `'${f.name}'` }}>
                            {f.name} — {f.vibe}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1.5">{t.fontBodyLabel}</label>
                      <select
                        value={bodyFont}
                        onChange={(e) => onFonts(titleFont, e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        <option value="">{t.fontAuto}</option>
                        {BODY_FONTS.map((f) => (
                          <option key={f.name} value={f.name} style={{ fontFamily: `'${f.name}'` }}>
                            {f.name} — {f.vibe}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Aperçu live */}
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-gray-700 block">{t.previewLive}</label>
                  <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 aspect-[4/5] max-w-[280px] mx-auto flex flex-col justify-between text-left overflow-hidden relative">
                    <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-30" style={{ backgroundColor: brandColor }} />
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-black overflow-hidden" style={{ backgroundColor: brandColor }}>
                        {brandLogo ? <img src={brandLogo} alt="" className="w-full h-full object-contain p-0.5" /> : brandName.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-[10px] font-bold tracking-wider text-white uppercase truncate">{brandName || t.previewPlaceholder}</span>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: brandColor }}>
                        {t.previewTag}
                      </span>
                      <h3 className="text-base font-semibold text-white leading-snug">{t.brandSub}</h3>
                      <div className="inline-block text-[10px] font-bold px-2 py-1 rounded-lg border" style={{ color: brandColor, borderColor: `${brandColor}55`, backgroundColor: `${brandColor}18` }}>
                        {t.previewCta}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-zinc-500 border-t border-zinc-800 pt-2">
                      <span className="text-white font-semibold truncate">{brandHandle || '@votrecompte'}</span>
                      <span style={{ color: brandColor }}>✓</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 text-center leading-relaxed max-w-[280px] mx-auto">{t.previewNote}</p>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState('sess_draft');
  const activeIdRef = useRef('sess_draft');
  useEffect(() => {
    activeIdRef.current = activeSessionId;
  }, [activeSessionId]);
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return (localStorage.getItem('aura_lang') as Lang) || 'fr';
    } catch {
      return 'fr';
    }
  });
  const [plan, setPlan] = useState<PlanId>(() => {
    try {
      return (localStorage.getItem('aura_plan') as PlanId) || 'free';
    } catch {
      return 'free';
    }
  });
  // ===== SYSTÈME DE CRÉDITS (POINTS) =====
  const [credits, setCredits] = useState<number>(() => {
    try {
      const stored = Number(localStorage.getItem('aura_credits'));
      return Number.isFinite(stored) ? stored : 20;
    } catch {
      return 20;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('aura_credits', String(credits));
    } catch {}
  }, [credits]);
  const [activeModelId, setActiveModelId] = useState<ModelId>(() => {
    try {
      return (localStorage.getItem('aura_model') as ModelId) || 'flash';
    } catch {
      return 'flash';
    }
  });
  const activeModel = MODELS.find((m) => m.id === activeModelId) || MODELS[0];
  useEffect(() => {
    try {
      localStorage.setItem('aura_model', activeModelId);
    } catch {}
  }, [activeModelId]);
  // Coût total de la prochaine génération (images IA réellement générées × points du modèle)
  // ===== CONNEXION CANVA =====
  const [canvaConnected, setCanvaConnected] = useState<boolean>(() => {
    try {
      return localStorage.getItem('aura_canva_token') ? true : false;
    } catch {
      return false;
    }
  });
  const [canvaModalOpen, setCanvaModalOpen] = useState(false);
  const [canvaTokenInput, setCanvaTokenInput] = useState('');
  const [canvaExporting, setCanvaExporting] = useState(false);
  const [loggedOut, setLoggedOut] = useState(() => {
    try {
      return localStorage.getItem('aura_logged_out') === '1';
    } catch {
      return false;
    }
  });
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [modal, setModal] = useState<null | 'settings' | 'help' | 'about'>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  // ===== ROUTAGE (page /pricing dédiée) =====
  const getRoute = () => (typeof window !== 'undefined' ? window.location.pathname : '/');
  const [route, setRoute] = useState(getRoute);
  const navigate = (to: string) => {
    try {
      window.history.pushState({}, '', to);
    } catch {}
    setRoute(to);
  };
  useEffect(() => {
    const onPop = () => setRoute(getRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const accountRef = useRef<HTMLDivElement>(null);
  const t = (k: string) => I18N[lang][k] ?? I18N.fr[k] ?? k;
  const pname = (n: string) => n || t('defaultBrand');
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem('aura_lang', lang);
    } catch {}
  }, [lang]);
  useEffect(() => {
    try {
      localStorage.setItem('aura_plan', plan);
    } catch {}
  }, [plan]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // User First Name (Gemini Greeting)
  const [userFirstName, setUserFirstName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('aura_user_firstname') || 'Malek';
    }
    return 'Malek';
  });

  // ===== ESPACES (PROJETS) + BRAND KIT state =====
  const [projects, setProjects] = useState<BrandProject[]>(getInitialProjects);
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    try {
      return localStorage.getItem('aura_active_project_v1') || 'p1';
    } catch {
      return 'p1';
    }
  });
  const activeProject = projects.find((pk) => pk.id === activeProjectId) || projects[0];
  const [projectsOpen, setProjectsOpen] = useState(false);
  const projectsRef = useRef<HTMLDivElement>(null);
  const brandSyncSkip = useRef(false);
  const [brandName, setBrandName] = useState(() => activeProject.name);
  const [brandHandle, setBrandHandle] = useState(() => activeProject.handle);
  const [brandColor, setBrandColor] = useState(() => activeProject.color);
  const [brandLogo, setBrandLogo] = useState<string | null>(() => activeProject.logo ?? null);
  const [brandTitleFont, setBrandTitleFont] = useState(() => activeProject.titleFont || '');
  const [brandBodyFont, setBrandBodyFont] = useState(() => activeProject.bodyFont || '');
  // Changement de projet : charger son Brand Kit dans les champs actifs
  useEffect(() => {
    const pk = projects.find((x) => x.id === activeProjectId);
    if (pk) {
      brandSyncSkip.current = true;
      setBrandName(pk.name);
      setBrandHandle(pk.handle);
      setBrandColor(pk.color);
      setBrandLogo(pk.logo ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);
  // Édition des champs : écrit dans le projet actif
  useEffect(() => {
    if (brandSyncSkip.current) {
      brandSyncSkip.current = false;
      return;
    }
    setProjects((prev) =>
      prev.map((pk) => (pk.id === activeProjectId ? { ...pk, name: brandName, handle: brandHandle, color: brandColor, logo: brandLogo, titleFont: brandTitleFont || undefined, bodyFont: brandBodyFont || undefined } : pk))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandName, brandHandle, brandColor, brandLogo, brandTitleFont, brandBodyFont]);
  useEffect(() => {
    try {
      localStorage.setItem('aura_projects_v1', JSON.stringify(projects));
    } catch {}
  }, [projects]);
  useEffect(() => {
    try {
      localStorage.setItem('aura_active_project_v1', activeProjectId);
    } catch {}
  }, [activeProjectId]);

  const switchProject = (id: string) => {
    if (id === activeProjectId) return;
    setActiveProjectId(id);
    const pk = projects.find((x) => x.id === id);
    showToast(`${t('spacesGrp')} « ${pk?.name} » — ${t('spaceActivated')}`);
  };

  const deleteProject = (id: string) => {
    if (projects.length <= 1) {
      showToast(t('keepOneSpace'));
      return;
    }
    const remaining = projects.filter((pk) => pk.id !== id);
    setProjects(remaining);
    if (id === activeProjectId) {
      setActiveProjectId(remaining[0].id);
    }
    showToast(t('spaceDeleted'));
  };

  const createProject = () => {
    const limit = PACK_PROJECT_LIMIT[plan];
    if (projects.length >= limit) {
      showToast(`${limit} ${t('packLimitHit')}`);
      setProjectsOpen(false);
      navigate('/pricing');
      return;
    }
    const palette = ['#F59E0B', '#EA580C', '#2563EB', '#059669', '#7C3AED', '#DC2626'];
    const id = `p_${Date.now()}`;
    setProjects((prev) => [
      ...prev,
      { id, name: `${t('projectDefault')} ${prev.length + 1}`, handle: '@votrecompte', color: palette[prev.length % palette.length], logo: null },
    ]);
    setActiveProjectId(id);
    setProjectsOpen(false);
    navigate('/brand');
    showToast(t('spaceCreated'));
  };

  // Chat & Input state
  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<FormatType>('post');
  const [isFormatDropdownOpen, setIsFormatDropdownOpen] = useState(false);
  const [isComposerModelOpen, setIsComposerModelOpen] = useState(false);
  const [resizeOpenId, setResizeOpenId] = useState<string | null>(null);
  const [referralOpen, setReferralOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const attachRef = useRef<HTMLDivElement>(null);
  const [composerHighlight, setComposerHighlight] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  // Options ponctuelles posées par les commandes « / » (chips visibles, valables pour le prochain envoi uniquement)
  const [pendingStyle, setPendingStyle] = useState<'dark' | 'light' | null>(null);
  const [pendingChips, setPendingChips] = useState<string[]>([]);
  const [chipSwapIndex, setChipSwapIndex] = useState<number | null>(null);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Clic sur une suggestion : préremplit le champ au lieu de générer à l'aveugle
  const prefillComposer = (text: string) => {
    setInputPrompt(text);
    composerInputRef.current?.focus();
    setComposerHighlight(true);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setComposerHighlight(false), 2200);
    showToast(t('personalizeIdea'));
  };
  const [carouselSlidesCount, setCarouselSlidesCount] = useState<number>(4);
  const [isSlidesDropdownOpen, setIsSlidesDropdownOpen] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>(() => loadJson<TemplateItem[]>('aura_templates_v1', []));
  const [useTpl, setUseTpl] = useState<boolean>(() => loadJson<boolean>('aura_use_templates_v1', true));
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [brandProfile, setBrandProfile] = useState<BrandProfile>(() => loadJson<BrandProfile>('aura_brand_profile_v1', { productType: '', theme: '' }));
  const tplInputRef = useRef<HTMLInputElement>(null);
  const tplBatchRef = useRef<{ n: number; timer: ReturnType<typeof setTimeout> | null }>({ n: 0, timer: null });
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null);
  const sendingRef = useRef(false);
  const engineUnavailableRef = useRef(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const composerModelRef = useRef<HTMLDivElement>(null);
  const slidesCountDropdownRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      files.forEach((file) => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setAttachedImages((prev) => [...prev, event.target!.result as string]);
              showToast(t('photoAdded'));
              // Chaque photo uploadée alimente la bibliothèque de modèles de l'IA
              downscaleImage(file)
                .then((data) => {
                  setTemplates((prev) => {
                    if (prev.length >= TEMPLATE_MAX || prev.some((x) => x.data === data)) return prev;
                    noteTplSaved();
                    return [{ id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, data, name: file.name.slice(0, 40), at: Date.now() }, ...prev];
                  });
                })
                .catch(() => {});
            }
          };
          reader.readAsDataURL(file);
        }
      });
      e.target.value = '';
    }
  };

  // Sessions list
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>(() => loadJson<RecentSession[]>('aura_sessions_v1', []));

  // Messages list - starts empty so user immediately lands on the Gemini greeting screen!
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionMessagesMap, setSessionMessagesMap] = useState<Record<string, Message[]>>(() => loadJson<Record<string, Message[]>>('aura_session_messages_v1', {}));
  // Persistance de l'historique (survit au rafraîchissement)
  useEffect(() => {
    try {
      localStorage.setItem('aura_sessions_v1', JSON.stringify(recentSessions));
    } catch {}
  }, [recentSessions]);
  useEffect(() => {
    try {
      localStorage.setItem('aura_session_messages_v1', JSON.stringify(sessionMessagesMap));
    } catch {
      // Quota dépassé (photos volumineuses) : on retire les images base64
      try {
        const stripped = JSON.stringify(sessionMessagesMap, (_k, v) =>
          typeof v === 'string' && v.startsWith('data:') ? undefined : v
        );
        localStorage.setItem('aura_session_messages_v1', stripped);
      } catch {}
    }
  }, [sessionMessagesMap]);

  // Bibliothèque de modèles (références de style de l'IA)
  useEffect(() => {
    try {
      localStorage.setItem('aura_templates_v1', JSON.stringify(templates));
    } catch {
      try {
        localStorage.setItem('aura_templates_v1', JSON.stringify(templates.slice(1)));
      } catch {}
    }
  }, [templates]);
  useEffect(() => {
    try {
      localStorage.setItem('aura_brand_profile_v1', JSON.stringify(brandProfile));
    } catch {}
  }, [brandProfile]);
  useEffect(() => {
    try {
      localStorage.setItem('aura_use_templates_v1', JSON.stringify(useTpl));
    } catch {}
  }, [useTpl]);

  // Sessions distantes (Supabase) : fusion dans la liste locale si configuré
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    loadRemoteSessions()
      .then((remote) => {
        if (remote.length === 0) return;
        setRecentSessions((prev) => {
          const ids = new Set(remote.map((r) => r.id));
          const mapped = remote.map((r) => ({
            id: r.id,
            title: r.title,
            format: (FORMAT_ORDER.includes(r.format as FormatType) ? r.format : 'post') as FormatType,
          }));
          return [...mapped, ...prev.filter((x) => !ids.has(x.id))].slice(0, 50);
        });
      })
      .catch(() => {});
  }, []);

  // Salutation dynamique Gemini
  const greetingSalutation = t('greeting');

  // Suggestions d'inspiration sur la page d'accueil style Gemini
  const welcomeSuggestions = [
    {
      title: lang === 'fr' ? 'Lancement de ma boutique' : lang === 'en' ? 'Launch my shop' : 'إطلاق متجري',
      prompt: lang === 'fr'
        ? "Crée un visuel de lancement percutant pour l'ouverture de ma nouvelle boutique en ligne."
        : lang === 'en'
        ? 'Create a striking launch visual for the opening of my new online shop.'
        : 'أنشئ تصميم إطلاق جذاب لافتتاح متجري الجديد عبر الإنترنت.',
      SIcon: ShoppingBag,
    },
    {
      title: lang === 'fr' ? 'Landing page e-commerce' : lang === 'en' ? 'E-commerce landing page' : 'صفحة هبوط للمتجر',
      prompt: lang === 'fr'
        ? "Conçois la section hero d'une landing page e-commerce moderne pour une boutique en ligne, avec mise en avant produit et bouton d'achat."
        : lang === 'en'
        ? 'Design the hero section of a modern e-commerce landing page, with product highlight and buy button.'
        : 'صمم قسم hero لصفحة هبوط عصرية لمتجر إلكتروني، مع إبراز المنتج وزر شراء.',
      SIcon: Globe,
    },
    {
      title: lang === 'fr' ? 'Promotion -30%' : lang === 'en' ? '30% OFF promotion' : 'عرض خصم 30%',
      prompt: lang === 'fr'
        ? 'Génère un visuel promotionnel pour une réduction de -30% valable ce week-end seulement.'
        : lang === 'en'
        ? 'Generate a promotional visual for a -30% discount valid this weekend only.'
        : 'أنشئ تصميماً ترويجياً لخصم 30% صالح هذا الويك إند فقط.',
      SIcon: BadgePercent,
    },
    {
      title: lang === 'fr' ? 'Conseils pour ma clientèle' : lang === 'en' ? 'Tips for my customers' : 'نصائح لعملائي',
      prompt: lang === 'fr'
        ? 'Crée un contenu éducatif donnant 5 conseils pratiques à mes clients pour progresser rapidement.'
        : lang === 'en'
        ? 'Create educational content giving my customers 5 practical tips to progress quickly.'
        : 'أنشئ محتوى تعليمياً يقدم 5 نصائح عملية لعملائي للتقدم بسرعة.',
      SIcon: Lightbulb,
    },
    {
      title: lang === 'fr' ? 'Citation inspirante' : lang === 'en' ? 'Inspiring quote' : 'اقتباس ملهم',
      prompt: lang === 'fr'
        ? 'Crée un visuel avec une citation inspirante sur la réussite et la discipline pour LinkedIn.'
        : lang === 'en'
        ? 'Create a visual with an inspiring quote about success and discipline for LinkedIn.'
        : 'أنشئ تصميماً مع اقتباس ملهم عن النجاح والانضباط لـLinkedIn.',
      SIcon: Quote,
    },
  ].map((c) => ({ ...c, icon: <c.SIcon className="w-4 h-4 text-orange-600" /> }));

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 2800);
  };

  // Appel unique et défensif vers le moteur (/api/generate) — ne lève jamais d'exception
  const callGenerate = async (
    payload: Record<string, unknown>,
    timeoutMs: number
  ): Promise<{ ok: boolean; status: number; json: Record<string, unknown> | null }> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      let json: Record<string, unknown> | null = null;
      try {
        json = await res.json();
      } catch {}
      return { ok: res.ok, status: res.status, json };
    } catch {
      return { ok: false, status: 0, json: null };
    } finally {
      clearTimeout(timer);
    }
  };
  // Détection d'un lien de parrainage (?ref=CODE)
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get('ref');
      if (ref) {
        localStorage.setItem('aura_ref_applied', ref);
        showToast(t('refWelcome').replace('{r}', ref));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSessionMessagesMap((prev) => (prev[activeSessionId] === messages ? prev : { ...prev, [activeSessionId]: messages }));
  }, [messages, activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Click outside format & slides count dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsFormatDropdownOpen(false);
      }
      if (composerModelRef.current && !composerModelRef.current.contains(event.target as Node)) {
        setIsComposerModelOpen(false);
      }
      if (projectsRef.current && !projectsRef.current.contains(event.target as Node)) {
        setProjectsOpen(false);
      }
      if (attachRef.current && !attachRef.current.contains(event.target as Node)) {
        setAttachMenuOpen(false);
      }
      if (slidesCountDropdownRef.current && !slidesCountDropdownRef.current.contains(event.target as Node)) {
        setIsSlidesDropdownOpen(false);
      }
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
        setLangMenuOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProjectsOpen(false);
        setAttachMenuOpen(false);
        setChipSwapIndex(null);
        setIsFormatDropdownOpen(false);
        setIsComposerModelOpen(false);
        setIsSlidesDropdownOpen(false);
        setAccountMenuOpen(false);
        setModal(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Format definitions
  const formatOptions = FORMAT_ORDER.map((id) => {
    const F = FORMATS[id];
    return { id, label: F.label, ratio: `${F.w} × ${F.h}`, icon: <F.Icon className="w-4 h-4 text-gray-600" /> };
  });

  const currentFormatObj = formatOptions.find((f) => f.id === selectedFormat) || formatOptions[0];

  // Slide navigation in embedded canvas
  const handleSlideChange = (messageId: string, newIndex: number) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId && msg.design) {
          const total = msg.design.slides.length;
          const clampedIndex = Math.max(0, Math.min(newIndex, total - 1));
          return {
            ...msg,
            design: {
              ...msg.design,
              activeSlideIndex: clampedIndex,
            },
          };
        }
        return msg;
      })
    );
  };

  // Export slide as real PNG
  const downloadSlide = async (design: DesignContent, index: number) => {
    const slide = design.slides[index];
    const blob = await slideToPngBlob(
      slide,
      design.format,
      design.slides.length,
      {
        name: brandName,
        handle: brandHandle,
        color: brandColor,
      },
      { watermark: plan === 'free', light: design.style === 'light', fonts: design.fonts }
    );
    if (!blob) {
      showToast(t('exportUnsupported'));
      return false;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${design.title.replace(/[^\w\-]+/g, '_')}_slide_${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  };

  const handleExportSlide = async (design: DesignContent, index: number) => {
    showToast(t('exportingSlide').replace('{n}', String(index + 1)));
    if (await downloadSlide(design, index)) showToast(t('slideDownloaded').replace('{n}', String(index + 1)));
  };

  const handleExportAll = async (design: DesignContent) => {
    showToast(t('exportingAll').replace('{n}', String(design.slides.length)));
    for (let i = 0; i < design.slides.length; i++) {
      await downloadSlide(design, i);
      await new Promise((r) => setTimeout(r, 350));
    }
    showToast(t('allSlidesDownloaded'));
  };

  // ===== EXPORT MULTI-CALQUES VERS CANVA =====
  const getCanvaToken = (): string | null => {
    try {
      return localStorage.getItem('aura_canva_token');
    } catch {
      return null;
    }
  };

  const handleExportToCanva = async (design: DesignContent) => {
    setCanvaExporting(true);
    showToast(t('canvaPreparing'));
    try {
      const fmt = FORMATS[design.format];
      const blob = createEditableCanvaPptx({
        title: design.title,
        widthPx: fmt.w,
        heightPx: fmt.h,
        light: design.style === 'light',
        fonts: design.fonts,
        slides: design.slides.map((s) => ({
          slideNumber: s.slideNumber,
          tag: s.tag,
          title: s.title,
          subtitle: s.subtitle,
          bulletPoints: s.bulletPoints,
          stat: s.stat,
          image: s.image,
          ctaText: s.ctaText,
        })),
        brand: { name: brandName, handle: brandHandle, color: brandColor, logo: brandLogo },
      });

      const token = getCanvaToken();
      if (token) {
        // 1. Envoi automatique dans le compte Canva via Canva Connect (backend Cloudflare)
        try {
          const res = await fetch('/api/canva/import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              'X-Canva-Token': token,
              'X-Design-Title': design.title,
            },
            body: blob,
          });
          const data = await res.json();
          if (data.edit_url) {
            window.open(data.edit_url as string, '_blank', 'noopener');
            showToast(t('canvaOpened'));
            setCanvaExporting(false);
            return;
          }
          showToast(t('canvaFallback'));
        } catch {
          showToast(t('canvaFallback'));
        }
      } else {
        // 2. Pas de compte connecté : téléchargement du fichier + fenêtre de connexion
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${design.title.replace(/[^\w\-]+/g, '_')}_Canva.pptx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        setCanvaModalOpen(true);
        showToast('Fichier multi-calques téléchargé — connectez Canva pour l\'envoi automatique.');
      }
    } catch {
      showToast(t('canvaExportFail'));
    }
    setCanvaExporting(false);
  };

  // ===== EXPORT PDF (tous les slides en un seul fichier) =====
  const handleExportPdf = async (design: DesignContent) => {
    showToast(t('exportingPdf').replace('{n}', String(design.slides.length)));
    try {
      const fmt = FORMATS[design.format];
      const pages = [];
      for (const slide of design.slides) {
        const blob = await slideToPngBlob(
          slide,
          design.format,
          design.slides.length,
          { name: brandName, handle: brandHandle, color: brandColor },
          { mime: 'image/jpeg', watermark: plan === 'free', light: design.style === 'light', fonts: design.fonts }
        );
        if (!blob) {
          showToast(t('pdfUnsupported'));
          return;
        }
        pages.push({
          jpegBytes: new Uint8Array(await blob.arrayBuffer()),
          widthPt: pxToPt(fmt.w),
          heightPt: pxToPt(fmt.h),
          widthPx: fmt.w,
          heightPx: fmt.h,
        });
      }
      const pdfBlob = createPdfFromJpegs(pages);
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${design.title.replace(/[^\w\-]+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      showToast(t('pdfDownloaded'));
    } catch {
      showToast(t('pdfFail'));
    }
  };

  // ===== MAGIC RESIZE : décliner le design dans un autre format (gratuit) =====
  const handleResizeDesign = (design: DesignContent, newFormat: FormatType) => {
    const resized: DesignContent = {
      format: newFormat,
      title: design.title,
      activeSlideIndex: 0,
      slides: design.slides.map((sl, i) => ({ ...sl, id: `rsz_${i}_${Date.now()}` })),
      style: design.style,
      fonts: design.fonts,
    };
    const resizeMsg: Message = {
      id: `ast_${Date.now()}`,
      sender: 'assistant',
      text: t('resizedMsg').replace('{fmt}', FORMATS[newFormat].label),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      design: resized,
      suggestions: ['Exporter en PDF', 'Exporter tout le carrousel en PNG HD'],
    };
    setMessages((prev) => [...prev, resizeMsg]);
    showToast(t('resizedTo').replace('{f}', FORMATS[newFormat].label));
  };

  const handleCanvaConnect = () => {
    const tok = canvaTokenInput.trim();
    if (!tok) {
      showToast('Collez votre jeton d\'accès Canva.');
      return;
    }
    try {
      localStorage.setItem('aura_canva_token', tok);
    } catch {}
    setCanvaConnected(true);
    setCanvaTokenInput('');
    setCanvaModalOpen(false);
    showToast(t('canvaConnectedToast'));
  };

  // Copy slide text
  const handleCopySlideText = async (slide: Slide) => {
    const text = `${slide.tag}\n\n${slide.title}\n\n${slide.subtitle}\n\n${slide.bulletPoints?.join('\n') || ''}`;
    const ok = await copyText(text);
    if (ok) {
      setCopiedId(slide.id);
      showToast(t('slideCopied'));
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      showToast(t('copyFail'));
    }
  };

  const handleCopyMessage = async (text: string) => {
    showToast((await copyText(text)) ? t('textCopied') : t('copyFail'));
  };

  const handleShare = async () => {
    showToast((await copyText(window.location.href)) ? t('linkCopiedClip') : t('copyFail'));
  };

  const handleSuggestion = (sug: string, msg: Message) => {
    const lower = sug.toLowerCase();
    const lastUser = [...messages].reverse().find((m) => m.sender === 'user')?.text;
    if (lower.includes('png') && msg.design) {
      handleExportAll(msg.design);
      return;
    }
    if (lower.includes('pdf') && msg.design) {
      handleExportPdf(msg.design);
      return;
    }
    const opts = inferOpts(sug);
    if (lastUser && (lower.includes('slides') || lower.includes('format') || lower.includes('شرائح') || lower.includes('صيغة'))) {
      handleSendMessage(lastUser, opts);
      return;
    }
    prefillComposer(sug);
  };

  const noteTplSaved = () => {
    tplBatchRef.current.n += 1;
    if (tplBatchRef.current.timer) clearTimeout(tplBatchRef.current.timer);
    tplBatchRef.current.timer = setTimeout(() => {
      showToast(t('tplSavedCount').replace('{n}', String(tplBatchRef.current.n)));
      tplBatchRef.current.n = 0;
    }, 500);
  };

  const addTemplateFiles = (files: FileList | File[]) => {
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, 8);
    imgs.forEach((file) => {
      downscaleImage(file)
        .then((data) => {
          setTemplates((prev) => {
            if (prev.length >= TEMPLATE_MAX) {
              showToast(t('libFull'));
              return prev;
            }
            noteTplSaved();
            return [{ id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, data, name: file.name.slice(0, 40), at: Date.now() }, ...prev];
          });
        })
        .catch(() => showToast(t('copyFail')));
    });
  };

  // Handle send prompt
  const handleSendMessage = async (textToSend?: string, opts: { format?: FormatType; count?: number } = {}) => {
    const query = (textToSend || inputPrompt).trim();
    if ((!query && attachedImages.length === 0) || isGenerating || sendingRef.current) return;
    sendingRef.current = true;

    // Options ponctuelles posées via les commandes « / » (chips visibles au-dessus du champ)
    if (pendingProjectId && pendingProjectId !== activeProjectId) switchProject(pendingProjectId);

    const currentPhotos = [...attachedImages];
    let promptText = query || (currentPhotos.length > 0 ? 'Génère un design intégrant mes photos' : '');
    const chipLabels = pendingChips.map((cmd) => STYLE_CHIPS.find((x) => x.cmd === cmd)?.label[lang] || cmd);
    if (chipLabels.length > 0) {
      promptText = `${promptText} — ambiance : ${chipLabels.join(', ')}`;
    }
    const inferred = inferOpts(promptText);
    const resolvedFmt: FormatType = opts.format ?? inferred.format ?? selectedFormat;
    const resolvedStyle: 'dark' | 'light' = pendingStyle ?? 'dark';
    const resolvedCount = opts.count ?? inferred.count ?? carouselSlidesCount;

    // ===== FACTURATION POINTS : 1 image IA générée par slide =====
    const ptsPerImage = MODEL_POINTS[activeModelId];
    const aiImagesCount = FORMATS[resolvedFmt].kind === 'carousel' ? resolvedCount : 1;
    const generationCost = aiImagesCount * ptsPerImage;
    if (credits < generationCost) {
      showToast(t('insufficient').replace('{n}', String(generationCost)).replace('{c}', String(credits)));
      navigate('/pricing');
      sendingRef.current = false;
      return;
    }

    const sessionId = activeSessionId;
    setSelectedFormat(resolvedFmt);
    setCarouselSlidesCount(resolvedCount);
    setRecentSessions((prev) =>
      prev.some((s) => s.id === sessionId)
        ? prev
        : [{ id: sessionId, title: promptText.length > 34 ? `${promptText.slice(0, 34)}…` : promptText, format: resolvedFmt, projectId: pendingProjectId ?? activeProjectId }, ...prev]
    );

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      images: currentPhotos.length > 0 ? currentPhotos : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputPrompt('');
    setAttachedImages([]);
    const restore = { style: pendingStyle, chips: pendingChips, proj: pendingProjectId };
    setPendingStyle(null);
    setPendingProjectId(null);
    setPendingChips([]);
    setChipSwapIndex(null);
    setIsGenerating(true);
    setGenProgress(null);

    const activeFmt: FormatType = resolvedFmt;
    const isCarouselFmt = FORMATS[activeFmt].kind === 'carousel';
    const heroImg = currentPhotos[0] || imgAbstract;
    const secondaryImg = currentPhotos[1] || imgMarketing;

    // Photos PRODUIT attachées (fidélité 100 %) séparées des modèles de style
    const tplRefs = useTpl ? templates.slice(0, 3).map((tp) => tp.data) : [];
    let productImages: string[] = [];
    try {
      const attachedRefs = await Promise.all(
        currentPhotos.slice(0, 2).map((d) => downscaleDataUrl(d).catch(() => null))
      );
      productImages = attachedRefs.filter(Boolean) as string[];
    } catch {}
    const refImages: string[] = productImages.length > 0 ? productImages : tplRefs;

    // Polices effectives : Brand Kit > choix IA > défaut
    let effectiveEngineFonts: FontPair = { ...DEFAULT_FONTS };
    const effectiveFonts: FontPair = {
      title: brandTitleFont || effectiveEngineFonts.title,
      body: brandBodyFont || effectiveEngineFonts.body,
    };
    ensureFontLoaded(effectiveFonts.title, [600, 700]);
    ensureFontLoaded(effectiveFonts.body, [400, 500, 600, 700]);

    // Livraison : débit APRÈS succès, au prorata des images réellement livrées
    const deliverDesign = (slides: Slide[], info?: { partial?: boolean; total?: number }) => {
      if (currentPhotos.length > 0) {
        for (const sl of slides) sl.heroShot = true;
      }

      const generatedDesign: DesignContent = {
        format: activeFmt,
        title: promptText.length < 35 ? promptText : 'Post Social Media Optimisé',
        activeSlideIndex: 0,
        slides,
        style: resolvedStyle,
        fonts: effectiveFonts,
      };

      const fmtLabel = FORMATS[activeFmt].label;
      const isCarousel = FORMATS[activeFmt].kind === 'carousel';
      let aiMsgText = isCarousel
        ? t('aiIntroMany').replace('{n}', String(slides.length)).replace('{fmt}', fmtLabel)
        : t('aiIntroOne').replace('{fmt}', fmtLabel);
      if (resolvedStyle === 'light') aiMsgText += ` ${t('aiStyleLight')}`;
      if (currentPhotos.length > 0) aiMsgText += ` ${t('aiProductExact')}`;
      if (chipLabels.length > 0) aiMsgText += ` ${t('aiChips').replace('{chips}', chipLabels.join(', '))}`;
      if (refImages.length > 0) aiMsgText += ` ${t('aiRefUsed')}`;
      aiMsgText += ` ${t('aiCanvasTip')}`;

      const aiMsg: Message = {
        id: `ast_${Date.now()}`,
        sender: 'assistant',
        text: aiMsgText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        design: generatedDesign,
        suggestions: [
          t('sugRefine'),
          isCarousel ? t('sugRegenSlides').replace('{n}', String(resolvedCount === 5 ? 7 : 5)) : t('sugToCarousel'),
          t('sugExportPng'),
          t('sugExportPdf'),
        ],
      };

      if (activeIdRef.current === sessionId) {
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        setSessionMessagesMap((prev) => ({ ...prev, [sessionId]: [...(prev[sessionId] || []), aiMsg] }));
      }

      const debited = slides.length * ptsPerImage;
      setCredits((c) => Math.max(0, c - debited));
      if (info?.partial) {
        showToast(
          t('partialGen')
            .replace('{a}', String(slides.length))
            .replace('{b}', String(info.total ?? slides.length))
            .replace('{p}', String(debited))
        );
      } else {
        setTimeout(
          () => showToast(t('pointsSpent').replace('{n}', String(debited)).replace('{c}', String(Math.max(0, credits - debited)))),
          500
        );
      }
      if (isSupabaseConfigured) {
        void saveRemoteSession({
          id: sessionId,
          title: promptText.slice(0, 60),
          format: activeFmt,
          previewText: aiMsgText.slice(0, 140),
          lastUpdated: new Date().toISOString(),
          messages: [userMsg, aiMsg],
        }).catch(() => {});
      }
      setIsGenerating(false);
    };

    // ===== MOTEUR (uniquement si configuré côté serveur) =====
    if (!engineUnavailableRef.current) {
      // Étape COPY : 1 appel texte, jamais relancé
      const copyRes = await callGenerate(
        { stage: 'copy', prompt: promptText, format: activeFmt, slidesCount: isCarouselFmt ? resolvedCount : 1, lang, style: resolvedStyle, profile: brandProfile },
        35000
      );

      if (copyRes.json && copyRes.json.configured === false) {
        // Pas de clé sur Cloudflare -> mode démo local, on ne retente plus ce session-ci
        engineUnavailableRef.current = true;
      } else if (copyRes.ok && copyRes.json && Array.isArray((copyRes.json.design as { slides?: unknown[] } | undefined)?.slides)) {
        const rawSlides = (copyRes.json.design as { slides: Record<string, unknown>[] }).slides;
        const rawFonts = ((copyRes.json.design as { fonts?: { title?: unknown; body?: unknown } }).fonts) || {};
        const engineFonts = {
          title: typeof rawFonts.title === 'string' && VALID_FONT_NAMES.has(rawFonts.title) ? rawFonts.title : DEFAULT_FONTS.title,
          body: typeof rawFonts.body === 'string' && VALID_FONT_NAMES.has(rawFonts.body) ? rawFonts.body : DEFAULT_FONTS.body,
        };
        const engineSlides: Slide[] = rawSlides.slice(0, 10).map((sl, i) => ({
          id: `gen_${i + 1}_${Date.now()}`,
          slideNumber: i + 1,
          tag: String(sl.tag ?? '').slice(0, 60),
          title: String(sl.title ?? '').slice(0, 140),
          subtitle: String(sl.subtitle ?? '').slice(0, 260),
          highlightWord: typeof sl.highlightWord === 'string' && sl.highlightWord ? sl.highlightWord.slice(0, 40) : undefined,
          bulletPoints: Array.isArray(sl.bulletPoints) ? sl.bulletPoints.map((b) => String(b)).slice(0, 5) : undefined,
          ctaText: typeof sl.ctaText === 'string' && sl.ctaText ? sl.ctaText.slice(0, 60) : undefined,
        }));

        effectiveEngineFonts = engineFonts;
        // Étape IMAGES : 1 appel par slide, séquentiel, progression live, STOP au 1er échec
        const received: { idx: number; dataUrl: string }[] = [];
        for (let i = 0; i < engineSlides.length; i++) {
          setGenProgress({ done: i, total: engineSlides.length });
          const sl = engineSlides[i];
          const imgRes = await callGenerate(
            {
              stage: 'image',
              modelId: activeModelId,
              format: activeFmt,
              style: resolvedStyle,
              lang,
              brand: { name: brandName, handle: brandHandle, color: brandColor },
              references: refImages,
              productImages,
              profile: brandProfile,
              slide: {
                slideNumber: sl.slideNumber,
                tag: sl.tag,
                title: sl.title,
                subtitle: sl.subtitle,
                highlightWord: sl.highlightWord,
                bulletPoints: sl.bulletPoints,
                ctaText: sl.ctaText,
              },
            },
            95000
          );
          const img = typeof imgRes.json?.image === 'string' ? (imgRes.json.image as string) : null;
          if (imgRes.ok && img) received.push({ idx: i, dataUrl: img });
          else break;
        }
        setGenProgress(null);

        if (received.length === 0) {
          // Échec total : AUCUN point débité + restitution des réglages one-shot
          setIsGenerating(false);
          showToast(t('engineError'));
          setPendingStyle(restore.style);
          setPendingChips(restore.chips);
          setPendingProjectId(restore.proj);
          sendingRef.current = false;
          return;
        }

        const delivered = received.map((r) => ({ ...engineSlides[r.idx], image: r.dataUrl, heroShot: productImages.length > 0 }));
        deliverDesign(delivered, { partial: delivered.length < engineSlides.length, total: engineSlides.length });
        sendingRef.current = false;
        return;
      } else if (!copyRes.ok || copyRes.status === 429 || copyRes.status >= 500) {
        // Moteur configuré mais injoignable : échec franc (pas de faux design, pas de débit)
        setGenProgress(null);
        setIsGenerating(false);
        showToast(t('engineError'));
        setPendingStyle(restore.style);
        setPendingChips(restore.chips);
        setPendingProjectId(restore.proj);
        sendingRef.current = false;
        return;
      }
    }

    // ===== FALLBACK DÉMO (100 % local, zéro appel réseau) =====
    await new Promise((r) => setTimeout(r, 900));

    let slidesToBuild: Slide[] = [];

    if (FORMATS[activeFmt].kind === 'carousel') {
      const count = resolvedCount;
      // Slide 1: Hook
      slidesToBuild.push({
        id: `gen_1_${Date.now()}`,
        slideNumber: 1,
        tag: 'HOOK MAJEUR · 2026',
        title: promptText.length < 45 ? promptText : 'Ce que 90% des créateurs font encore de travers.',
        subtitle: `Guide stratégique en ${count} étapes pour décupler votre impact organique sans friction.`,
        highlightWord: 'travers',
        image: heroImg,
        ctaText: 'Faites glisser pour découvrir ➔',
      });

      const intermediateTemplates = [
        {
          tag: 'ÉTAPE #1 · LA CLARTÉ RADICALE',
          title: 'Éliminez le bruit. Focalisez sur la promesse.',
          subtitle: 'Votre audience n\'a que 3 secondes d\'attention. Chaque mot superflu réduit votre portée de moitié.',
          bullets: [
            'Une seule idée forte par visuel',
            'Contraste noir et blanc chirurgical',
            'CTA précis et immédiat',
          ],
        },
        {
          tag: 'ÉTAPE #2 · LA PREUVE TANGIBLE',
          title: 'L\'effet de la preuve sur la conversion.',
          subtitle: 'Mesuré sur plus de 1 200 campagnes de contenu organique en B2B et B2C.',
          stat: {
            value: '+318%',
            label: 'd\'engagement moyen observé en adoptant ce framework',
          },
          image: secondaryImg,
        },
        {
          tag: 'ÉTAPE #3 · LE PIÈGE HABITUEL',
          title: 'Arrêtez de vendre des fonctionnalités.',
          subtitle: 'Les prospects achètent la transformation et le gain de temps, jamais vos caractéristiques.',
          bullets: [
            'Focalisez sur le problème immédiat',
            'Démontrez le bénéfice chiffré',
            'Créez un sentiment d\'urgence légitime',
          ],
        },
        {
          tag: 'ÉTAPE #4 · L\'ACTION DIRECTE',
          title: 'Mettez en place la règle des 48 heures.',
          subtitle: 'Un test direct sur le marché apporte plus d\'enseignements que trois mois d\'analyse.',
          bullets: [
            'Lancer une version minimaliste',
            'Collecter les premiers retours qualifiés',
            'Itérer sur les éléments d\'accroche',
          ],
        },
        {
          tag: 'ÉTAPE #5 · L\'EFFET DE LEVIER',
          title: 'Recyclez vos meilleurs concepts en continu.',
          subtitle: 'Un contenu performant peut être décliné sous 5 formats différents tout au long de l\'année.',
          stat: {
            value: '4.2x',
            label: 'de portée cumulée grâce au recyclage multi-format',
          },
        },
        {
          tag: 'ÉTAPE #6 · L\'OPTIMISATION',
          title: 'Maximisez les sauvegardes et partages.',
          subtitle: 'Ce sont les signaux les plus valorisés par les algorithmes de recommandation actuels.',
          bullets: [
            'Rendre le slide final hautement actionnable',
            'Insérer une checklist téléchargeable',
            'Inciter à l\'enregistrement pour plus tard',
          ],
        },
      ];

      for (let i = 2; i < count; i++) {
        const tpl = intermediateTemplates[(i - 2) % intermediateTemplates.length];
        slidesToBuild.push({
          id: `gen_${i}_${Date.now()}`,
          slideNumber: i,
          tag: tpl.tag,
          title: tpl.title,
          subtitle: tpl.subtitle,
          bulletPoints: tpl.bullets,
          stat: tpl.stat,
          image: tpl.image,
        });
      }

      // Final Slide: CTA
      slidesToBuild.push({
        id: `gen_final_${Date.now()}`,
        slideNumber: count,
        tag: 'SYNTHÈSE & PASSAGE À L\'ACTION',
        title: 'Prêt à transformer votre portée organique ?',
        subtitle: `Enregistrez ce carrousel de ${count} slides pour votre prochaine campagne et partagez-le.`,
        bulletPoints: [
          'Hook paradoxal en moins de 8 mots',
          'Une seule idée force par slide',
          'CTA orienté bénéfice mesurable',
        ],
        ctaText: `Enregistrer le post · Suivre ${brandHandle}`,
      });
    } else {
      // Story or Square
      slidesToBuild = [
        {
          id: `gen_1_${Date.now()}`,
          slideNumber: 1,
          tag: FORMATS[activeFmt].tag,
          title: promptText.length < 60 ? promptText : 'Un design pensé pour convertir dès le premier regard.',
          subtitle: FORMATS[activeFmt].sub,
          highlightWord: undefined,
          image: heroImg,
          ctaText: FORMATS[activeFmt].cta,
        },
        {
          id: `gen_2_${Date.now()}`,
          slideNumber: 2,
          tag: 'APPLICATION CONCRÈTE',
          title: 'L\'effet de la clarté sur la conversion.',
          subtitle: 'Mesuré sur plus de 1 200 campagnes de contenu organique.',
          stat: {
            value: '+240%',
            label: 'd\'engagement moyen observé en adoptant ce framework',
          },
          image: secondaryImg,
          ctaText: `Suivre ${brandHandle}`,
        },
      ];
    }


    deliverDesign(slidesToBuild);
    sendingRef.current = false;
  };


  // ===== COMMANDES SLASH (précises) : « / » uniquement en tout début de champ =====
  // En plein texte (ex: « promo 20/30 »), le slash reste du texte simple : zéro conflit avec les pills
  // (format, modèle), qui restent les réglages persistants par défaut.
  const slashMatch = /^\/([\p{L}\p{N}_-]*)$/u.exec(inputPrompt.trimStart());
  const slashQuery = slashMatch ? slashMatch[1].toLowerCase() : null;
  const slashStyleItems =
    slashQuery === null
      ? []
      : [
          { cmd: 'sombre', label: 'Design sombre', style: 'dark' as const },
          { cmd: 'clair', label: 'Design clair', style: 'light' as const },
        ]
          .filter((st) => st.cmd.startsWith(slashQuery) || st.cmd.includes(slashQuery))
          .map((st) => ({ kind: 'style' as const, ...st }));
  const slashChipItems =
    slashQuery === null
      ? []
      : STYLE_CHIPS.filter((c) => c.cmd.startsWith(slashQuery) || c.label.fr.toLowerCase().includes(slashQuery) || c.label.en.toLowerCase().includes(slashQuery)).map((c) => ({
          kind: 'chip' as const,
          cmd: c.cmd,
          label: c.label,
        }));
  const slashProjectItems =
    slashQuery === null
      ? []
      : projects
          .filter((pk) => slugify(pk.name || t('defaultBrand')).includes(slashQuery) || slugify(t('defaultBrand')).includes(slashQuery))
          .map((pk) => ({ kind: 'project' as const, id: pk.id, cmd: slugify(pk.name || t('defaultBrand')), label: pname(pk.name) }));
  const slashItems = [...slashStyleItems, ...slashChipItems, ...slashProjectItems];
  useEffect(() => {
    setSlashIndex(0);
  }, [inputPrompt]);

  const acceptSlash = (item: (typeof slashItems)[number]) => {
    if (item.kind === 'style') {
      setPendingStyle(item.style);
      showToast(`${item.style === 'dark' ? t('styleDark') : t('styleLight')} — ${t('appliedNext')}`);
    } else if (item.kind === 'chip') {
      // L'ambiance devient une chip cliquable (pas du texte brut)
      setPendingChips((prev) => {
        if (prev.includes(item.cmd)) return prev;
        if (prev.length >= 3) {
          showToast(t('maxChips'));
          return prev;
        }
        showToast(`${t('ambianceAdded')} : ${item.label[lang]}`);
        return [...prev, item.cmd];
      });
    } else {
      setPendingProjectId(item.id);
      const pk = projects.find((x) => x.id === item.id);
      showToast(`${t('spacesGrp')} « ${pk?.name} » — ${t('appliedNext')}`);
    }
    composerInputRef.current?.focus();
  };

  const autoResizeComposer = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashItems.length > 0 && slashQuery !== null) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % slashItems.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + slashItems.length) % slashItems.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        acceptSlash(slashItems[Math.min(slashIndex, slashItems.length - 1)]);
        return;
      }
      if (e.key === 'Escape') {
        setInputPrompt(`${inputPrompt} `);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const closeSidebarOnMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleNewDesign = () => {
    setActiveSessionId(`sess_${Date.now()}`);
    setMessages([]);
    setInputPrompt('');
    setAttachedImages([]);
    setSearchOpen(false);
    setSessionSearch('');
    closeSidebarOnMobile();
  };

  const handleSelectSession = (sessionId: string) => {
    if (isGenerating) {
      showToast(t('pleaseWaitGenerating'));
      return;
    }
    const msgs = sessionMessagesMap[sessionId] ?? [];
    setActiveSessionId(sessionId);
    setMessages(msgs);
    closeSidebarOnMobile();
  };

  const handleDeleteSession = (sessionId: string) => {
    setRecentSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setSessionMessagesMap((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
    if (sessionId === activeSessionId) handleNewDesign();
    showToast(t('sessionDeleted'));
  };

  const filteredSessions = recentSessions.filter(
    (s) => (s.projectId || 'p1') === activeProjectId && s.title.toLowerCase().includes(sessionSearch.trim().toLowerCase())
  );

  // Toast partagé entre l'app et la page /pricing
  const toastEl = toastMessage ? (
    <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-gray-900 text-white shadow-xl text-xs font-medium animate-fade-in">
      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>{toastMessage}</span>
    </div>
  ) : null;

  // ===== PAGE /home — LANDING PUBLIQUE =====
  if (route === '/' || route === '/home') {
    return (
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <LandingPage
          credits={credits}
          lang={lang}
          onEnter={() => navigate('/app')}
          onPricing={() => navigate('/pricing')}
          onReferral={() => {
            navigate('/app');
            setReferralOpen(true);
          }}
        />
        {toastEl}
      </div>
    );
  }

  // ===== PAGE /brand — ESPACES & BRAND KIT =====
  if (route === '/brand') {
    return (
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <BrandPage
          lang={lang}
          projects={projects}
          activeProjectId={activeProjectId}
          plan={plan}
          credits={credits}
          brandName={brandName}
          brandHandle={brandHandle}
          brandColor={brandColor}
          brandLogo={brandLogo}
          onSwitch={switchProject}
          onCreate={createProject}
          onDelete={deleteProject}
          onName={setBrandName}
          onHandle={setBrandHandle}
          onColor={setBrandColor}
          onLogo={setBrandLogo}
          titleFont={brandTitleFont}
          bodyFont={brandBodyFont}
          onFonts={(tf, bf) => {
            setBrandTitleFont(tf && VALID_FONT_NAMES.has(tf) ? tf : '');
            setBrandBodyFont(bf && VALID_FONT_NAMES.has(bf) ? bf : '');
            if (tf) ensureFontLoaded(tf, [600, 700]);
            if (bf) ensureFontLoaded(bf, [400, 500, 600, 700]);
          }}
          onBack={() => navigate('/app')}
          onPricing={() => navigate('/pricing')}
        />
        {toastEl}
      </div>
    );
  }

  // ===== PAGE /pricing DÉDIÉE =====
  if (route === '/pricing') {
    return (
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <PricingPage
          currentPlan={plan}
          credits={credits}
          lang={lang}
          onChoose={(packId) => {
            if (packId === plan) return;
            setPlan(packId);
            if (packId === 'free') setCredits(20);
            if (packId === 'starter') setCredits(150);
            if (packId === 'pro') setCredits(450);
            const pack = PRICING.find((pk) => pk.id === packId);
            showToast(`${pack?.name[lang]} — ${pack?.points?.[lang] || ''} ✓`);
          }}
          onBack={() => navigate('/')}
        />
        {toastEl}
      </div>
    );
  }

  if (loggedOut) {
    return (
      <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden p-4">
        <div className="aurora" aria-hidden="true">
          <span className="blob blob-a" />
          <span className="blob blob-b" />
          <span className="blob blob-c" />
          <span className="blob blob-d" />
        </div>
        <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white/85 backdrop-blur-md border border-orange-200/60 shadow-xl p-8 text-center space-y-4 animate-fade-in">
          <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">{t('loggedOutTitle')}</h1>
          <p className="text-sm text-gray-500">{t('loggedOutSub')}</p>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem('aura_logged_out');
              } catch {}
              setLoggedOut(false);
            }}
            className="w-full px-4 py-2.5 rounded-full bg-gray-900 hover:bg-black text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            {t('relogin')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="relative flex h-screen w-screen bg-transparent text-gray-900 font-sans overflow-hidden antialiased">

      {/* Fond dégradé orange / jaune qui bouge lentement */}
      <div className="aurora" aria-hidden="true">
        <span className="blob blob-a" />
        <span className="blob blob-b" />
        <span className="blob blob-c" />
        <span className="blob blob-d" />
      </div>
      {/* ========================================================= */}
      {/* 1. PANNEAU GAUCHE (SIDEBAR - MENU & HISTORIQUE STYLE GEMINI) */}
      {/* ========================================================= */}
      <aside
        className={`${
          sidebarOpen ? 'w-64 sm:w-72' : 'w-0 -translate-x-full'
        } transition-all duration-300 ease-in-out h-full bg-white/75 backdrop-blur-xl border-r border-orange-200/40 flex flex-col shrink-0 z-20 overflow-hidden max-md:absolute max-md:inset-y-0 max-md:left-0`}
      >
        {/* En haut : Logo / Titre SaaS */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4 text-white stroke-[2.5]" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-gray-900 text-lg tracking-tight">Aura</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-200/80 text-gray-700">
                Design
              </span>
            </div>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            title={t('hideSidebar')}
            className="p-1.5 rounded-full hover:bg-gray-200/80 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Liens de navigation avec icônes (Pill-shaped) */}
        <div className="px-3 py-2 space-y-1">
          {/* Nouveau design */}
          <button
            onClick={handleNewDesign}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full bg-white hover:bg-gray-100/90 text-gray-800 text-sm font-semibold border border-gray-200 shadow-xs transition-all cursor-pointer group"
          >
            <Plus className="w-4 h-4 text-gray-700 group-hover:scale-110 transition-transform" />
            <span>{t('newDesign')}</span>
          </button>

          {/* Recherche */}
          <button
            onClick={() => {
              setSearchOpen((v) => !v);
              if (searchOpen) setSessionSearch('');
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
              searchOpen ? 'bg-white/80 text-gray-900' : 'hover:bg-white/70 text-gray-600 hover:text-gray-900'
            }`}
          >
            <Search className="w-4 h-4 text-gray-500" />
            <span>{t('search')}</span>
          </button>
          {searchOpen && (
            <input
              autoFocus
              value={sessionSearch}
              onChange={(e) => setSessionSearch(e.target.value)}
              placeholder={t('searchSessions')}
              className="w-full px-4 py-2 rounded-full bg-white/90 border border-orange-200/60 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-300/50"
            />
          )}

          {/* Sélecteur d'Espace (projet / Brand Kit) */}
          <div className="relative" ref={projectsRef}>
            <button
              onClick={() => setProjectsOpen((v) => !v)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-full hover:bg-gray-200/60 text-gray-700 hover:text-gray-900 text-sm font-medium transition-colors cursor-pointer"
              title={t('changeProject')}
            >
              <span
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 overflow-hidden text-[10px] font-bold text-white"
                style={{ backgroundColor: activeProject.color }}
              >
                {activeProject.logo ? <img src={activeProject.logo} alt="" className="w-full h-full object-contain p-0.5" /> : pname(activeProject.name).slice(0, 1).toUpperCase()}
              </span>
              <span className="truncate flex-1 text-left font-semibold">{pname(activeProject.name)}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${projectsOpen ? 'rotate-180' : ''}`} />
            </button>

            {projectsOpen && (
              <div className="absolute inset-x-2 top-full mt-1.5 rounded-2xl bg-white border border-gray-200 shadow-xl p-1.5 z-40 space-y-0.5">
                <div className="px-2.5 pt-1 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                  <span>{t('spacesGrp')}</span>
                  <span>
                    {projects.length}/{PACK_PROJECT_LIMIT[plan] === Infinity ? '∞' : PACK_PROJECT_LIMIT[plan]}
                  </span>
                </div>
                {projects.map((pk) => (
                  <button
                    key={pk.id}
                    type="button"
                    onClick={() => {
                      switchProject(pk.id);
                      setProjectsOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                      pk.id === activeProjectId ? 'bg-amber-50 text-amber-900 font-bold' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 overflow-hidden text-[10px] font-bold text-white"
                      style={{ backgroundColor: pk.color }}
                    >
                      {pk.logo ? <img src={pk.logo} alt="" className="w-full h-full object-contain p-0.5" /> : pk.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="truncate flex-1 text-left">{pk.name}</span>
                    <span className="text-[9px] text-gray-400 truncate max-w-[80px]">{pk.handle}</span>
                    {pk.id === activeProjectId && <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                  </button>
                ))}
                <div className="my-1 border-t border-gray-100" />
                <button
                  type="button"
                  onClick={createProject}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-amber-700 hover:bg-amber-50 cursor-pointer transition-colors"
                >
                  <span className="w-6 h-6 rounded-lg border border-dashed border-amber-400 flex items-center justify-center shrink-0">
                    <Plus className="w-3.5 h-3.5" />
                  </span>
                  {t('newProject')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProjectsOpen(false);
                    navigate('/brand');
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  <span className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <Palette className="w-3.5 h-3.5 text-gray-500" />
                  </span>
                  {t('editBrandKit')}
                </button>
              </div>
            )}
          </div>

          {/* Tarifs & Packs */}
          <button
            onClick={() => navigate('/pricing')}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-full hover:bg-gray-200/60 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
          >
            <Zap className="w-4 h-4 text-amber-500" />
            <span>{t('upgrade')}</span>
            <span dir="ltr" className="ml-auto text-[10px] font-bold text-amber-600 bg-amber-100/80 px-1.5 py-0.5 rounded-full">
              {credits} pts
            </span>
          </button>

          {/* Parrainage */}
          <button
            onClick={() => setReferralOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-full hover:bg-gray-200/60 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
          >
            <Gift className="w-4 h-4 text-orange-500" />
            <span>{t('referFriend')}</span>
            <span dir="ltr" className="ml-auto text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded-full">
              +50 pts
            </span>
          </button>
        </div>

        {/* Section "Récents" (Historique avec pills arrondis) */}
        <div className="flex-1 overflow-y-auto px-3 py-3 mt-1 space-y-1">
          <div className="px-3 pb-1 text-xs font-semibold text-gray-400 tracking-wider uppercase">
            {t('recents')}
          </div>

          {filteredSessions.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">{t('noSessions')}</p>
          )}

          {filteredSessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <div key={session.id} className="group relative">
                <button
                  onClick={() => handleSelectSession(session.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2 text-sm transition-all rounded-full text-left cursor-pointer ${
                    isActive
                      ? 'bg-white/90 text-gray-900 font-semibold shadow-xs'
                      : 'text-gray-600 hover:bg-white/60 hover:text-gray-900 font-medium'
                  }`}
                >
                  <span className="truncate pr-2">{session.title}</span>
                  <span className="text-[10px] text-gray-400 shrink-0 group-hover:opacity-0 transition-opacity">
                    {FORMATS[session.format].short}
                  </span>
                </button>
                <button
                  onClick={() => handleDeleteSession(session.id)}
                  title="Supprimer"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* En bas : Profil utilisateur "Labbaci Malek" avec avatar et réglages */}
        <div ref={accountRef} className="relative p-3 border-t border-orange-200/40 bg-white/60">
          {accountMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 rounded-2xl bg-white border border-gray-200 shadow-xl p-1.5 z-40 animate-fade-in">
              {[
                { key: 'settings', Icon: Settings, label: t('settings'), action: () => { setModal('settings'); setAccountMenuOpen(false); } },
                { key: 'language', Icon: Languages, label: t('language'), action: () => setLangMenuOpen((v) => !v), chevron: true },
              ].map((it) => (
                <div key={it.key}>
                  <button
                    type="button"
                    onClick={it.action}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-orange-50 hover:text-gray-900 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-3">
                      <it.Icon className="w-4 h-4 text-gray-500" />
                      {it.label}
                    </span>
                    {it.chevron && <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${langMenuOpen ? 'rotate-90' : ''}`} />}
                  </button>
                  {it.key === 'language' && langMenuOpen && (
                    <div className="ml-4 pl-3 border-l border-orange-200/70 my-1 space-y-0.5">
                      {LANGS.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            setLang(l.id);
                            setLangMenuOpen(false);
                            setAccountMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${
                            lang === l.id ? 'bg-orange-50 text-orange-800 font-semibold' : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <span>{l.label}</span>
                          {lang === l.id && <Check className="w-3.5 h-3.5 text-orange-600" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {[
                { key: 'referral', Icon: Gift, label: 'Parrainer un ami', action: () => setReferralOpen(true) },
                { key: 'help', Icon: CircleHelp, label: t('help'), action: () => setModal('help') },
                { key: 'about', Icon: Info, label: t('learnMore'), action: () => setModal('about') },
                { key: 'upgrade', Icon: Zap, label: t('upgrade'), action: () => navigate('/pricing') },
              ].map((it) => (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => {
                    it.action();
                    setAccountMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-orange-50 hover:text-gray-900 transition-colors cursor-pointer"
                >
                  <it.Icon className={`w-4 h-4 ${it.key === 'upgrade' ? 'text-orange-500' : 'text-gray-500'}`} />
                  {it.label}
                </button>
              ))}
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem('aura_logged_out', '1');
                  } catch {}
                  setAccountMenuOpen(false);
                  setLoggedOut(true);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                {t('logout')}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setAccountMenuOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 rounded-xl px-1.5 py-1 hover:bg-white/70 transition-colors cursor-pointer text-start"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-900 to-gray-700 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                L{userFirstName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate leading-tight">Labbaci {userFirstName}</p>
                <p className="text-[11px] text-gray-500 truncate">
                  {t('plan')} {PRICING.find((x) => x.id === plan)?.name[lang]}
                </p>
              </div>
            </div>
            <Settings className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${accountMenuOpen ? 'rotate-90' : ''}`} />
          </button>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. PANNEAU CENTRAL (ZONE DE CHAT & ESPACE DE TRAVAIL BLANC) */}
      {/* ========================================================= */}
      <main className="flex-1 flex flex-col h-full relative min-w-0">
        {/* Top Header épuré style Gemini */}
        <header className="h-14 px-4 sm:px-6 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                title={t('showSidebar')}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            {/* Pack choisi (clique = page tarifs) */}
            <button
              type="button"
              onClick={() => navigate('/pricing')}
              title={t('yourPack')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full hover:bg-white/70 text-gray-900 font-semibold text-sm cursor-pointer transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span className="tracking-tight">{t('plan')} {PRICING.find((pk) => pk.id === plan)?.name[lang] || ''}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Points façon Manus : Packs | points */}
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white border border-gray-200/80 text-xs font-semibold shadow-2xs">
              <button
                type="button"
                onClick={() => navigate('/pricing')}
                className="hidden md:inline text-amber-600 font-bold cursor-pointer hover:text-amber-700 transition-colors"
              >
                {t('packs')}
              </button>
              <span className="w-px h-3.5 bg-gray-200" />
              <span dir="ltr" className={`flex items-center gap-1 font-bold ${credits < 5 ? 'text-red-600' : 'text-gray-900'}`}>
                <Zap className={`w-3.5 h-3.5 ${credits < 5 ? 'text-red-500' : 'text-amber-500'}`} />
                {credits}
              </span>
            </div>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/85 hover:bg-white text-gray-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-gray-600" />
              <span className="hidden sm:inline">{t('share')}</span>
            </button>
          </div>
        </header>

        {/* Flux de discussion (Au centre) */}
        <div className={`flex-1 overflow-y-auto px-4 sm:px-6 pt-4 flex flex-col ${messages.length === 0 ? 'pb-[calc(56vh+1rem)]' : 'pb-36'}`}>
          {messages.length === 0 ? (
            /* ========================================================= */
            /* PAGE D'ACCUEIL NOUVEAU DESIGN STYLE GEMINI */
            /* ========================================================= */
            <div className="mt-auto w-full max-w-3xl mx-auto text-center animate-fade-in">
              <div className="flex items-center justify-center gap-3 mb-2">
                <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-orange-500 stroke-[2]" />
                <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-gray-900">
                  {greetingSalutation}, {userFirstName}
                </h1>
              </div>
              <p className="text-base sm:text-lg text-gray-500 font-normal">
                {t('subtitle')}
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-8 w-full">
              <AnimatePresence initial={false}>
                {messages.map((msg) => {
                  const isUser = msg.sender === 'user';

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="space-y-4"
                    >
                      {/* Ligne utilisateur ou IA */}
                      <div className="flex items-start gap-3.5">
                        {isUser ? (
                          <div className="w-7 h-7 rounded-full bg-gray-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                            L{userFirstName.charAt(0).toUpperCase()}
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                            <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-gray-900">
                              {isUser ? `Labbaci ${userFirstName}` : 'Aura Design AI'}
                            </span>
                            <span className="text-[11px] text-gray-400 ">{msg.timestamp}</span>
                          </div>

                          {/* Texte du message */}
                          <p className="text-sm sm:text-[15px] text-gray-800 leading-relaxed font-normal whitespace-pre-line">
                            {msg.text}
                          </p>

                          {/* Photos attachées par l'utilisateur */}
                          {msg.images && msg.images.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2.5">
                              {msg.images.map((img, i) => (
                                <div
                                  key={i}
                                  className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200 shadow-xs group"
                                >
                                  <img
                                    src={img}
                                    alt={`Photo attachée ${i + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {/* CANVA DE PRÉVISUALISATION VISUELLE INTÉGRÉ AU FLUX (BLOC SOMBRE CONTRASTÉ) */}
                          {msg.design && (
                            <div className="mt-5 rounded-3xl bg-zinc-950 text-white border border-zinc-800 p-4 sm:p-6 shadow-xl relative overflow-hidden">
                              {/* Ambient glow */}
                              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                              {/* Canvas Top Controls */}
                              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="px-2.5 py-1 rounded-full bg-zinc-900 text-amber-400  text-[11px] font-bold border border-amber-500/30">
                                    {FORMATS[msg.design.format].label}
                                  </span>
                                  <span className="text-zinc-400 text-xs font-medium">
                                    Slide {(msg.design.activeSlideIndex || 0) + 1} sur {msg.design.slides.length}
                                  </span>
                                </div>

                                {/* Actions d'export & copie */}
                                <div className="flex flex-wrap items-center justify-end gap-1.5">
                                  <button
                                    onClick={() =>
                                      handleCopySlideText(msg.design!.slides[msg.design!.activeSlideIndex || 0])
                                    }
                                    title={t('copyText')}
                                    className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                                  >
                                    {copiedId === msg.design.slides[msg.design.activeSlideIndex || 0].id ? (
                                      <Check className="w-3.5 h-3.5 text-amber-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>

                                  <div className="relative">
                                    <button
                                      onClick={() => setResizeOpenId(resizeOpenId === msg.id ? null : msg.id)}
                                      title={t('resizeHint')}
                                      className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                    >
                                      <Maximize2 className="w-3.5 h-3.5" />
                                    </button>
                                    {resizeOpenId === msg.id && (
                                      <div className="absolute end-0 bottom-10 w-56 rounded-2xl bg-white border border-gray-200 shadow-xl p-1.5 z-30 space-y-0.5">
                                        <div className="px-2.5 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                          {t('resizeTitle')}
                                        </div>
                                        {FORMAT_ORDER.filter((f) => f !== msg.design!.format).map((f) => {
                                          const F = FORMATS[f];
                                          return (
                                            <button
                                              key={f}
                                              type="button"
                                              onClick={() => {
                                                setResizeOpenId(null);
                                                handleResizeDesign(msg.design!, f);
                                              }}
                                              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
                                            >
                                              <span className="flex items-center gap-2">
                                                <F.Icon className="w-3.5 h-3.5 text-gray-500" />
                                                {F.label}
                                              </span>
                                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                                                {t('freeBadge')}
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  <button
                                    onClick={() => handleExportPdf(msg.design!)}
                                    title={t('exportAllPdf')}
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-gray-200 hover:border-amber-400 hover:bg-amber-50/60 text-gray-800 font-semibold text-xs tracking-wide transition-all cursor-pointer"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-gray-600" />
                                    <span>PDF</span>
                                  </button>

                                  <button
                                    onClick={() => handleExportToCanva(msg.design!)}
                                    title={t('openInCanvaTip')}
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-gray-200 hover:border-amber-400 hover:bg-amber-50/60 text-gray-800 font-semibold text-xs tracking-wide transition-all cursor-pointer"
                                  >
                                    {canvaExporting ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                                    ) : (
                                      <PencilRuler className="w-3.5 h-3.5 text-amber-600" />
                                    )}
                                    <span>{t('editOnCanva')}</span>
                                  </button>

                                  <button
                                    onClick={() => handleExportSlide(msg.design!, msg.design!.activeSlideIndex || 0)}
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold text-xs tracking-wide transition-all shadow-sm cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>PNG HD</span>
                                  </button>
                                </div>
                              </div>

                              {/* Le Canvas Visuel Actif avec transition animée des slides */}
                              {(() => {
                                const dFonts = msg.design!.fonts || { title: 'Space Grotesk', body: 'Inter' };
                                const slide = msg.design.slides[msg.design.activeSlideIndex || 0];
                                const isLight = msg.design.style === 'light';
                                return (
                                  <div
                                    className={`my-4 mx-auto w-full transition-all duration-300 ${
                                      FORMATS[msg.design.format].aspect
                                    }`}
                                  >
                                    <AnimatePresence mode="wait">
                                      <motion.div
                                        key={`slide_${msg.id}_${msg.design.activeSlideIndex || 0}`}
                                        initial={{ opacity: 0, y: 8, scale: 0.985 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -8, scale: 0.985 }}
                                        transition={{ duration: 0.22, ease: 'easeOut' }}
                                        className={`w-full h-full rounded-2xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden shadow-lg border ${isLight ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-800'}`}
                                        style={{ fontFamily: `'${dFonts.body}', Poppins, system-ui, sans-serif` }}
                                      >
                                        {/* Background Image texture if present */}
                                        {slide.image && (
                                          <div className="absolute inset-0 z-0 pointer-events-none">
                                            <img
                                              src={slide.image}
                                              alt="Backdrop visual"
                                              className={`w-full h-full object-cover ${slide.heroShot ? '' : isLight ? 'opacity-10 contrast-125' : 'opacity-20 contrast-125'}`}
                                            />
                                            <div className={`absolute inset-0 bg-gradient-to-t ${isLight ? 'from-white via-white/80 to-transparent' : 'from-zinc-950 via-zinc-950/80 to-transparent'}`} />
                                          </div>
                                        )}

                                        {/* Accès direct Canva sur le visuel */}
                                        <button
                                          type="button"
                                          onClick={() => handleExportToCanva(msg.design!)}
                                          title={t('openInCanvaTip')}
                                          className="absolute top-3 end-3 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur border border-gray-200/80 text-[10px] font-bold text-gray-800 shadow-md hover:bg-white transition-colors cursor-pointer"
                                        >
                                          {canvaExporting ? <RefreshCw className="w-3 h-3 animate-spin text-amber-600" /> : <PencilRuler className="w-3 h-3 text-amber-600" />}
                                          {t('editOnCanva')}
                                        </button>

                                        {/* Slide Header (Brand & Counter) */}
                                        <div className="relative z-10 flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <div style={{ background: brandColor }} className="w-6 h-6 rounded-lg flex items-center justify-center text-black font-semibold text-[10px] overflow-hidden">
                                              {brandLogo ? (
                                                <img src={brandLogo} alt="Logo" className="w-full h-full object-contain p-0.5" />
                                              ) : (
                                                brandName.slice(0, 2).toUpperCase()
                                              )}
                                            </div>
                                            <span className={`text-xs font-semibold tracking-wider uppercase ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                              {brandName}
                                            </span>
                                          </div>

                                          <div className="text-[11px]  font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                            {String(slide.slideNumber).padStart(2, '0')} /{' '}
                                            {String(msg.design.slides.length).padStart(2, '0')}
                                          </div>
                                        </div>

                                        {/* Slide Middle Content */}
                                        <div className="relative z-10 my-auto py-4 space-y-3">
                                          <div className="flex items-center gap-2">
                                            <span style={{ backgroundColor: brandColor }} className="w-1.5 h-1.5 rounded-full" />
                                            <span style={{ color: brandColor, fontFamily: `'${dFonts.title}', Poppins, system-ui, sans-serif` }} className="text-[11px] font-bold uppercase tracking-wider">
                                              {slide.tag}
                                            </span>
                                          </div>

                                          {/* Big Hook Headline */}
                                          <h2 style={{ fontFamily: `'${dFonts.title}', Poppins, system-ui, sans-serif` }} className={`text-xl sm:text-2xl font-semibold tracking-tight leading-tight ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                            {slide.highlightWord && slide.title.includes(slide.highlightWord) ? (
                                              <>
                                                {slide.title.split(slide.highlightWord)[0]}
                                                <span style={{ color: brandColor }} className="underline decoration-white/20 underline-offset-4">
                                                  {slide.highlightWord}
                                                </span>
                                                {slide.title.split(slide.highlightWord)[1]}
                                              </>
                                            ) : (
                                              slide.title
                                            )}
                                          </h2>

                                          <p className={`text-xs sm:text-sm leading-relaxed font-normal ${isLight ? 'text-gray-600' : 'text-zinc-300'}`}>
                                            {slide.subtitle}
                                          </p>

                                          {/* Stat Callout if present */}
                                          {slide.stat && (
                                            <div className={`p-3.5 rounded-xl border my-2 ${isLight ? 'bg-amber-50/70 border-amber-500/40' : 'bg-zinc-950/80 border-amber-500/30'}`}>
                                              <div style={{ color: brandColor }} className="text-3xl font-bold">
                                                {slide.stat.value}
                                              </div>
                                              <div className={`text-xs mt-0.5 ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>{slide.stat.label}</div>
                                            </div>
                                          )}

                                          {/* Bullet points if present */}
                                          {slide.bulletPoints && (
                                            <div className="space-y-1.5 pt-1">
                                              {slide.bulletPoints.map((bp, i) => (
                                                <div key={i} className={`flex items-start gap-2 text-xs ${isLight ? 'text-gray-700' : 'text-zinc-200'}`}>
                                                  <div className="w-3.5 h-3.5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                                                    ✓
                                                  </div>
                                                  <span>{bp}</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>

                                        {/* Slide Footer */}
                                        <div className={`relative z-10 pt-3 border-t flex items-center justify-between text-xs ${isLight ? 'border-gray-200' : 'border-zinc-800/80'}`}>
                                          <div className={`flex items-center gap-1 ${isLight ? 'text-gray-400' : 'text-zinc-400'}`}>
                                            <span className={`font-medium ${isLight ? 'text-gray-900' : 'text-white'}`}>{brandHandle}</span>
                                            <CheckCircle2 className="w-3 h-3 text-amber-400 inline" />
                                          </div>

                                          {slide.ctaText && (
                                            <div style={{ fontFamily: `'${dFonts.title}', Poppins, system-ui, sans-serif` }} className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                                              {slide.ctaText}
                                            </div>
                                          )}
                                        </div>
                                      </motion.div>
                                    </AnimatePresence>
                                  </div>
                                );
                              })()}

                              {/* Navigation entre les slides du carrousel */}
                              <div className="flex items-center justify-between pt-2">
                                <button
                                  onClick={() =>
                                    handleSlideChange(msg.id, (msg.design!.activeSlideIndex || 0) - 1)
                                  }
                                  disabled={(msg.design.activeSlideIndex || 0) === 0}
                                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                    (msg.design.activeSlideIndex || 0) === 0
                                      ? 'text-zinc-600 bg-zinc-900/50 cursor-not-allowed'
                                      : 'text-zinc-200 bg-zinc-800 hover:bg-zinc-700 cursor-pointer'
                                  }`}
                                >
                                  <ChevronLeft className="w-3.5 h-3.5" />
                                  <span>{t('prevSlide')}</span>
                                </button>

                                {/* Dots de slides */}
                                <div className="flex items-center gap-1.5">
                                  {msg.design.slides.map((s, idx) => (
                                    <button
                                      key={s.id}
                                      onClick={() => handleSlideChange(msg.id, idx)}
                                      className={`h-2 rounded-full transition-all ${
                                        idx === (msg.design!.activeSlideIndex || 0)
                                          ? 'w-6 bg-amber-400'
                                          : 'w-2 bg-zinc-700 hover:bg-zinc-500'
                                      }`}
                                    />
                                  ))}
                                </div>

                                <button
                                  onClick={() =>
                                    handleSlideChange(msg.id, (msg.design!.activeSlideIndex || 0) + 1)
                                  }
                                  disabled={
                                    (msg.design.activeSlideIndex || 0) === msg.design.slides.length - 1
                                  }
                                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                    (msg.design.activeSlideIndex || 0) === msg.design.slides.length - 1
                                      ? 'text-zinc-600 bg-zinc-900/50 cursor-not-allowed'
                                      : 'text-zinc-200 bg-zinc-800 hover:bg-zinc-700 cursor-pointer'
                                  }`}
                                >
                                  <span>{t('nextSlide')}</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Suggestions d'itérations rapides (Pills) */}
                        {msg.suggestions && msg.suggestions.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {msg.suggestions.map((sug, i) => (
                              <button
                                key={i}
                                onClick={() => handleSuggestion(sug, msg)}
                                className="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 text-xs font-medium transition-colors border border-gray-200/80 cursor-pointer"
                              >
                                {sug}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Feedback icons style Gemini */}
                        {!isUser && (
                          <div className="flex items-center gap-2 mt-3 text-gray-400">
                            <button
                              onClick={() => {
                                setFeedback((f) => ({ ...f, [msg.id]: 'up' }));
                                showToast(t('feedbackThanks'));
                              }}
                              className={`p-1 rounded-full hover:bg-white/80 transition-colors cursor-pointer ${feedback[msg.id] === 'up' ? 'text-orange-600' : 'hover:text-gray-700'}`}
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setFeedback((f) => ({ ...f, [msg.id]: 'down' }));
                                showToast(t('feedbackSaved'));
                              }}
                              className={`p-1 rounded-full hover:bg-white/80 transition-colors cursor-pointer ${feedback[msg.id] === 'down' ? 'text-orange-600' : 'hover:text-gray-700'}`}
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleCopyMessage(msg.text)}
                              className="p-1 rounded-full hover:bg-white/80 hover:text-gray-700 transition-colors cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* État de génération IA en cours avec transition */}
            <AnimatePresence>
              {isGenerating && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-start gap-3.5"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-gray-900">Aura Design AI</p>
                    <div className="flex items-center gap-2.5 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                      <span>{genProgress ? t('slideProgress').replace('{i}', String(genProgress.done + 1)).replace('{n}', String(genProgress.total)) : t('aiThinking')}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ========================================================= */}
        {/* BARRE DE SAISIE (EN BAS, CENTRÉE ET FLOTTANTE STYLE GEMINI) */}
        {/* ========================================================= */}
        <div className={`absolute left-0 right-0 p-4 sm:p-6 pointer-events-none transition-all duration-300 ${messages.length === 0 ? 'top-[46%]' : 'bottom-0 bg-gradient-to-t from-[#fff7ec] via-[#fff7ec]/80 to-transparent'}`}>
          <div className="max-w-3xl mx-auto w-full pointer-events-auto">
            {/* Input file caché pour les photos */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <input
              ref={tplInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addTemplateFiles(e.target.files);
                e.target.value = '';
              }}
            />

            <div className="relative">
            {/* Chips des options ponctuelles (commandes « / ») */}
            {(pendingStyle || pendingProjectId) && (
              <div className="flex flex-wrap items-center gap-1.5 mb-2 px-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('appliedToSend')} :</span>
                {pendingProjectId &&
                  (() => {
                    const pk = projects.find((x) => x.id === pendingProjectId);
                    return (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border text-[10px] font-bold text-gray-800 shadow-2xs"
                        style={{ borderColor: `${pk?.color || '#F59E0B'}66` }}
                      >
                        <span className="w-3.5 h-3.5 rounded flex items-center justify-center text-white text-[8px] font-bold" style={{ backgroundColor: pk?.color }}>
                          {pk ? pname(pk.name).slice(0, 1).toUpperCase() : '?'}
                        </span>
                        {pk ? pname(pk.name) : ''}
                        <button type="button" onClick={() => setPendingProjectId(null)} className="text-gray-300 hover:text-gray-600 cursor-pointer">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })()}
                {pendingStyle && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 text-white border border-zinc-700 text-[10px] font-bold shadow-2xs">
                    {pendingStyle === 'dark' ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                    {pendingStyle === 'dark' ? t('styleDark') : t('styleLight')}
                    <button type="button" onClick={() => setPendingStyle(null)} className="text-zinc-500 hover:text-white cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* Popup des commandes slash (compacte, uniquement en début de champ) */}
            {slashItems.length > 0 && slashQuery !== null && (
              <div className="absolute start-0 bottom-full mb-3 w-64 max-w-[85vw] rounded-2xl bg-white border border-gray-200 shadow-xl p-1.5 z-30 space-y-0.5 max-h-64 overflow-y-auto">
                <div className="px-2.5 pt-1 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  {t('commands')}
                </div>

                {slashStyleItems.map((it) => {
                  const flatIdx = slashItems.indexOf(it);
                  return (
                    <button
                      key={`ss_${it.cmd}`}
                      type="button"
                      onMouseEnter={() => setSlashIndex(flatIdx)}
                      onClick={() => acceptSlash(it)}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                        flatIdx === slashIndex ? 'bg-amber-50 text-amber-900 font-bold' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                          {it.style === 'dark' ? <Moon className="w-3 h-3 text-gray-500" /> : <Sun className="w-3 h-3 text-gray-500" />}
                        </span>
                        <span className="truncate">{it.style === 'dark' ? t('styleDark') : t('styleLight')}</span>
                      </span>
                      <span className="text-[9px] font-semibold text-gray-400 shrink-0">{t('styleGrp')}</span>
                    </button>
                  );
                })}

                {slashChipItems.map((it) => {
                  const flatIdx = slashItems.indexOf(it);
                  const already = pendingChips.includes(it.cmd);
                  return (
                    <button
                      key={`sc_${it.cmd}`}
                      type="button"
                      onMouseEnter={() => setSlashIndex(flatIdx)}
                      onClick={() => acceptSlash(it)}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                        flatIdx === slashIndex ? 'bg-amber-50 text-amber-900 font-bold' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <ChipBadge cmd={it.cmd} label={it.label} lang={lang} />
                        <span className="truncate">{it.label[lang]}</span>
                      </span>
                      {already ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <span className="text-[9px] font-semibold text-gray-400 shrink-0">{t('ambianceGrp')}</span>
                      )}
                    </button>
                  );
                })}

                {slashProjectItems.map((it) => {
                  const flatIdx = slashItems.indexOf(it);
                  const pk = projects.find((x) => x.id === it.id);
                  return (
                    <button
                      key={`sp_${it.id}`}
                      type="button"
                      onMouseEnter={() => setSlashIndex(flatIdx)}
                      onClick={() => acceptSlash(it)}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                        flatIdx === slashIndex ? 'bg-amber-50 text-amber-900 font-bold' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 overflow-hidden text-[9px] font-bold text-white"
                          style={{ backgroundColor: pk?.color }}
                        >
                          {pk?.logo ? <img src={pk.logo} alt="" className="w-full h-full object-contain p-0.5" /> : it.label.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="truncate">{it.label}</span>
                      </span>
                      <span className="text-[9px] font-semibold text-gray-400 shrink-0">{t('spacesGrp')}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Conteneur flottant avec grand rayon de bordure */}
            <div className={`relative flex flex-col backdrop-blur-md rounded-[28px] px-3 py-2.5 border shadow-md transition-all ${composerHighlight ? 'bg-white border-amber-400 ring-4 ring-amber-300/40 shadow-lg' : 'bg-white/90 border-orange-200/60 focus-within:shadow-lg focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-400/20'}`}>
              {/* Preview des photos attachées */}
              {attachedImages.length > 0 && (
                <div className="flex items-center gap-2 px-2 pt-1 pb-2 border-b border-gray-200/70 mb-1 overflow-x-auto">
                  {attachedImages.map((img, idx) => (
                    <div
                      key={idx}
                      className="relative group w-12 h-12 rounded-xl overflow-hidden border border-gray-200 shadow-2xs shrink-0 bg-white"
                    >
                      <img src={img} alt={`Attached ${idx}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setAttachedImages((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-gray-900/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] transition-colors cursor-pointer"
                        title={t('removePhoto')}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="h-12 px-3 rounded-xl border border-dashed border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50 text-gray-600 text-xs font-medium flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('addPhotoShort')}</span>
                  </button>
                </div>
              )}

              <div className="flex items-center w-full">
                {/* Bouton "+" : menu photo / ambiances */}
                <div className="relative shrink-0" ref={attachRef}>
                  <button
                    type="button"
                    onClick={() => setAttachMenuOpen((v) => !v)}
                    title={t('addPhotoOrVibe')}
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${attachMenuOpen ? 'bg-gray-900 text-white' : 'hover:bg-gray-200/80 text-gray-600 hover:text-gray-900'}`}
                  >
                    <Plus className={`w-5 h-5 stroke-[2] transition-transform ${attachMenuOpen ? 'rotate-45' : ''}`} />
                  </button>

                  {attachMenuOpen && (
                    <div className="absolute start-0 bottom-12 w-60 rounded-2xl bg-white border border-gray-200 shadow-xl p-1.5 z-30 space-y-0.5">
                      <div className="px-2.5 pt-1 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {t('addToDesign')}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachMenuOpen(false);
                          photoInputRef.current?.click();
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
                      >
                        <span className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <ImageIcon className="w-3.5 h-3.5 text-gray-500" />
                        </span>
                        {t('uploadPhoto')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachMenuOpen(false);
                          tplInputRef.current?.click();
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
                      >
                        <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center shrink-0">
                          <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                        </span>
                        {t('addTemplates')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachMenuOpen(false);
                          if (pendingChips.length >= 3) {
                            showToast(t('maxChips'));
                            return;
                          }
                          setChipSwapIndex(pendingChips.length);
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
                      >
                        <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center shrink-0">
                          <Wand2 className="w-3.5 h-3.5 text-amber-600" />
                        </span>
                        {t('addAmbiance')}
                      </button>
                      <div className="my-1 border-t border-gray-100" />
                      <p className="px-2.5 pb-1 text-[10px] text-gray-400 leading-relaxed">
                        {t('slashTip')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Champ de texte */}
                <textarea
                  ref={composerInputRef}
                  rows={1}
                  value={inputPrompt}
                  onChange={(e) => {
                    setInputPrompt(e.target.value);
                    autoResizeComposer(e.target);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={t('placeholder')}
                  className="flex-1 bg-transparent px-3 py-1.5 text-sm sm:text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none resize-none leading-relaxed overflow-y-auto"
                  style={{ maxHeight: '160px' }}
                />

                {/* À droite : Sélecteur déroulant de format, Nombre de slides & bouton d'envoi */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Dropdown sélecteur de format */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsFormatDropdownOpen(!isFormatDropdownOpen)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-gray-100 text-gray-700 text-xs font-semibold border border-gray-200/90 shadow-2xs transition-colors cursor-pointer"
                    >
                      {currentFormatObj.icon}
                      <span className="hidden md:inline">{currentFormatObj.label}</span>
                      <span className="md:hidden">
                        {FORMATS[selectedFormat].short}
                      </span>
                      <ChevronDown className="w-3 h-3 text-gray-400" />
                    </button>

                    {/* Menu déroulant format */}
                    {isFormatDropdownOpen && (
                      <div className="absolute end-0 bottom-12 w-60 rounded-2xl bg-white border border-gray-200 shadow-xl p-1.5 z-30 space-y-1">
                        <div className="px-2.5 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                          {t('designFormat')}
                        </div>
                        {formatOptions.map((fmt) => (
                          <button
                            key={fmt.id}
                            type="button"
                            onClick={() => {
                              setSelectedFormat(fmt.id);
                              setIsFormatDropdownOpen(false);
                              showToast(`${t('formatSet')} ${fmt.label}`);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                              selectedFormat === fmt.id
                                ? 'bg-amber-50 text-amber-800 font-bold'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {fmt.icon}
                              <span>{fmt.label}</span>
                            </div>
                            {selectedFormat === fmt.id && <Check className="w-3.5 h-3.5 text-amber-600" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bouton du nombre de slides affiché uniquement quand Carrousel est sélectionné */}
                  {FORMATS[selectedFormat].kind === 'carousel' && (
                    <div className="relative" ref={slidesCountDropdownRef}>
                      <button
                      type="button"
                      onClick={() => setTemplatesOpen(true)}
                      title={t('templatesTitle')}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-[11px] font-semibold text-gray-700 transition-colors cursor-pointer shrink-0"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                      <span className="hidden md:inline">{t('templates')}</span>
                      <span dir="ltr" className="text-[9px] font-bold text-amber-700 bg-amber-100/80 px-1 py-0.5 rounded-full">{templates.length}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsSlidesDropdownOpen(!isSlidesDropdownOpen)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100/90 text-amber-900 border border-amber-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                        title={t('carouselTip')}
                      >
                        <Layers className="w-3.5 h-3.5 text-amber-700" />
                        <span>{carouselSlidesCount} slides</span>
                        <ChevronDown className="w-3 h-3 text-amber-700" />
                      </button>

                      {isSlidesDropdownOpen && (
                        <div className="absolute end-0 bottom-12 w-36 rounded-2xl bg-white border border-gray-200 shadow-xl p-1.5 z-30 space-y-1">
                          <div className="px-2.5 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            {t('slidesCount')}
                          </div>
                          {[3, 4, 5, 6, 7, 8, 10].map((count) => (
                            <button
                              key={count}
                              type="button"
                              onClick={() => {
                                setCarouselSlidesCount(count);
                                setIsSlidesDropdownOpen(false);
                                showToast(t('carouselSet').replace('{n}', String(count)));
                              }}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                                carouselSlidesCount === count
                                  ? 'bg-amber-100 text-amber-900 font-bold'
                                  : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              <span>{count} slides</span>
                              {carouselSlidesCount === count && (
                                <Check className="w-3.5 h-3.5 text-amber-700" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bouton d'envoi circulaire style Gemini */}
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={(!inputPrompt.trim() && attachedImages.length === 0) || isGenerating}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                      (inputPrompt.trim() || attachedImages.length > 0) && !isGenerating
                        ? 'bg-gray-900 hover:bg-black text-white shadow-xs cursor-pointer'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>

              {/* Chips d'ambiance cliquables (remplaçables) */}
              {pendingChips.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-1.5 pb-1">
                  {pendingChips.map((cmd, idx) => {
                    const chip = STYLE_CHIPS.find((c) => c.cmd === cmd);
                    return (
                      <span
                        key={cmd}
                        className="group/chip inline-flex items-center gap-1.5 pl-1.5 pr-1.5 py-1 rounded-full bg-white border border-amber-300/70 text-[11px] font-bold text-amber-900 shadow-2xs cursor-pointer hover:border-amber-400 transition-colors"
                        onClick={() => setChipSwapIndex(idx)}
                        title={t('chooseAmbiance')}
                      >
                        {chip && <ChipBadge cmd={chip.cmd} label={chip.label} lang={lang} />}
                        {chip?.label[lang]}
                        <ChevronDown className="w-3 h-3 text-amber-500" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingChips((prev) => prev.filter((c) => c !== cmd));
                            showToast(t('ambianceRemoved'));
                          }}
                          className="text-amber-400 hover:text-amber-700 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                  {pendingChips.length < 3 && (
                    <button
                      type="button"
                      onClick={() => setChipSwapIndex(pendingChips.length)}
                      className="inline-flex items-center gap-1 pl-2 pr-2.5 py-1 rounded-full border border-dashed border-amber-400/70 text-[11px] font-bold text-amber-700 hover:bg-amber-50 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      {t('addAmbiance')}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Popup de sélection / remplacement d'ambiance */}
            {chipSwapIndex !== null && (
              <div className="absolute start-0 bottom-full mb-3 w-72 max-w-[85vw] rounded-2xl bg-white border border-gray-200 shadow-xl p-1.5 z-30 max-h-80 overflow-y-auto">
                <div className="px-2.5 pt-1 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                  <span>{t('chooseAmbiance')}</span>
                  <button type="button" onClick={() => setChipSwapIndex(null)} className="text-gray-300 hover:text-gray-600 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {STYLE_CHIPS.map((c) => {
                  const currentIdx = chipSwapIndex < pendingChips.length ? pendingChips[chipSwapIndex] : null;
                  const isCurrent = currentIdx === c.cmd;
                  return (
                    <button
                      key={`swap_${c.cmd}`}
                      type="button"
                      onClick={() => {
                        setPendingChips((prev) => {
                          if (chipSwapIndex >= prev.length) return prev.length < 3 ? [...prev, c.cmd] : prev;
                          const next = [...prev];
                          if (next.includes(c.cmd)) return next;
                          next[chipSwapIndex] = c.cmd;
                          return next;
                        });
                        setChipSwapIndex(null);
                        showToast(`${t('ambianceReplaced')} : ${c.label[lang]}`);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                        isCurrent ? 'bg-amber-50 text-amber-900 font-bold' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <ChipBadge cmd={c.cmd} label={c.label} lang={lang} />
                        <span className="min-w-0">
                          <span className="block truncate leading-tight">{c.label[lang]}</span>
                          <span className="block truncate text-[9px] font-normal text-gray-400 leading-tight">{c.desc[lang]}</span>
                        </span>
                      </span>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                    </button>
                  );
                })}
                {chipSwapIndex < pendingChips.length && (
                  <>
                    <div className="my-1 border-t border-gray-100" />
                    <button
                      type="button"
                      onClick={() => {
                        setPendingChips((prev) => prev.filter((_, i) => i !== chipSwapIndex));
                        setChipSwapIndex(null);
                        showToast(t('ambianceRemoved'));
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t('remove')}
                    </button>
                  </>
                )}
              </div>
            )}

            </div>

            {/* Barre d'outils sous le box (hors du conteneur blanc) */}
            <div className="flex items-center justify-between gap-2 px-1.5 pt-2">
                <div className="relative" ref={composerModelRef}>
                  <button
                    type="button"
                    onClick={() => setIsComposerModelOpen((v) => !v)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100/90 text-amber-900 text-[11px] font-bold border border-amber-200/80 transition-colors cursor-pointer"
                    title={t('modelTip')}
                  >
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>{activeModel.name}</span>
                    <span dir="ltr" className="text-[9px] font-bold text-amber-700 bg-white/80 px-1 py-0.5 rounded-full">{activeModel.points} pts</span>
                    <ChevronDown className={`w-2.5 h-2.5 text-amber-600 transition-transform ${isComposerModelOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isComposerModelOpen && (
                    <div className="absolute start-0 bottom-10 w-60 rounded-2xl bg-white border border-gray-200 shadow-xl p-1.5 z-30 space-y-0.5">
                      <div className="px-2.5 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        {t('modelHeader')}
                      </div>
                      {MODELS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setActiveModelId(m.id);
                            setIsComposerModelOpen(false);
                            showToast(t('modelSet').replace('{m}', m.name).replace('{p}', String(m.points)));
                          }}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                            activeModelId === m.id ? 'bg-amber-50 text-amber-900 font-bold' : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            {m.name}
                            {m.badge && (
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                {m.badge}
                              </span>
                            )}
                          </span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-100/80 px-1.5 py-0.5 rounded-full">{m.points} pts</span>
                            {activeModelId === m.id && <Check className="w-3.5 h-3.5 text-amber-600" />}
                          </span>
                        </button>
                      ))}
                      <div className="my-1 border-t border-gray-100" />
                      <button
                        type="button"
                        onClick={() => {
                          setIsComposerModelOpen(false);
                          navigate('/pricing');
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold text-amber-700 hover:bg-amber-50 cursor-pointer transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Zap className="w-3.5 h-3.5" />
                          {t('seePacks')}
                        </span>
                        <span className="text-[10px] font-bold text-gray-500">{credits} pts</span>
                      </button>
                    </div>
                  )}
                </div>
                <span className="hidden sm:flex items-center gap-1.5 text-[10px] text-gray-400 min-w-0">
                  <Lightbulb className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">{activeModel.desc[lang]}</span>
                </span>
                {credits < 5 && (
                  <button
                    type="button"
                    onClick={() => navigate('/pricing')}
                    className="flex items-center gap-1 text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full cursor-pointer transition-colors shrink-0"
                  >
                    <Zap className="w-3 h-3" />
                    {t('lowBalance')}
                  </button>
                )}
            </div>

            {messages.length === 0 ? (
              <>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {welcomeSuggestions.map((card, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => prefillComposer(card.prompt)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/85 hover:bg-white border border-orange-200/60 text-sm text-gray-700 hover:text-gray-900 shadow-2xs transition-all cursor-pointer"
                  >
                    {card.icon}
                    <span>{card.title}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setTemplatesOpen(true)}
                className="mt-4 mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/90 to-orange-50/70 px-4 py-3 text-start shadow-sm hover:shadow-md hover:border-amber-300 transition-all cursor-pointer"
              >
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shrink-0">
                  <Sparkles className="w-4.5 h-4.5 w-[18px] h-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-gray-900">{t('developMe')}</span>
                  <span className="block text-[11px] text-gray-500 leading-snug">{t('developMeSub')}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-amber-500 shrink-0 rtl:rotate-180" />
              </button>
              </>
            ) : (
              <p className="text-[11px] text-gray-400 text-center mt-2 font-normal">{t('aiRemark')}</p>
            )}
          </div>
        </div>
      </main>

      {/* ===== MODALS COMPTE ===== */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-2xs p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-base">
                  {modal === 'settings' ? t('settings') : modal === 'help' ? t('help') : t('learnMore')}
                </h3>
                <button onClick={() => setModal(null)} className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {modal === 'settings' && (
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1.5">{t('firstName')}</label>
                    <input
                      type="text"
                      value={userFirstName}
                      onChange={(e) => {
                        setUserFirstName(e.target.value);
                        try {
                          localStorage.setItem('aura_user_firstname', e.target.value);
                        } catch {}
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1.5">{t('language')}</label>
                    <div className="flex gap-2">
                      {LANGS.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setLang(l.id)}
                          className={`flex-1 px-3 py-2 rounded-xl text-sm border transition-colors cursor-pointer ${
                            lang === l.id ? 'bg-orange-50 border-orange-300 text-orange-800 font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setModal(null);
                        navigate('/brand');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 cursor-pointer transition-colors"
                    >
                      <Palette className="w-4 h-4 text-orange-500" />
                      {t('brandKit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModal(null);
                        setCanvaModalOpen(true);
                      }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <PencilRuler className="w-4 h-4 text-amber-500" />
                        {t('canvaAccount')}
                      </span>
                      {canvaConnected ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">{t('connectedBadge')}</span>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-400">{t('notConnectedBadge')}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isSupabaseConfigured) {
                          for (const rs of recentSessions) void deleteRemoteSession(rs.id).catch(() => {});
                        }
                        setRecentSessions([]);
                        setSessionMessagesMap({});
                        setMessages([]);
                        setActiveSessionId(`sess_${Date.now()}`);
                        setModal(null);
                        showToast(t('historyCleared'));
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-red-100 hover:bg-red-50 text-sm text-red-600 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t('clearHistory')}
                    </button>
                  </div>
                </div>
              )}

              {modal === 'help' && (
                <div className="space-y-2">
                  {FAQ_BY_LANG[lang].map((f, i) => (
                    <div key={i} className="rounded-2xl border border-gray-200 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-gray-900 text-start cursor-pointer hover:bg-gray-50"
                      >
                        {f.q}
                        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${faqOpen === i ? 'rotate-180' : ''}`} />
                      </button>
                      {faqOpen === i && <p className="px-4 pb-3 text-sm text-gray-600 leading-relaxed">{f.a}</p>}
                    </div>
                  ))}
                </div>
              )}

              {modal === 'about' && (
                <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
                  <p>
                    <span className="font-semibold text-gray-900">Aura Design</span> {t('aboutP1')}
                  </p>
                  <p>{t('aboutP2')}</p>
                  <p className="text-xs text-gray-400">{t('version')}</p>
                </div>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL CONNEXION CANVA */}
      {/* ========================================================= */}
      <AnimatePresence>
        {/* MODAL BIBLIOTHÈQUE DE MODÈLES */}
      <AnimatePresence>
        {templatesOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => e.target === e.currentTarget && setTemplatesOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-2xs p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-amber-500" />
                  <h3 className="font-semibold text-gray-900 text-base">{t('templatesTitle')}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span dir="ltr" className="text-[10px] font-bold text-gray-400">{templates.length}/24</span>
                  <button onClick={() => setTemplatesOpen(false)} className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">{t('productTypeLabel')}</label>
                  <input
                    type="text"
                    value={brandProfile.productType}
                    onChange={(e) => setBrandProfile((pf) => ({ ...pf, productType: e.target.value.slice(0, 120) }))}
                    placeholder={t('productTypePh')}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">{t('themeLabel')}</label>
                  <input
                    type="text"
                    value={brandProfile.theme}
                    onChange={(e) => setBrandProfile((pf) => ({ ...pf, theme: e.target.value.slice(0, 120) }))}
                    placeholder={t('themePh')}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <p className="text-[10px] text-emerald-600 font-semibold -mt-1">{t('savedAuto')}</p>
              </div>

              <button
                type="button"
                onClick={() => setUseTpl((v) => !v)}
                className="w-full flex items-center justify-between gap-3 rounded-2xl border border-gray-200 px-3.5 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <span className="text-xs font-semibold text-gray-800 text-start">{t('useTplToggle')}</span>
                <span className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 ${useTpl ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gray-300'}`}>
                  <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${useTpl ? 'translate-x-4 rtl:-translate-x-4' : ''}`} />
                </span>
              </button>
              <p className="text-[11px] text-gray-400 leading-relaxed">{t('tplHint')}</p>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                {templates.map((tp) => (
                  <div key={tp.id} className="group relative rounded-xl overflow-hidden border border-gray-200 aspect-square">
                    <img src={tp.data} alt={tp.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      title={t('removeTpl')}
                      onClick={() => setTemplates((prev) => prev.filter((x) => x.id !== tp.id))}
                      className="absolute top-1 end-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {templates.length === 0 && <p className="col-span-full text-[11px] text-gray-400 text-center py-6">{t('tplEmpty')}</p>}
                <button
                  type="button"
                  onClick={() => tplInputRef.current?.click()}
                  className="rounded-xl border border-dashed border-amber-400/70 bg-amber-50/40 hover:bg-amber-50 aspect-square flex flex-col items-center justify-center gap-1 text-[10px] font-bold text-amber-800 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {t('addTemplates')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {canvaModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onMouseDown={(e) => e.target === e.currentTarget && setCanvaModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-2xs p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-md p-6 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <PencilRuler className="w-5 h-5 text-amber-500" />
                  <h3 className="font-semibold text-gray-900 text-base">{t('canvaTitle')}</h3>
                </div>
                <button onClick={() => setCanvaModalOpen(false)} className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
                <p>
                  {t('canvaIntroA')} <span className="font-semibold text-gray-900">{t('canvaIntroB')}</span> {t('canvaIntroC')}
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-500 bg-gray-50 rounded-2xl p-3.5">
                  <li>{t('canvaStep1')} <span className="font-semibold text-gray-700">canva.dev</span> (Canva Connect API).</li>
                  <li>{t('canvaStep2')}</li>
                  <li>{t('canvaStep3')} <span className="font-semibold text-gray-700">{t('canvaStep3B')}</span>.</li>
                </ol>
                {canvaConnected && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                    <CheckCircle2 className="w-4 h-4" />
                    {t('canvaOk')}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">{t('canvaTokenLabel')}</label>
                <input
                  type="password"
                  value={canvaTokenInput}
                  onChange={(e) => setCanvaTokenInput(e.target.value)}
                  placeholder={t('canvaTokenPh')}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-1 flex justify-between gap-2">
                {canvaConnected ? (
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        localStorage.removeItem('aura_canva_token');
                      } catch {}
                      setCanvaConnected(false);
                      showToast(t('canvaDisconnected'));
                    }}
                    className="px-4 py-2 rounded-full text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    {t('disconnect')}
                  </button>
                ) : <span />}
                <button
                  type="button"
                  onClick={handleCanvaConnect}
                  className="px-4 py-2 rounded-full bg-gray-900 hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  {canvaConnected ? t('updateToken') : t('connectCanva')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL PARRAINAGE */}
      {/* ========================================================= */}
      <AnimatePresence>
        {referralOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onMouseDown={(e) => e.target === e.currentTarget && setReferralOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-2xs p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-md p-6 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-orange-500" />
                  <h3 className="font-semibold text-gray-900 text-base">{t('referTitle')}</h3>
                </div>
                <button onClick={() => setReferralOpen(false)} className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { n: '1', txt: t('refStep1') },
                  { n: '2', txt: t('refStep2') },
                  { n: '3', txt: t('refStep3') },
                ].map((st) => (
                  <div key={st.n} className="rounded-2xl border border-gray-200 bg-gray-50 p-2.5 space-y-1">
                    <div className="w-6 h-6 mx-auto rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {st.n}
                    </div>
                    <p className="text-[10px] font-semibold text-gray-600 leading-tight">{st.txt}</p>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">{t('yourCode')}</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2 text-sm font-bold tracking-wider text-amber-800 text-center">
                    {getReferralCode()}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyText(`https://${window.location.host}/?ref=${getReferralCode()}`);
                      showToast(ok ? t('linkCopied') : t('copyFail'));
                    }}
                    className="px-3.5 py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    {t('copyLink')}
                  </button>
                </div>
              </div>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `${t('waText')} https://${window.location.host}/?ref=${getReferralCode()}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <Gift className="w-3.5 h-3.5" />
                {t('shareWa')}
              </a>

              <p className="text-[10px] text-gray-400 text-center leading-relaxed">{t('referNote')}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* TOAST NOTIFICATION FLOTTANT */}
      {/* ========================================================= */}
      {toastEl}
    </div>
  );
}
