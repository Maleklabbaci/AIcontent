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
  Gift,
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
}

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
  fr: { newDesign: 'Nouveau design', search: 'Recherche', brandKit: 'Brand Kit', templates: 'Templates', recents: 'Récents', greeting: 'Bonjour', subtitle: "On travaille sur quoi aujourd'hui ?", placeholder: "Décrivez le design à créer...", share: 'Partager', settings: 'Paramètres', language: 'Langue', help: "Obtenir de l'aide", learnMore: 'En savoir plus', upgrade: 'Tarifs & Packs', logout: 'Se déconnecter', plan: 'Pack' },
  en: { newDesign: 'New design', search: 'Search', brandKit: 'Brand Kit', templates: 'Templates', recents: 'Recents', greeting: 'Hello', subtitle: 'What are we working on today?', placeholder: 'Describe the design to create...', share: 'Share', settings: 'Settings', language: 'Language', help: 'Get help', learnMore: 'Learn more', upgrade: 'Pricing & Packs', logout: 'Log out', plan: 'Pack' },
  ar: { newDesign: 'تصميم جديد', search: 'بحث', brandKit: 'هوية العلامة', templates: 'قوالب', recents: 'الأخيرة', greeting: 'مرحباً', subtitle: 'على ماذا سنعمل اليوم؟', placeholder: 'صف التصميم المطلوب...', share: 'مشاركة', settings: 'الإعدادات', language: 'اللغة', help: 'احصل على مساعدة', learnMore: 'اعرف المزيد', upgrade: 'ترقية الباقة', logout: 'تسجيل الخروج', plan: 'الباقة' },
};
const LANGS: { id: Lang; label: string }[] = [
  { id: 'fr', label: 'Français' },
  { id: 'en', label: 'English' },
  { id: 'ar', label: 'العربية' },
];
const FAQ: { q: string; a: string }[] = [
  { q: 'Quels types de designs puis-je créer ?', a: 'Posts et stories pour les réseaux sociaux, carrousels, sites web, fiches produit, affiches et présentations. Choisissez le format dans la barre de saisie.' },
  { q: 'Comment exporter mon design ?', a: 'Dans le Canvas, cliquez sur « PNG HD » pour télécharger le slide affiché, ou utilisez la suggestion « Télécharger les slides en PNG » pour tout exporter.' },
  { q: 'Comment appliquer ma marque ?', a: 'Ouvrez Brand Kit : logo, nom, identifiant et couleur d\'accentuation sont appliqués à tous vos designs.' },
  { q: 'Raccourcis utiles', a: 'Entrée pour envoyer, Échap pour fermer une fenêtre ou un menu.' },
];

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
  opts?: { watermark?: boolean; mime?: 'image/png' | 'image/jpeg' }
): Promise<Blob | null> {
  const { w, h } = FORMATS[format];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  try {
    await Promise.all([
      document.fonts.load('400 30px Poppins'),
      document.fonts.load('600 30px Poppins'),
      document.fonts.load('700 30px Poppins'),
    ]);
  } catch {}
  const F = (weight: number, size: number) => `${weight} ${size}px Poppins, system-ui, sans-serif`;

  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, w, h);

  if (slide.image) {
    const img = await loadImage(slide.image);
    if (img) {
      const r = Math.max(w / img.width, h / img.height);
      ctx.globalAlpha = 0.22;
      ctx.drawImage(img, (w - img.width * r) / 2, (h - img.height * r) / 2, img.width * r, img.height * r);
      ctx.globalAlpha = 1;
    }
  }
  const grad = ctx.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0, 'rgba(9,9,11,0.95)');
  grad.addColorStop(0.6, 'rgba(9,9,11,0.7)');
  grad.addColorStop(1, 'rgba(9,9,11,0.1)');
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
  ctx.fillStyle = '#fff';
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
  ctx.font = F(600, 26);
  ctx.fillText(slide.tag.toUpperCase(), pad, y);
  y += 90;

  ctx.font = F(700, big);
  ctx.fillStyle = '#fff';
  for (const line of wrapLines(ctx, slide.title, maxW)) {
    ctx.fillText(line, pad, y);
    y += big * 1.18;
  }
  y += 20;

  ctx.font = F(400, 36);
  ctx.fillStyle = '#d4d4d8';
  for (const line of wrapLines(ctx, slide.subtitle, maxW)) {
    ctx.fillText(line, pad, y);
    y += 54;
  }
  y += 24;

  if (slide.stat) {
    ctx.font = F(700, 120);
    ctx.fillStyle = brand.color;
    ctx.fillText(slide.stat.value, pad, y + 100);
    y += 150;
    ctx.font = F(400, 30);
    ctx.fillStyle = '#a1a1aa';
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
      ctx.fillStyle = '#e4e4e7';
      for (const line of wrapLines(ctx, bp, maxW - 60)) {
        ctx.fillText(line, pad + 50, y);
        y += 50;
      }
      y += 12;
    }
  }

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(pad, h - 150, w - pad * 2, 2);
  ctx.fillStyle = '#fff';
  ctx.font = F(600, 28);
  ctx.textAlign = 'left';
  ctx.fillText(brand.handle, pad, h - 90);
  if (slide.ctaText) {
    ctx.textAlign = 'right';
    ctx.fillStyle = brand.color;
    ctx.font = F(600, 24);
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
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.roundRect(px0, py0, pw, ph, 25);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(px0 + 30, py0 + ph / 2, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
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
const MODELS: { id: ModelId; name: string; points: number; desc: string; badge?: string }[] = [
  { id: 'flash', name: 'Aura Flash', points: 5, desc: 'Rapide et économique — parfait pour les petits visuels et posts quotidiens.', badge: 'ÉCO' },
  { id: 'studio', name: 'Aura Studio', points: 10, desc: 'HD équilibré — le juste milieu qualité / points pour vos contenus réguliers.' },
  { id: 'pro', name: 'Aura Pro Max', points: 20, desc: 'Qualité maximale — réservé aux projets et campagnes importants.', badge: 'MAX QUALITÉ' },
];
const MODEL_POINTS: Record<ModelId, number> = { flash: 5, studio: 10, pro: 20 };

// ---------- PACKS COMMERCIAUX (Option A) ----------
// 1 image générée = 5 pts (Flash) / 10 pts (Studio) / 20 pts (Pro Max)
const PRICING: {
  id: PlanId | 'business';
  name: string;
  price?: string;
  period?: string;
  points?: string;
  tagline: string;
  features: string[];
  cta: string;
  highlight?: boolean;
  ribbon?: string;
}[] = [
  {
    id: 'free',
    name: 'Gratuit',
    price: '0 DA',
    period: 'pour toujours',
    points: '20 points offerts',
    tagline: 'Pour découvrir la magie',
    features: ['20 points de bienvenue', 'Aura Flash inclus (5 pts/image)', 'Export PNG HD', '1 Brand Kit', 'Export multi-calques Canva'],
    cta: 'Commencer gratuitement',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '1 900 DA',
    period: '/ mois',
    points: '150 points / mois',
    tagline: 'Pour les créateurs & indépendants',
    features: [
      '150 points chaque mois',
      'Les 3 modèles : Flash · Studio · Pro Max',
      'Carrousels multi-slides',
      'Export PNG HD illimité',
      'Brand Kit complet (logo, couleurs)',
      'Envoi direct vers Canva',
    ],
    cta: 'Choisir Starter',
    highlight: true,
    ribbon: 'LE PLUS POPULAIRE',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '4 900 DA',
    period: '/ mois',
    points: '450 points / mois',
    tagline: 'Pour les marques en croissance',
    features: [
      '450 points chaque mois',
      'Les 3 modèles : Flash · Studio · Pro Max',
      'Carrousels multi-slides illimités',
      'Export PNG HD illimité',
      '3 Brand Kits multiples',
      'Envoi direct vers Canva',
      'Support prioritaire',
    ],
    cta: 'Choisir Pro',
  },
  {
    id: 'business',
    name: 'Business & Agences',
    price: 'Sur devis',
    period: 'tarification négociée',
    points: 'Points sur mesure',
    tagline: 'Volume élevé, équipe & revente',
    features: [
      'Volume de points personnalisé',
      'Tarifs dégressifs par volume',
      'Espace multi-équipes',
      'Droits commerciaux (revendeur)',
      'Onboarding & support dédié',
    ],
    cta: 'Contacter l\'équipe',
  },
];

// Remarques de consommation affichées sur la page tarifs
const PRICING_TIPS: { icon: 'lightbulb' | 'rocket'; tone: 'eco' | 'pro'; title: string; text: string }[] = [
  {
    icon: 'lightbulb',
    tone: 'eco',
    title: "Petits visuels, posts quotidiens, stories simples ?",
    text: "Économisez vos points avec Aura Flash (5 pts) — rapide, léger et parfait pour les contenus du quotidien.",
  },
  {
    icon: 'rocket',
    tone: 'pro',
    title: 'Lancement produit, campagne majeure, visuel premium ?',
    text: "Utilisez Aura Pro Max (20 pts) : la qualité maximale pour vos projets les plus importants. Aura Studio (10 pts) reste le juste milieu HD.",
  },
];

// ============================================================
// PAGE /pricing — design d'origine (grille de packs) dans une page dédiée
// ============================================================
function PricingPage({
  currentPlan,
  credits,
  onChoose,
  onBack,
}: {
  currentPlan: PlanId;
  credits: number;
  onChoose: (packId: PlanId) => void;
  onBack: () => void;
}) {
  return (
    <div className="relative h-screen w-screen overflow-hidden font-sans text-gray-900 antialiased">
      <div className="aurora" aria-hidden="true">
        <span className="blob blob-a" />
        <span className="blob blob-b" />
        <span className="blob blob-c" />
        <span className="blob blob-d" />
      </div>

      <div className="relative z-10 h-full overflow-y-auto">
        {/* --- Barre du haut --- */}
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
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200/80 text-xs font-bold text-gray-800">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                {credits} points
              </span>
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gray-900 hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Retour à l'atelier
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-10 space-y-6">
          {/* --- En-tête Hero (comme à l'origine) --- */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 via-orange-50/70 to-white px-6 sm:px-10 pt-10 pb-8 border border-orange-100 shadow-sm mt-6">
            <div className="aurora opacity-40" aria-hidden="true">
              <span className="blob blob-a" />
              <span className="blob blob-b" />
            </div>
            <div className="relative z-10 text-center space-y-3 max-w-2xl mx-auto">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-amber-200/70 text-[11px] font-bold text-amber-700 shadow-xs">
                <Zap className="w-3 h-3" />
                TARIFS & PACKS
              </span>
              <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight">
                Choisissez votre <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">pack</span>, générez en liberté
              </h2>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200/80 shadow-xs text-xs font-semibold text-gray-700">
                  Aura Flash
                  <span className="font-bold text-amber-600 bg-amber-100/80 px-1.5 py-0.5 rounded-full">5 pts</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200/80 shadow-xs text-xs font-semibold text-gray-700">
                  Aura Studio
                  <span className="font-bold text-amber-600 bg-amber-100/80 px-1.5 py-0.5 rounded-full">10 pts</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200/80 shadow-xs text-xs font-semibold text-gray-700">
                  Aura Pro Max
                  <span className="font-bold text-amber-600 bg-amber-100/80 px-1.5 py-0.5 rounded-full">20 pts</span>
                </span>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-gray-200 shadow-xs text-xs font-semibold text-gray-700">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Votre solde actuel :
                <span className="font-bold text-amber-600">{credits} points</span>
              </div>
            </div>
          </div>

          {/* --- Grille des packs (comme à l'origine) --- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {PRICING.map((pk) => {
              const isCurrent = pk.id === currentPlan && pk.price !== 'Sur devis';
              const isDevis = pk.price === 'Sur devis';
              return (
                <div
                  key={pk.name}
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
                      {pk.ribbon}
                    </span>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">{pk.name}</h4>
                      {isCurrent && (
                        <span className="text-[9px] font-bold text-orange-700 bg-orange-100 border border-orange-200 px-1.5 py-0.5 rounded-full">
                          ACTUEL
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500">{pk.tagline}</p>
                  </div>

                  <div className="flex items-end gap-1.5">
                    <span className={`text-2xl font-bold tracking-tight ${pk.highlight ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-500' : 'text-gray-900'}`}>
                      {pk.price}
                    </span>
                    {pk.period && <span className="text-[11px] text-gray-400 pb-1">{pk.period}</span>}
                  </div>

                  {pk.points && (
                    <div className={`flex items-center gap-1.5 w-fit px-3 py-1 rounded-full text-[11px] font-bold border ${
                      pk.highlight
                        ? 'bg-amber-100/80 text-amber-800 border-amber-200'
                        : 'bg-gray-100 text-gray-700 border-gray-200'
                    }`}>
                      <Zap className="w-3 h-3 text-amber-500" />
                      {pk.points}
                    </div>
                  )}

                  <ul className="space-y-2 flex-1 pt-1">
                    {pk.features.map((f) => (
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
                      onChoose(pk.id);
                    }}
                    className={`w-full px-3 py-2.5 rounded-full text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-gray-100 text-gray-400 cursor-default'
                        : pk.highlight
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-md shadow-amber-200/60 cursor-pointer'
                        : 'bg-gray-900 hover:bg-black text-white cursor-pointer'
                    }`}
                  >
                    {isCurrent ? 'Pack actuel' : pk.cta}
                  </button>
                </div>
              );
            })}
          </div>

          {/* --- Remarques de consommation --- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRICING_TIPS.map((tip) => (
              <div
                key={tip.title}
                className={`flex items-start gap-3 rounded-2xl border p-4 ${
                  tip.tone === 'eco' ? 'border-emerald-200/80 bg-emerald-50/40' : 'border-amber-200/80 bg-amber-50/50'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    tip.tone === 'eco' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                  }`}
                >
                  {tip.icon === 'lightbulb' ? <Lightbulb className="w-4 h-4" /> : <Rocket className="w-4 h-4" />}
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-gray-900">{tip.title}</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{tip.text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* --- Note de facturation --- */}
          <p className="text-[11px] text-gray-400 text-center leading-relaxed max-w-xl mx-auto">
            Les points sont déduits uniquement lorsque vous générez un visuel — un point non utilisé reste dans votre solde.
            L'export PNG HD, l'export multi-calques Canva et l'envoi vers votre compte Canva sont toujours inclus gratuitement.
          </p>
        </main>
      </div>
    </div>
  );
}

// ============================================================
// PAGE /home — LANDING PUBLIQUE (page de vente)
// ============================================================
function LandingPage({
  credits,
  onEnter,
  onPricing,
  onReferral,
}: {
  credits: number;
  onEnter: () => void;
  onPricing: () => void;
  onReferral: () => void;
}) {
  // Header transparent en haut, fond flouté dès qu'on scrolle
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const steps = [
    { n: '1', title: 'Décrivez votre idée', text: "« Post de lancement pour ma boutique de bijoux » — une phrase suffit, l'IA fait le reste." },
    { n: '2', title: 'Choisissez modèle & format', text: 'Flash, Studio ou Pro Max — puis Story, Post carré, Carrousel, Affiche…' },
    { n: '3', title: 'Exportez partout', text: 'PNG HD, PDF multi-pages ou envoi direct dans votre compte Canva, calques éditables inclus.' },
  ];
  const features = [
    { icon: Sparkles, title: '3 modèles IA', text: 'Aura Flash pour la vitesse, Studio pour le HD, Pro Max pour vos plus gros projets.' },
    { icon: PencilRuler, title: 'Export Canva multi-calques', text: 'Vos textes et éléments restent modifiables calque par calque dans Canva.' },
    { icon: Maximize2, title: 'Magic Resize gratuit', text: 'Déclinez un design en Story, Post, Affiche ou 16:9 sans dépenser un point.' },
    { icon: FileText, title: 'PNG HD & PDF', text: 'Exportez un slide ou tout le carrousel, qualité maximale pour l’impression et le web.' },
    { icon: Palette, title: 'Brand Kit intégré', text: 'Logo, nom, @handle et couleur d’accent appliqués automatiquement à chaque design.' },
    { icon: Smartphone, title: 'Installable comme une app', text: 'Aura Design s’installe sur votre téléphone — crénez où que vous soyez, même hors ligne.' },
  ];

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden font-sans text-gray-900 antialiased">
      <div className="aurora fixed" aria-hidden="true">
        <span className="blob blob-a" />
        <span className="blob blob-b" />
        <span className="blob blob-c" />
        <span className="blob blob-d" />
      </div>

      <div className="relative z-10">
        {/* --- Header --- */}
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
              <button
                type="button"
                onClick={onPricing}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold text-gray-700 hover:bg-white/80 transition-colors cursor-pointer"
              >
                Tarifs
              </button>
              <button
                type="button"
                onClick={onEnter}
                className="px-4 py-1.5 rounded-full bg-gray-900 hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                Ouvrir l'atelier
              </button>
            </div>
          </div>
        </header>

        {/* --- Hero --- */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-10 text-center space-y-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-amber-200/70 text-[11px] font-bold text-amber-700 shadow-xs">
            <Zap className="w-3 h-3" />
            NOUVEAU · 20 POINTS OFFERTS À L'INSCRIPTION
          </span>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.08] max-w-3xl mx-auto">
            Des designs qui <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">vendent</span>,
            <br className="hidden sm:block" /> générés en seconde.
          </h1>
          <p className="text-sm sm:text-base text-gray-600 max-w-xl mx-auto leading-relaxed">
            Posts, stories, carrousels, affiches et fiches produit pour vos réseaux sociaux.
            Décrivez votre idée — l'IA s'occupe du reste, avec votre logo et vos couleurs.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onEnter}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-sm font-bold shadow-lg shadow-amber-200/70 transition-all cursor-pointer"
            >
              Commencer gratuitement
            </button>
            <button
              type="button"
              onClick={onPricing}
              className="px-6 py-3 rounded-full bg-white border border-gray-200 hover:border-amber-300 text-gray-800 text-sm font-bold transition-all cursor-pointer"
            >
              Voir les packs
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] font-semibold text-gray-500">
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500" /> Sans carte bancaire
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500" /> Prêt en 10 secondes
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500" /> {credits > 0 ? `${credits} points sur votre compte` : '20 points de bienvenue'}
            </span>
          </div>

          {/* --- Aperçu des designs (mockups CSS dans le style de l'atelier) --- */}
          <div className="relative max-w-3xl mx-auto mt-12">
            <div className="flex items-end justify-center gap-4 sm:gap-6">
              {/* Story 4:5 */}
              <div className="hidden sm:block w-52 rotate-[-4deg] translate-y-2 hover:rotate-[-2deg] transition-transform duration-300">
                <div className="rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl p-4 aspect-[4/5] flex flex-col justify-between text-left overflow-hidden">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-amber-500 flex items-center justify-center text-[7px] font-bold text-black">A</div>
                    <span className="text-[8px] font-bold tracking-wider text-white uppercase">Aura Studio</span>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[8px] font-bold uppercase tracking-wider text-amber-400">Lancement</span>
                    <h3 className="text-sm font-semibold text-white leading-snug">Votre marque mérite d'être vue.</h3>
                    <p className="text-[9px] text-zinc-400 leading-relaxed">Des visuels pro, générés par l'IA en quelques secondes.</p>
                  </div>
                  <div className="flex items-center justify-between text-[8px] text-zinc-500 border-t border-zinc-800 pt-2">
                    <span className="text-white font-semibold">@aura.design</span>
                    <span className="text-amber-400 font-bold">Découvrir ➔</span>
                  </div>
                </div>
              </div>
              {/* Carré 1:1 (central) */}
              <div className="w-60 sm:w-72 hover:-translate-y-1 transition-transform duration-300">
                <div className="rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-5 aspect-square flex flex-col justify-between text-left overflow-hidden relative">
                  <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-amber-500/20 blur-2xl" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center text-[9px] font-bold text-black">A</div>
                      <span className="text-[9px] font-bold tracking-wider text-white uppercase">Aura Studio</span>
                    </div>
                    <span className="text-[8px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">01 / 05</span>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">Conseil #1</span>
                    <h3 className="text-lg font-semibold text-white leading-snug">Publiez tous les jours sans y passer vos soirées.</h3>
                    <div className="space-y-1 pt-1">
                      {['Un visuel par jour, généré en 10s', 'Votre logo et vos couleurs', 'Export direct vers Canva'].map((b) => (
                        <div key={b} className="flex items-center gap-1.5 text-[9px] text-zinc-300">
                          <span className="w-3 h-3 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[7px]">✓</span>
                          {b}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-zinc-500 border-t border-zinc-800 pt-2.5">
                    <span className="text-white font-semibold">@aura.design</span>
                    <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">Enregistrer ➔</span>
                  </div>
                </div>
              </div>
              {/* Affiche 2:3 */}
              <div className="hidden sm:block w-48 rotate-[4deg] translate-y-2 hover:rotate-[2deg] transition-transform duration-300">
                <div className="rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl p-4 aspect-[2/3] flex flex-col justify-between text-left overflow-hidden">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-amber-500 flex items-center justify-center text-[7px] font-bold text-black">A</div>
                    <span className="text-[8px] font-bold tracking-wider text-white uppercase">Aura Studio</span>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[8px] font-bold uppercase tracking-wider text-amber-400">Événement</span>
                    <h3 className="text-sm font-semibold text-white leading-snug">Vente flash ce week-end.</h3>
                    <div className="text-xl font-bold text-amber-400">-30%</div>
                    <p className="text-[9px] text-zinc-400">Sur toute la boutique, samedi & dimanche seulement.</p>
                  </div>
                  <div className="text-center text-[8px] font-bold text-black bg-amber-400 rounded-full py-1.5">Réserver ma place ➔</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- Comment ça marche (étapes connectées) --- */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-center space-y-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-amber-200/70 text-[11px] font-bold text-amber-700 shadow-xs">
              <Sparkles className="w-3 h-3" />
              SIMPLE COMME BONJOUR
            </span>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Comment ça marche ?</h2>
          </div>
          <div className="relative mt-10">
            {/* Ligne de connexion entre les étapes (desktop) */}
            <div className="hidden sm:block absolute top-7 left-[16%] right-[16%] h-0.5 rounded-full bg-gradient-to-r from-amber-300/0 via-orange-300 to-amber-300/0" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6">
              {steps.map((st) => (
                <div key={st.n} className="relative group text-center">
                  {/* Badge numéroté qui chevauche la carte */}
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

        {/* --- Fonctionnalités (cartes premium) --- */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-center space-y-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-amber-200/70 text-[11px] font-bold text-amber-700 shadow-xs">
              <Zap className="w-3 h-3" />
              POURQUOI AURA DESIGN
            </span>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Tout ce qu'il faut pour <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">briller</span> sur les réseaux
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="group relative rounded-3xl bg-white/90 backdrop-blur border border-gray-200/80 p-6 overflow-hidden hover:-translate-y-1.5 hover:shadow-xl hover:shadow-amber-100/70 hover:border-amber-300/60 transition-all duration-300"
              >
                {/* Lueur décorative au survol */}
                <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br from-amber-200/60 to-orange-200/40 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                {/* Liseré dégradé en haut de carte */}
                <div className="absolute top-0 left-6 right-6 h-0.5 rounded-full bg-gradient-to-r from-amber-400/0 via-amber-400 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-200/70 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300">
                      <f.icon className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <span className="text-[11px] font-bold tracking-wider text-gray-200 group-hover:text-amber-300 transition-colors duration-300">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 font-semibold text-gray-900 text-sm">{f.title}</h3>
                  <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* --- Parrainage --- */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-orange-50/60 to-white p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white border border-amber-200 text-[10px] font-bold text-amber-700">
                <Gift className="w-3 h-3" />
                PARRAINAGE
              </span>
              <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-gray-900">
                Gagnez <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">50 points</span> quand votre pote souscrit un pack
              </h2>
              <p className="text-xs text-gray-600 max-w-lg leading-relaxed">
                Partagez votre lien d'invitation : votre ami démarre avec 20 points de bienvenue, et vous recevez
                50 points dès qu'il active son premier pack payant.
              </p>
            </div>
            <button
              type="button"
              onClick={onReferral}
              className="shrink-0 px-5 py-2.5 rounded-full bg-gray-900 hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer shadow-md"
            >
              Obtenir mon lien d'invitation
            </button>
          </div>
        </section>

        {/* --- CTA final --- */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Prêt à créer votre premier design ?</h2>
          <p className="text-sm text-gray-500">20 points offerts — de quoi générer vos 4 premiers visuels, sans payer.</p>
          <button
            type="button"
            onClick={onEnter}
            className="px-7 py-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-sm font-bold shadow-lg shadow-amber-200/70 transition-all cursor-pointer"
          >
            Commencer gratuitement
          </button>
        </section>

        {/* --- Footer --- */}
        <footer className="border-t border-orange-200/40 bg-white/65 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-gray-500">
            <span>© 2026 Aura Design — Créé en Algérie 🇩🇿</span>
            <div className="flex items-center gap-4 font-semibold">
              <button type="button" onClick={onEnter} className="hover:text-gray-900 cursor-pointer transition-colors">Atelier</button>
              <button type="button" onClick={onPricing} className="hover:text-gray-900 cursor-pointer transition-colors">Tarifs & Packs</button>
              <button type="button" onClick={onReferral} className="hover:text-gray-900 cursor-pointer transition-colors">Parrainage</button>
            </div>
          </div>
        </footer>
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

  // Brand Kit state
  const [isBrandKitOpen, setIsBrandKitOpen] = useState(false);
  const [brandName, setBrandName] = useState(() => loadBrand().name ?? 'Aura Studio');
  const [brandHandle, setBrandHandle] = useState(() => loadBrand().handle ?? '@aurastudio.ai');
  const [brandColor, setBrandColor] = useState(() => loadBrand().color ?? '#F59E0B');
  useEffect(() => {
    try {
      localStorage.setItem('aura_brand', JSON.stringify({ name: brandName, handle: brandHandle, color: brandColor }));
    } catch {}
  }, [brandName, brandHandle, brandColor]);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFile = (file: File) => {
    if (file && (file.type.startsWith('image/') || file.name.endsWith('.svg'))) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setBrandLogo(event.target?.result as string);
        showToast('Logo de marque importé avec succès !');
      };
      reader.readAsDataURL(file);
    } else {
      showToast('Format non supporté. Veuillez choisir un fichier PNG, JPG ou SVG.');
    }
  };

  // Chat & Input state
  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<FormatType>('post');
  const [isFormatDropdownOpen, setIsFormatDropdownOpen] = useState(false);
  const [isComposerModelOpen, setIsComposerModelOpen] = useState(false);
  const [resizeOpenId, setResizeOpenId] = useState<string | null>(null);
  const [referralOpen, setReferralOpen] = useState(false);
  const [carouselSlidesCount, setCarouselSlidesCount] = useState<number>(4);
  const [isSlidesDropdownOpen, setIsSlidesDropdownOpen] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
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
              showToast('Photo ajoutée au message !');
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

  // Salutation dynamique Gemini
  const greetingSalutation = t('greeting');

  // Suggestions d'inspiration sur la page d'accueil style Gemini
  const welcomeSuggestions = [
    { title: 'Lancement de ma boutique', prompt: 'Crée un visuel de lancement percutant pour l\'ouverture de ma nouvelle boutique en ligne.', SIcon: ShoppingBag },
    { title: 'Landing page e-commerce', prompt: 'Conçois la section hero d\'une landing page e-commerce moderne pour une boutique en ligne, avec mise en avant produit et bouton d\'achat.', SIcon: Globe },
    { title: 'Promotion -30%', prompt: 'Génère un visuel promotionnel pour une réduction de -30% valable ce week-end seulement.', SIcon: BadgePercent },
    { title: 'Conseils pour ma clientèle', prompt: 'Crée un contenu éducatif donnant 5 conseils pratiques à mes clients pour progresser rapidement.', SIcon: Lightbulb },
    { title: 'Citation inspirante', prompt: 'Crée un visuel avec une citation inspirante sur la réussite et la discipline pour LinkedIn.', SIcon: Quote },
  ].map((c) => ({ ...c, icon: <c.SIcon className="w-4 h-4 text-orange-600" /> }));

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 2800);
  };
  // Détection d'un lien de parrainage (?ref=CODE)
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get('ref');
      if (ref) {
        localStorage.setItem('aura_ref_applied', ref);
        showToast(`Code d'invitation ${ref} détecté — vos 20 points de bienvenue vous attendent !`);
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
        setIsBrandKitOpen(false);
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
      { watermark: plan === 'free' }
    );
    if (!blob) {
      showToast("Export impossible sur ce navigateur.");
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
    showToast(`Export du slide ${index + 1} en cours...`);
    if (await downloadSlide(design, index)) showToast(`Slide ${index + 1} téléchargé !`);
  };

  const handleExportAll = async (design: DesignContent) => {
    showToast(`Export de ${design.slides.length} slides en cours...`);
    for (let i = 0; i < design.slides.length; i++) {
      await downloadSlide(design, i);
      await new Promise((r) => setTimeout(r, 350));
    }
    showToast('Tous les slides sont téléchargés !');
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
    showToast('Préparation du fichier multi-calques...');
    try {
      const fmt = FORMATS[design.format];
      const blob = createEditableCanvaPptx({
        title: design.title,
        widthPx: fmt.w,
        heightPx: fmt.h,
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
            showToast('Design ouvert dans votre compte Canva !');
            setCanvaExporting(false);
            return;
          }
          showToast('Import automatique indisponible — fichier multi-calques téléchargé.');
        } catch {
          showToast('Import automatique indisponible — fichier multi-calques téléchargé.');
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
      showToast('Export Canva impossible.');
    }
    setCanvaExporting(false);
  };

  // ===== EXPORT PDF (tous les slides en un seul fichier) =====
  const handleExportPdf = async (design: DesignContent) => {
    showToast(`Export PDF de ${design.slides.length} slide(s) en cours...`);
    try {
      const fmt = FORMATS[design.format];
      const pages = [];
      for (const slide of design.slides) {
        const blob = await slideToPngBlob(
          slide,
          design.format,
          design.slides.length,
          { name: brandName, handle: brandHandle, color: brandColor },
          { mime: 'image/jpeg', watermark: plan === 'free' }
        );
        if (!blob) {
          showToast('Export PDF impossible sur ce navigateur.');
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
      showToast('PDF téléchargé !');
    } catch {
      showToast('Export PDF impossible.');
    }
  };

  // ===== MAGIC RESIZE : décliner le design dans un autre format (gratuit) =====
  const handleResizeDesign = (design: DesignContent, newFormat: FormatType) => {
    const resized: DesignContent = {
      format: newFormat,
      title: design.title,
      activeSlideIndex: 0,
      slides: design.slides.map((sl, i) => ({ ...sl, id: `rsz_${i}_${Date.now()}` })),
    };
    const resizeMsg: Message = {
      id: `ast_${Date.now()}`,
      sender: 'assistant',
      text: `Voici votre design **décliné au format ${FORMATS[newFormat].label}** — même contenu, nouvelles proportions. Le recyclage entre formats est **gratuit** !`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      design: resized,
      suggestions: ['Exporter en PDF', 'Exporter tout le carrousel en PNG HD'],
    };
    setMessages((prev) => [...prev, resizeMsg]);
    showToast(`Design décliné en ${FORMATS[newFormat].label} — gratuit !`);
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
    showToast('Compte Canva connecté ! Prochain export : envoi automatique.');
  };

  // Copy slide text
  const handleCopySlideText = async (slide: Slide) => {
    const text = `${slide.tag}\n\n${slide.title}\n\n${slide.subtitle}\n\n${slide.bulletPoints?.join('\n') || ''}`;
    const ok = await copyText(text);
    if (ok) {
      setCopiedId(slide.id);
      showToast('Contenu du slide copié !');
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      showToast('Copie impossible.');
    }
  };

  const handleCopyMessage = async (text: string) => {
    showToast((await copyText(text)) ? 'Texte copié !' : 'Copie impossible.');
  };

  const handleShare = async () => {
    showToast((await copyText(window.location.href)) ? 'Lien copié dans le presse-papier !' : 'Copie impossible.');
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
    if (lastUser && (lower.includes('slides') || lower.includes('format'))) {
      handleSendMessage(lastUser, opts);
      return;
    }
    handleSendMessage(sug);
  };

  // Handle send prompt
  const handleSendMessage = (textToSend?: string, opts: { format?: FormatType; count?: number } = {}) => {
    const query = (textToSend || inputPrompt).trim();
    if ((!query && attachedImages.length === 0) || isGenerating) return;

    const currentPhotos = [...attachedImages];
    const promptText = query || (currentPhotos.length > 0 ? 'Génère un design intégrant mes photos' : '');
    const inferred = inferOpts(promptText);
    const resolvedFmt: FormatType = opts.format ?? inferred.format ?? selectedFormat;
    const resolvedCount = opts.count ?? inferred.count ?? carouselSlidesCount;

    // ===== FACTURATION POINTS : 1 image IA générée par slide =====
    const ptsPerImage = MODEL_POINTS[activeModelId];
    const aiImagesCount = FORMATS[resolvedFmt].kind === 'carousel' ? resolvedCount : 1;
    const generationCost = aiImagesCount * ptsPerImage;
    if (credits < generationCost) {
      showToast(`Solde insuffisant : ${generationCost} points requis (${credits} restants).`);
      navigate('/pricing');
      return;
    }
    const remainingCredits = credits - generationCost;
    setCredits(remainingCredits);
    setTimeout(() => showToast(`−${generationCost} points · solde : ${remainingCredits} pts`), 1600);

    const sessionId = activeSessionId;
    setSelectedFormat(resolvedFmt);
    setCarouselSlidesCount(resolvedCount);
    setRecentSessions((prev) =>
      prev.some((s) => s.id === sessionId)
        ? prev
        : [{ id: sessionId, title: promptText.length > 34 ? `${promptText.slice(0, 34)}…` : promptText, format: resolvedFmt }, ...prev]
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
    setIsGenerating(true);

    setTimeout(() => {
      setIsGenerating(false);

      const activeFmt: FormatType = resolvedFmt;

      const heroImg = currentPhotos[0] || imgAbstract;
      const secondaryImg = currentPhotos[1] || imgMarketing;

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

      const generatedDesign: DesignContent = {
        format: activeFmt,
        title: promptText.length < 35 ? promptText : 'Post Social Media Optimisé',
        activeSlideIndex: 0,
        slides: slidesToBuild,
      };

      const fmtLabel = FORMATS[activeFmt].label;
      const isCarousel = FORMATS[activeFmt].kind === 'carousel';
      const aiMsgText = isCarousel
        ? `Voici votre ${activeFmt === 'presentation' ? 'présentation' : 'carrousel'} de **${resolvedCount} slides** au format **${fmtLabel}**${currentPhotos.length > 0 ? ` avec vos ${currentPhotos.length} photo(s) intégrée(s)` : ''}. Le Canvas ci-dessous vous permet de faire défiler les slides et d'exporter en haute résolution.`
        : `Voici votre nouveau design au format **${fmtLabel}**${currentPhotos.length > 0 ? ` avec vos ${currentPhotos.length} photo(s) intégrée(s)` : ''}. Le Canvas ci-dessous vous permet de le visualiser et de l'exporter en haute résolution.`;

      const aiMsg: Message = {
        id: `ast_${Date.now()}`,
        sender: 'assistant',
        text: aiMsgText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        design: generatedDesign,
        suggestions: [
          'Affiner le texte du Slide 1',
          isCarousel ? `Régénérer avec ${resolvedCount === 5 ? 7 : 5} slides` : 'Passer en format Carrousel 4:5',
          'Exporter tout le carrousel en PNG HD',
          'Exporter en PDF',
        ],
      };

      if (activeIdRef.current === sessionId) {
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        setSessionMessagesMap((prev) => ({ ...prev, [sessionId]: [...(prev[sessionId] || []), aiMsg] }));
      }
      showToast(isCarousel ? `${resolvedCount} slides générés !` : 'Nouveau design généré !');
    }, 1100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
      showToast('Patientez, génération en cours...');
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
    showToast('Session supprimée.');
  };

  const filteredSessions = recentSessions.filter((s) =>
    s.title.toLowerCase().includes(sessionSearch.trim().toLowerCase())
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

  // ===== PAGE /pricing DÉDIÉE =====
  if (route === '/pricing') {
    return (
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <PricingPage
          currentPlan={plan}
          credits={credits}
          onChoose={(packId) => {
            if (packId === plan) return;
            setPlan(packId);
            if (packId === 'free') setCredits(20);
            if (packId === 'starter') setCredits(150);
            if (packId === 'pro') setCredits(450);
            const pack = PRICING.find((pk) => pk.id === packId);
            showToast(`Pack ${pack?.name} activé · ${pack?.points} !`);
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
          <h1 className="text-xl font-semibold text-gray-900">Vous êtes déconnecté</h1>
          <p className="text-sm text-gray-500">À bientôt sur Aura Design.</p>
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
            Se reconnecter
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
            title="Masquer la barre latérale"
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
              placeholder="Rechercher une session..."
              className="w-full px-4 py-2 rounded-full bg-white/90 border border-orange-200/60 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-300/50"
            />
          )}

          {/* Brand Kit */}
          <button
            onClick={() => setIsBrandKitOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-full hover:bg-gray-200/60 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
          >
            <Palette className="w-4 h-4 text-gray-500" />
            <span>{t('brandKit')}</span>
          </button>

          {/* Tarifs & Packs */}
          <button
            onClick={() => navigate('/pricing')}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-full hover:bg-gray-200/60 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
          >
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Tarifs & Packs</span>
            <span className="ml-auto text-[10px] font-bold text-amber-600 bg-amber-100/80 px-1.5 py-0.5 rounded-full">
              {credits} pts
            </span>
          </button>

          {/* Parrainage */}
          <button
            onClick={() => setReferralOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-full hover:bg-gray-200/60 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
          >
            <Gift className="w-4 h-4 text-orange-500" />
            <span>Parrainer un ami</span>
            <span className="ml-auto text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded-full">
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
            <p className="px-3 py-2 text-xs text-gray-400">Aucune session trouvée.</p>
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
                  {t('plan')} {PRICING.find((x) => x.id === plan)?.name}
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
                title="Ouvrir la barre latérale"
                className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            {/* Pack choisi (clique = page tarifs) */}
            <button
              type="button"
              onClick={() => navigate('/pricing')}
              title="Votre pack"
              className="flex items-center gap-1.5 px-3 py-1 rounded-full hover:bg-white/70 text-gray-900 font-semibold text-sm cursor-pointer transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span className="tracking-tight">Pack {PRICING.find((pk) => pk.id === plan)?.name || 'Gratuit'}</span>
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
                Packs
              </button>
              <span className="w-px h-3.5 bg-gray-200" />
              <span className={`flex items-center gap-1 font-bold ${credits < 5 ? 'text-red-600' : 'text-gray-900'}`}>
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
                                    title="Copier le texte"
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
                                      title="Décliner ce design dans un autre format (gratuit)"
                                      className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                    >
                                      <Maximize2 className="w-3.5 h-3.5" />
                                    </button>
                                    {resizeOpenId === msg.id && (
                                      <div className="absolute right-0 bottom-10 w-56 rounded-2xl bg-white border border-gray-200 shadow-xl p-1.5 z-30 space-y-0.5">
                                        <div className="px-2.5 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                          Décliner en
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
                                                GRATUIT
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  <button
                                    onClick={() => handleExportPdf(msg.design!)}
                                    title="Exporter tous les slides en un seul PDF"
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-gray-200 hover:border-amber-400 hover:bg-amber-50/60 text-gray-800 font-semibold text-xs tracking-wide transition-all cursor-pointer"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-gray-600" />
                                    <span>PDF</span>
                                  </button>

                                  <button
                                    onClick={() => handleExportToCanva(msg.design!)}
                                    title="Ouvrir ce design éditable dans votre compte Canva"
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-gray-200 hover:border-amber-400 hover:bg-amber-50/60 text-gray-800 font-semibold text-xs tracking-wide transition-all cursor-pointer"
                                  >
                                    {canvaExporting ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                                    ) : (
                                      <PencilRuler className="w-3.5 h-3.5 text-amber-600" />
                                    )}
                                    <span>Modifier sur Canva</span>
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
                                const slide = msg.design.slides[msg.design.activeSlideIndex || 0];
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
                                        className="w-full h-full rounded-2xl bg-zinc-900 border border-zinc-800 p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden shadow-lg"
                                      >
                                        {/* Background Image texture if present */}
                                        {slide.image && (
                                          <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                                            <img
                                              src={slide.image}
                                              alt="Backdrop visual"
                                              className="w-full h-full object-cover filter contrast-125"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
                                          </div>
                                        )}

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
                                            <span className="text-xs font-semibold tracking-wider text-white uppercase">
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
                                            <span style={{ color: brandColor }} className="text-[11px] font-bold uppercase tracking-wider">
                                              {slide.tag}
                                            </span>
                                          </div>

                                          {/* Big Hook Headline */}
                                          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white leading-tight">
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

                                          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-normal">
                                            {slide.subtitle}
                                          </p>

                                          {/* Stat Callout if present */}
                                          {slide.stat && (
                                            <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-amber-500/30 my-2">
                                              <div style={{ color: brandColor }} className="text-3xl font-bold">
                                                {slide.stat.value}
                                              </div>
                                              <div className="text-xs text-zinc-400 mt-0.5">{slide.stat.label}</div>
                                            </div>
                                          )}

                                          {/* Bullet points if present */}
                                          {slide.bulletPoints && (
                                            <div className="space-y-1.5 pt-1">
                                              {slide.bulletPoints.map((bp, i) => (
                                                <div key={i} className="flex items-start gap-2 text-xs text-zinc-200">
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
                                        <div className="relative z-10 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                                          <div className="flex items-center gap-1 text-zinc-400 ">
                                            <span className="text-white font-medium">{brandHandle}</span>
                                            <CheckCircle2 className="w-3 h-3 text-amber-400 inline" />
                                          </div>

                                          {slide.ctaText && (
                                            <div className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
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
                                  <span>Précédent</span>
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
                                  <span>Suivant</span>
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
                                showToast('Merci pour votre retour !');
                              }}
                              className={`p-1 rounded-full hover:bg-white/80 transition-colors cursor-pointer ${feedback[msg.id] === 'up' ? 'text-orange-600' : 'hover:text-gray-700'}`}
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setFeedback((f) => ({ ...f, [msg.id]: 'down' }));
                                showToast('Retour enregistré.');
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
                      <span>Génération de votre design en cours...</span>
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

            {/* Conteneur flottant avec grand rayon de bordure */}
            <div className="relative flex flex-col bg-white/90 backdrop-blur-md rounded-[28px] px-3 py-2.5 border border-orange-200/60 shadow-md focus-within:shadow-lg focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-400/20 transition-all">
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
                        title="Retirer la photo"
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
                    <span>Ajouter photo</span>
                  </button>
                </div>
              )}

              <div className="flex items-center w-full">
                {/* Icône "+" pour ajouter des photos et images */}
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  title="Ajouter des photos"
                  className="w-9 h-9 rounded-full hover:bg-gray-200/80 text-gray-600 hover:text-gray-900 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                >
                  <Plus className="w-5 h-5 stroke-[2]" />
                </button>

                {/* Champ de texte */}
                <input
                  type="text"
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('placeholder')}
                  className="flex-1 bg-transparent px-3 py-1.5 text-sm sm:text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none"
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
                      <div className="absolute right-0 bottom-12 w-60 rounded-2xl bg-white border border-gray-200 shadow-xl p-1.5 z-30 space-y-1">
                        <div className="px-2.5 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                          Format du design
                        </div>
                        {formatOptions.map((fmt) => (
                          <button
                            key={fmt.id}
                            type="button"
                            onClick={() => {
                              setSelectedFormat(fmt.id);
                              setIsFormatDropdownOpen(false);
                              showToast(`Format actif : ${fmt.label}`);
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
                        onClick={() => setIsSlidesDropdownOpen(!isSlidesDropdownOpen)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100/90 text-amber-900 border border-amber-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                        title="Nombre de slides du carrousel"
                      >
                        <Layers className="w-3.5 h-3.5 text-amber-700" />
                        <span>{carouselSlidesCount} slides</span>
                        <ChevronDown className="w-3 h-3 text-amber-700" />
                      </button>

                      {isSlidesDropdownOpen && (
                        <div className="absolute right-0 bottom-12 w-36 rounded-2xl bg-white border border-gray-200 shadow-xl p-1.5 z-30 space-y-1">
                          <div className="px-2.5 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            Nombre de slides
                          </div>
                          {[3, 4, 5, 6, 7, 8, 10].map((count) => (
                            <button
                              key={count}
                              type="button"
                              onClick={() => {
                                setCarouselSlidesCount(count);
                                setIsSlidesDropdownOpen(false);
                                showToast(`Carrousel configuré à ${count} slides`);
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

              {/* Barre d'outils sous le champ de texte (façon Claude) */}
              <div className="flex items-center justify-between px-1.5 pt-1.5 pb-0.5">
                <div className="relative" ref={composerModelRef}>
                  <button
                    type="button"
                    onClick={() => setIsComposerModelOpen((v) => !v)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100/90 text-amber-900 text-[11px] font-bold border border-amber-200/80 transition-colors cursor-pointer"
                    title="Modèle de génération"
                  >
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>{activeModel.name}</span>
                    <span className="text-[9px] font-bold text-amber-700 bg-white/80 px-1 py-0.5 rounded-full">{activeModel.points} pts</span>
                    <ChevronDown className={`w-2.5 h-2.5 text-amber-600 transition-transform ${isComposerModelOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isComposerModelOpen && (
                    <div className="absolute left-0 bottom-10 w-60 rounded-2xl bg-white border border-gray-200 shadow-xl p-1.5 z-30 space-y-0.5">
                      <div className="px-2.5 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        Modèle de génération
                      </div>
                      {MODELS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setActiveModelId(m.id);
                            setIsComposerModelOpen(false);
                            showToast(`Modèle actif : ${m.name} · ${m.points} points / image`);
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
                          Voir les packs
                        </span>
                        <span className="text-[10px] font-bold text-gray-500">{credits} pts</span>
                      </button>
                    </div>
                  )}
                </div>
                <span className="flex items-center gap-1.5 text-[10px] text-gray-400 min-w-0">
                  <Lightbulb className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">{activeModel.desc}</span>
                </span>
                {credits < 5 && (
                  <button
                    type="button"
                    onClick={() => navigate('/pricing')}
                    className="flex items-center gap-1 text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full cursor-pointer transition-colors shrink-0"
                  >
                    <Zap className="w-3 h-3" />
                    Solde faible — voir les packs
                  </button>
                )}
              </div>
            </div>

            {messages.length === 0 ? (
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {welcomeSuggestions.map((card, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(card.prompt)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/85 hover:bg-white border border-orange-200/60 text-sm text-gray-700 hover:text-gray-900 shadow-2xs transition-all cursor-pointer"
                  >
                    {card.icon}
                    <span>{card.title}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 text-center mt-2 font-normal">
                Aura AI génère des visuels optimisés pour LinkedIn, Instagram et X. Vérifiez les textes avant publication.
              </p>
            )}
          </div>
        </div>
      </main>

      {/* ========================================================= */}
      {/* MODAL BRAND KIT */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isBrandKitOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onMouseDown={(e) => e.target === e.currentTarget && setIsBrandKitOpen(false)}
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
                  <Palette className="w-5 h-5 text-amber-500" />
                  <h3 className="font-semibold text-gray-900 text-base">Configuration Brand Kit</h3>
                </div>
                <button
                  onClick={() => setIsBrandKitOpen(false)}
                  className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Zone d'upload pour le logo de la marque (Drag & Drop) */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                    Logo de la marque
                  </label>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleLogoFile(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full border-dashed border-2 ${
                      isDragging
                        ? 'border-amber-500 bg-amber-50/50'
                        : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100'
                    } rounded-2xl p-5 text-center cursor-pointer transition-colors duration-200 flex flex-col items-center justify-center`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleLogoFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />

                    {brandLogo ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={brandLogo}
                          alt="Logo de marque"
                          className="w-10 h-10 object-contain rounded-xl border border-gray-200 bg-white p-1 shadow-xs"
                        />
                        <div className="text-left">
                          <p className="text-xs font-bold text-gray-900">Logo importé avec succès</p>
                          <p className="text-[11px] text-gray-500">Cliquer pour remplacer</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBrandLogo(null);
                            showToast('Logo retiré');
                          }}
                          className="ml-2 text-xs text-red-500 hover:text-red-700 font-semibold cursor-pointer"
                        >
                          Supprimer
                        </button>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="w-8 h-8 text-gray-400 mb-1" />
                        <p className="text-xs font-semibold text-gray-700">
                          Glissez votre logo ici ou parcourez
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">(PNG, JPG, SVG)</p>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                    Votre prénom (affiché à l'accueil)
                  </label>
                  <input
                    type="text"
                    value={userFirstName}
                    onChange={(e) => {
                      setUserFirstName(e.target.value);
                      localStorage.setItem('aura_user_firstname', e.target.value);
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-amber-500"
                    placeholder="Ex: Malek"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                    Nom de la marque / Créateur
                  </label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-amber-500"
                    placeholder="Ex: Aura Studio"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                    Identifiant social (@handle)
                  </label>
                  <input
                    type="text"
                    value={brandHandle}
                    onChange={(e) => setBrandHandle(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900  focus:outline-none focus:border-amber-500"
                    placeholder="@votrecompte"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                    Couleur d'accentuation
                  </label>
                  <div className="flex items-center gap-2">
                    {['#F59E0B', '#EA580C', '#EAB308', '#F97316', '#2563EB', '#059669', '#7C3AED', '#DC2626'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setBrandColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-transform ${
                          brandColor === color ? 'border-gray-900 scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setIsBrandKitOpen(false);
                    showToast('Brand Kit enregistré.');
                  }}
                  className="px-4 py-2 rounded-full bg-gray-900 hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                    <label className="text-xs font-semibold text-gray-700 block mb-1.5">Prénom</label>
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
                        setIsBrandKitOpen(true);
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
                        Compte Canva
                      </span>
                      {canvaConnected ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">CONNECTÉ</span>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-400">NON CONNECTÉ</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRecentSessions([]);
                        setSessionMessagesMap({});
                        setMessages([]);
                        setActiveSessionId(`sess_${Date.now()}`);
                        setModal(null);
                        showToast('Historique effacé.');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-red-100 hover:bg-red-50 text-sm text-red-600 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Effacer l'historique des sessions
                    </button>
                  </div>
                </div>
              )}

              {modal === 'help' && (
                <div className="space-y-2">
                  {FAQ.map((f, i) => (
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
                    <span className="font-semibold text-gray-900">Aura Design</span> est un générateur de designs par IA : posts et stories pour les réseaux sociaux, carrousels, sites web, fiches produit, affiches et présentations.
                  </p>
                  <p>Décrivez ce que vous voulez, choisissez un format, puis exportez votre création en PNG haute définition avec votre Brand Kit.</p>
                  <p className="text-xs text-gray-400">Version 1.0</p>
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
                  <h3 className="font-semibold text-gray-900 text-base">Connecter votre compte Canva</h3>
                </div>
                <button onClick={() => setCanvaModalOpen(false)} className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
                <p>
                  Ouvrez vos designs <span className="font-semibold text-gray-900">100% éditables</span> (textes, calques et couleurs séparés) directement dans votre éditeur Canva.
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-500 bg-gray-50 rounded-2xl p-3.5">
                  <li>Créez une app gratuite sur <span className="font-semibold text-gray-700">canva.dev</span> (Canva Connect API).</li>
                  <li>Copiez votre jeton d'accès personnel.</li>
                  <li>Collez-le ici : vos prochains exports arriveront <span className="font-semibold text-gray-700">automatiquement dans votre compte Canva</span>.</li>
                </ol>
                {canvaConnected && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Compte Canva connecté — envoi automatique actif.
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">Jeton d'accès Canva</label>
                <input
                  type="password"
                  value={canvaTokenInput}
                  onChange={(e) => setCanvaTokenInput(e.target.value)}
                  placeholder="Collez votre jeton ici..."
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
                      showToast('Compte Canva déconnecté.');
                    }}
                    className="px-4 py-2 rounded-full text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    Déconnecter
                  </button>
                ) : <span />}
                <button
                  type="button"
                  onClick={handleCanvaConnect}
                  className="px-4 py-2 rounded-full bg-gray-900 hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  {canvaConnected ? 'Mettre à jour le jeton' : 'Connecter Canva'}
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
                  <h3 className="font-semibold text-gray-900 text-base">Parrainez vos amis</h3>
                </div>
                <button onClick={() => setReferralOpen(false)} className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { n: '1', txt: 'Partagez votre lien' },
                  { n: '2', txt: 'Votre pote reçoit 20 pts' },
                  { n: '3', txt: 'Il paye un pack → vous gagnez 50 pts' },
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
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">Votre code d'invitation</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2 text-sm font-bold tracking-wider text-amber-800 text-center">
                    {getReferralCode()}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyText(`https://${window.location.host}/?ref=${getReferralCode()}`);
                      showToast(ok ? 'Lien de parrainage copié !' : 'Copie impossible.');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    Copier le lien
                  </button>
                </div>
              </div>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Crée des designs de fou avec l'IA sur Aura Design 🎨 — 20 points offerts avec mon lien : https://${window.location.host}/?ref=${getReferralCode()}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <Gift className="w-3.5 h-3.5" />
                Partager sur WhatsApp
              </a>

              <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                Les 50 points sont crédités automatiquement sur votre solde dès que votre filleul active son premier pack payant.
                Pas de limite : 3 filleuls = 150 points !
              </p>
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
