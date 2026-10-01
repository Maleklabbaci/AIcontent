import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Plus,
  Search,
  Palette,
  LayoutTemplate,
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
  UploadCloud
} from 'lucide-react';

// Format types
type FormatType = 'scroller' | 'story' | 'square';

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

const INITIAL_DEMO_MESSAGES: Message[] = [
  {
    id: 'msg_1',
    sender: 'user',
    text: 'Génère un carrousel B2B au format 4:5 sur les erreurs de copywriting en 2026, avec un style minimaliste et percutant.',
    timestamp: '14:28',
  },
  {
    id: 'msg_2',
    sender: 'assistant',
    text: "J'ai conçu un carrousel de 4 slides optimisé pour LinkedIn et Instagram. La typographie est ultra-contrastée pour maximiser le scroll-stop rate, avec des accents ambrés subtils pour guider l'œil vers les points clés.",
    timestamp: '14:29',
    design: {
      format: 'scroller',
      title: 'Les Erreurs de Copywriting B2B',
      activeSlideIndex: 0,
      slides: [
        {
          id: 'sl_1',
          slideNumber: 1,
          tag: 'COPYWRITING & CONVERSION 2026',
          title: '90% des posts B2B ne convertissent pas.',
          subtitle: 'Voici la structure en 4 étapes que les meilleurs créateurs utilisent pour captiver et vendre sans forcer.',
          highlightWord: 'convertissent',
          image: '/src/assets/images/social_abstract_accent_1790812839231.jpg',
          ctaText: 'Faites glisser pour découvrir ➔',
        },
        {
          id: 'sl_2',
          slideNumber: 2,
          tag: 'ERREUR #1 · LE JARGON TECHNIQUE',
          title: 'Tuez les phrases creuses dès la 1ère seconde.',
          subtitle: "Si votre accroche ne pose pas un paradoxe ou une tension immédiate, votre lecteur passe au post suivant.",
          highlightWord: 'immédiate',
          bulletPoints: [
            'Bannissez "Dans le paysage dynamique d\'aujourd\'hui..."',
            'Commencez par un coût d\'inaction chiffré',
            'Limitez le hook à moins de 8 mots percutants',
          ],
        },
        {
          id: 'sl_3',
          slideNumber: 3,
          tag: 'ERREUR #2 · L\'ABSENCE DE PREUVES',
          title: 'Remplacez les promesses par des métriques réelles.',
          subtitle: 'Les décideurs sont immunisés contre les adjectifs vagues. Donnez-leur des chiffres irréfutables.',
          stat: {
            value: '+318%',
            label: 'Taux de clics qualifiés mesuré après refonte du framework narratif',
          },
          image: '/src/assets/images/social_marketing_visual_1790812851560.jpg',
        },
        {
          id: 'sl_4',
          slideNumber: 4,
          tag: 'RÉCAPITULATIF & PASSAGE À L\'ACTION',
          title: 'Prêt à transformer votre portée organique ?',
          subtitle: 'Enregistrez ce carrousel pour l\'appliquer à votre prochaine campagne et partagez-le à votre équipe.',
          bulletPoints: [
            'Hook paradoxal en moins de 8 mots',
            'Une seule idée force par slide',
            'CTA orienté bénéfice mesurable',
          ],
          ctaText: 'Enregistrer le post · Suivre @aurastudio.ai',
        },
      ],
    },
    suggestions: [
      'Passer au format Story 9:16',
      'Rendre le hook plus provocateur',
      'Ajouter une slide statistique',
      'Télécharger les slides en PNG',
    ],
  },
];

export default function App() {
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState('sess_new');

  // User First Name (Gemini Greeting)
  const [userFirstName, setUserFirstName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('aura_user_firstname') || 'Malek';
    }
    return 'Malek';
  });

  // Brand Kit state
  const [isBrandKitOpen, setIsBrandKitOpen] = useState(false);
  const [brandName, setBrandName] = useState('Aura Studio');
  const [brandHandle, setBrandHandle] = useState('@aurastudio.ai');
  const [brandColor, setBrandColor] = useState('#F59E0B'); // amber accent
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

  // Templates Modal state
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);

  // Chat & Input state
  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<FormatType>('scroller');
  const [isFormatDropdownOpen, setIsFormatDropdownOpen] = useState(false);
  const [carouselSlidesCount, setCarouselSlidesCount] = useState<number>(4);
  const [isSlidesDropdownOpen, setIsSlidesDropdownOpen] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
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
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([
    { id: 'sess_1', title: 'Carrousel B2B (Démo)', format: 'scroller' },
    { id: 'sess_2', title: 'Story Sawtify', format: 'story' },
    { id: 'sess_3', title: 'Lancement Produit SaaS', format: 'scroller' },
    { id: 'sess_4', title: 'Citation Steve Jobs', format: 'square' },
    { id: 'sess_5', title: 'Framework Growth Q1', format: 'scroller' },
  ]);

  // Messages list - starts empty so user immediately lands on the Gemini greeting screen!
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionMessagesMap, setSessionMessagesMap] = useState<Record<string, Message[]>>({
    sess_1: INITIAL_DEMO_MESSAGES,
  });

  // Salutation dynamique Gemini
  const currentHour = new Date().getHours();
  const greetingSalutation = currentHour >= 18 || currentHour < 5 ? 'Bonsoir' : 'Bonjour';

  // Suggestions d'inspiration sur la page d'accueil style Gemini
  const welcomeSuggestions = [
    {
      title: 'Carrousel B2B Viral',
      badge: 'Carrousel 4:5 · 5 slides',
      format: 'scroller' as FormatType,
      slidesCount: 5,
      prompt: 'Génère un carrousel B2B en 5 slides sur les erreurs fatales que font les startups en phase de scaling.',
      icon: <Layers className="w-4 h-4 text-amber-600" />,
    },
    {
      title: 'Story Teaser Masterclass',
      badge: 'Story 9:16',
      format: 'story' as FormatType,
      prompt: 'Génère une story teaser ultra-captivante pour une masterclass IA jeudi à 18h avec compte à rebours.',
      icon: <Smartphone className="w-4 h-4 text-amber-600" />,
    },
    {
      title: 'Poster Citation Minimaliste',
      badge: 'Carré 1:1',
      format: 'square' as FormatType,
      prompt: 'Crée un post citation percutant et minimaliste sur la discipline et le focus d\'un fondateur.',
      icon: <Square className="w-4 h-4 text-amber-600" />,
    },
    {
      title: 'Framework Avant / Après',
      badge: 'Carrousel 4:5 · 4 slides',
      format: 'scroller' as FormatType,
      slidesCount: 4,
      prompt: 'Génère un comparatif avant / après en 4 slides montrant l\'impact concret de l\'automatisation IA.',
      icon: <Sparkles className="w-4 h-4 text-amber-600" />,
    },
  ];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Click outside format & slides count dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsFormatDropdownOpen(false);
      }
      if (slidesCountDropdownRef.current && !slidesCountDropdownRef.current.contains(event.target as Node)) {
        setIsSlidesDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format definitions
  const formatOptions: { id: FormatType; label: string; ratio: string; icon: React.ReactNode }[] = [
    { id: 'scroller', label: 'Carrousel 4:5', ratio: '1080 × 1350', icon: <Layers className="w-4 h-4 text-gray-600" /> },
    { id: 'story', label: 'Story 9:16', ratio: '1080 × 1920', icon: <Smartphone className="w-4 h-4 text-gray-600" /> },
    { id: 'square', label: 'Carré 1:1', ratio: '1080 × 1080', icon: <Square className="w-4 h-4 text-gray-600" /> },
  ];

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

  // Export slide as PNG simulation
  const handleExportSlide = (title: string, slideNumber: number, imageUrl?: string) => {
    showToast(`Téléchargement du Slide #${slideNumber} (PNG HD 1080px)...`);
    setTimeout(() => {
      const link = document.createElement('a');
      link.href = imageUrl || '/src/assets/images/social_abstract_accent_1790812839231.jpg';
      link.download = `${title.replace(/\s+/g, '_')}_slide_${slideNumber}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Slide #${slideNumber} exporté avec succès !`);
    }, 500);
  };

  // Copy slide text
  const handleCopySlideText = (slide: Slide) => {
    const text = `${slide.tag}\n\n${slide.title}\n\n${slide.subtitle}\n\n${slide.bulletPoints?.join('\n') || ''}`;
    navigator.clipboard.writeText(text);
    setCopiedId(slide.id);
    showToast('Contenu du slide copié dans le presse-papier !');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Handle send prompt
  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend || inputPrompt).trim();
    if ((!query && attachedImages.length === 0) || isGenerating) return;

    const currentPhotos = [...attachedImages];
    const promptText = query || (currentPhotos.length > 0 ? 'Génère un design intégrant mes photos' : '');

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

      const isStory = selectedFormat === 'story' || promptText.toLowerCase().includes('story');
      const isSquare = selectedFormat === 'square' || promptText.toLowerCase().includes('carré');
      const activeFmt: FormatType = isStory ? 'story' : isSquare ? 'square' : 'scroller';

      const heroImg = currentPhotos[0] || '/src/assets/images/social_abstract_accent_1790812839231.jpg';
      const secondaryImg = currentPhotos[1] || '/src/assets/images/social_marketing_visual_1790812851560.jpg';

      let slidesToBuild: Slide[] = [];

      if (activeFmt === 'scroller') {
        const count = carouselSlidesCount;
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
            tag: activeFmt === 'story' ? 'STORY IMPACT' : 'POST CARRÉ',
            title: promptText.length < 45 ? promptText : 'La vérité que personne n\'ose dire dans votre industrie.',
            subtitle: 'Une stratégie claire et 3 principes immuables pour transformer votre visibilité.',
            highlightWord: 'vérité',
            image: heroImg,
            ctaText: activeFmt === 'story' ? 'Swipe up ➔' : 'Enregistrer ➔',
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

      const aiMsgText = activeFmt === 'scroller'
        ? `Voici votre nouveau carrousel de **${carouselSlidesCount} slides** généré au format **Carrousel 4:5**${currentPhotos.length > 0 ? ` avec vos ${currentPhotos.length} photo(s) intégrée(s)` : ''}. Le Canvas ci-dessous vous permet de faire défiler l'ensemble des ${carouselSlidesCount} slides, d'ajuster le contenu et d'exporter en haute résolution.`
        : `Voici votre nouveau design généré au format **${activeFmt === 'story' ? 'Story 9:16' : 'Carré 1:1'}**${currentPhotos.length > 0 ? ` avec vos ${currentPhotos.length} photo(s) intégrée(s)` : ''}. Le Canvas ci-dessous vous permet de visualiser et d'exporter en haute résolution.`;

      const aiMsg: Message = {
        id: `ast_${Date.now()}`,
        sender: 'assistant',
        text: aiMsgText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        design: generatedDesign,
        suggestions: [
          'Affiner le texte du Slide 1',
          activeFmt === 'scroller' ? `Régénérer avec ${carouselSlidesCount === 5 ? 7 : 5} slides` : 'Passer en format Carrousel 4:5',
          'Exporter tout le carrousel en PNG HD',
        ],
      };

      setMessages((prev) => [...prev, aiMsg]);
      showToast(activeFmt === 'scroller' ? `Carrousel de ${carouselSlidesCount} slides généré !` : 'Nouveau design généré !');
    }, 1100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewDesign = () => {
    const newId = `sess_${Date.now()}`;
    const newSession: RecentSession = {
      id: newId,
      title: 'Nouveau Design Social',
      format: selectedFormat,
    };
    setRecentSessions([newSession, ...recentSessions]);
    setActiveSessionId(newId);
    setMessages([]); // Clears messages so Gemini greeting page is displayed!
    setSessionMessagesMap((prev) => ({ ...prev, [newId]: [] }));
    setInputPrompt('');
    setAttachedImages([]);
    showToast('Nouvelle session créée.');
  };

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    const msgs = sessionMessagesMap[sessionId] ?? (sessionId === 'sess_1' ? INITIAL_DEMO_MESSAGES : []);
    setMessages(msgs);
  };

  return (
    <div className="relative flex h-screen w-screen bg-transparent text-gray-900 font-sans overflow-hidden antialiased select-none">

      {/* ── Ambient background blobs (behind everything) ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Large deep-blue ambient base blob */}
        <div
          className="bg-ambient-blob animate-blob-1"
          style={{
            width: '650px',
            height: '650px',
            top: '-10%',
            left: '-8%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.20) 0%, rgba(30,58,86,0.08) 50%, transparent 70%)',
          }}
        />
        {/* Warm amber accent blob (right side) */}
        <div
          className="bg-ambient-blob animate-blob-2"
          style={{
            width: '500px',
            height: '500px',
            bottom: '5%',
            right: '-5%',
            background: 'radial-gradient(circle, rgba(245,158,11,0.13) 0%, rgba(234,88,12,0.05) 40%, transparent 70%)',
          }}
        />
        {/* Soft sky-blue mid-tone blob (center-right) */}
        <div
          className="bg-ambient-blob animate-blob-3"
          style={{
            width: '450px',
            height: '450px',
            top: '40%',
            right: '20%',
            background: 'radial-gradient(circle, rgba(14,165,233,0.12) 0%, rgba(30,58,86,0.05) 45%, transparent 70%)',
          }}
        />
        {/* Subtle warm rose/mauve blob (bottom-left) */}
        <div
          className="bg-ambient-blob animate-blob-pulse"
          style={{
            width: '350px',
            height: '350px',
            bottom: '15%',
            left: '10%',
            background: 'radial-gradient(circle, rgba(244,63,94,0.08) 0%, rgba(15,23,42,0.03) 50%, transparent 70%)',
            opacity: 0.6,
          }}
        />
        {/* Diffuse ambient glow behind main chat area (center) */}
        <div
          className="bg-ambient-blob animate-blob-pulse"
          style={{
            width: '900px',
            height: '700px',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(ellipse, rgba(59,130,246,0.06) 0%, transparent 65%)',
            filter: 'blur(120px)',
            opacity: 0.8,
          }}
        />
      </div>
      {/* ========================================================= */}
      {/* 1. PANNEAU GAUCHE (SIDEBAR - MENU & HISTORIQUE STYLE GEMINI) */}
      {/* ========================================================= */}
      <aside
        className={`${
          sidebarOpen ? 'w-64 sm:w-72' : 'w-0 -translate-x-full'
        } transition-all duration-300 ease-in-out h-full bg-gray-50 border-r border-gray-200/80 flex flex-col shrink-0 z-20 overflow-hidden`}
      >
        {/* En haut : Logo / Titre SaaS */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4 text-white stroke-[2.5]" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-gray-900 text-lg tracking-tight">Aura</span>
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
            <span>Nouveau design</span>
          </button>

          {/* Recherche */}
          <button
            onClick={() => showToast('Recherche dans vos designs...')}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-full hover:bg-gray-200/60 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
          >
            <Search className="w-4 h-4 text-gray-500" />
            <span>Recherche</span>
          </button>

          {/* Brand Kit */}
          <button
            onClick={() => setIsBrandKitOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-full hover:bg-gray-200/60 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
          >
            <Palette className="w-4 h-4 text-gray-500" />
            <span>Brand Kit</span>
          </button>

          {/* Templates */}
          <button
            onClick={() => setIsTemplatesOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-full hover:bg-gray-200/60 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
          >
            <LayoutTemplate className="w-4 h-4 text-gray-500" />
            <span>Templates</span>
          </button>
        </div>

        {/* Section "Récents" (Historique avec pills arrondis) */}
        <div className="flex-1 overflow-y-auto px-3 py-3 mt-1 space-y-1">
          <div className="px-3 pb-1 text-xs font-semibold text-gray-400 tracking-wider uppercase">
            Récents
          </div>

          {recentSessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <button
                key={session.id}
                onClick={() => {
                  handleSelectSession(session.id);
                  showToast(`Session "${session.title}" chargée`);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2 text-sm transition-all rounded-full text-left truncate group ${
                  isActive
                    ? 'bg-gray-200/90 text-gray-900 font-semibold shadow-xs'
                    : 'text-gray-600 hover:bg-gray-200/50 hover:text-gray-900 font-medium'
                }`}
              >
                <span className="truncate pr-2">{session.title}</span>
                <span className="text-[10px] text-gray-400 font-mono shrink-0">
                  {session.format === 'story' ? '9:16' : session.format === 'square' ? '1:1' : '4:5'}
                </span>
              </button>
            );
          })}
        </div>

        {/* En bas : Profil utilisateur "Labbaci Malek" avec avatar et réglages */}
        <div className="p-3 border-t border-gray-200/80 bg-gray-50/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5 truncate">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-900 to-gray-700 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
              L{userFirstName.charAt(0).toUpperCase()}
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-gray-900 truncate leading-tight">Labbaci {userFirstName}</p>
              <p className="text-[11px] text-gray-500 truncate">Plan Créateur Pro</p>
            </div>
          </div>

          <button
            onClick={() => setIsBrandKitOpen(true)}
            title="Paramètres du compte & Brand"
            className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition-colors shrink-0"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. PANNEAU CENTRAL (ZONE DE CHAT & ESPACE DE TRAVAIL BLANC) */}
      {/* ========================================================= */}
      <main className="flex-1 flex flex-col h-full bg-white relative min-w-0">
        {/* Top Header épuré style Gemini */}
        <header className="h-14 px-4 sm:px-6 flex items-center justify-between bg-white/90 backdrop-blur-xs z-10 shrink-0">
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

            {/* Sélecteur de modèle style Gemini */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full hover:bg-gray-100 text-gray-900 font-semibold text-sm cursor-pointer transition-colors border border-transparent hover:border-gray-200">
              <span className="font-extrabold tracking-tight">Aura 2.5 Social</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                showToast('Lien de partage copié dans le presse-papier !');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-gray-600" />
              <span className="hidden sm:inline">Partager</span>
            </button>
          </div>
        </header>

        {/* Flux de discussion (Au centre) */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-36 pt-4 flex flex-col">
          {messages.length === 0 ? (
            /* ========================================================= */
            /* PAGE D'ACCUEIL NOUVEAU DESIGN STYLE GEMINI */
            /* ========================================================= */
            <div className="flex-1 flex flex-col justify-center max-w-3xl mx-auto w-full py-6 sm:py-10 my-auto animate-fade-in">
              {/* Message de salutation style Gemini avec prénom */}
              <div className="space-y-2 mb-8 sm:mb-10">
                <div className="flex items-center gap-3">
                  <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-500">
                      {greetingSalutation}, {userFirstName}
                    </span>
                  </h1>
                  <button
                    onClick={() => {
                      const newName = prompt('Personnaliser votre prénom (affiché sur l\'accueil) :', userFirstName);
                      if (newName && newName.trim()) {
                        const trimmed = newName.trim();
                        setUserFirstName(trimmed);
                        localStorage.setItem('aura_user_firstname', trimmed);
                        showToast(`Prénom mis à jour : ${trimmed}`);
                      }
                    }}
                    title="Modifier votre prénom"
                    className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                  >
                    <Sliders className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-300 tracking-tight">
                  On fait quoi aujourd'hui ?
                </p>
                <p className="text-sm sm:text-base text-gray-500 pt-1 font-medium">
                  Qu'allons-nous créer aujourd'hui ? Générez un carrousel LinkedIn, une story Instagram ou un post avec vos photos en quelques secondes.
                </p>
              </div>

              {/* Cartes de suggestions interactives (Style Gemini) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full">
                {welcomeSuggestions.map((card, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedFormat(card.format);
                      if (card.slidesCount) setCarouselSlidesCount(card.slidesCount);
                      handleSendMessage(card.prompt);
                    }}
                    className="group text-left p-4 sm:p-5 rounded-3xl bg-gray-50/90 hover:bg-gray-100 border border-gray-200/90 hover:border-gray-300 transition-all shadow-2xs hover:shadow-xs flex flex-col justify-between h-40 cursor-pointer relative"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[11px] font-mono font-bold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full">
                          {card.badge}
                        </span>
                        <div className="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-2xs flex items-center justify-center text-gray-600 group-hover:text-amber-600 group-hover:scale-105 transition-all">
                          {card.icon}
                        </div>
                      </div>
                      <h3 className="text-sm font-bold text-gray-900 group-hover:text-amber-700 transition-colors line-clamp-1">
                        {card.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                        {card.prompt}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 group-hover:text-gray-700 transition-colors pt-1">
                      <span>Créer ce design</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                ))}
              </div>
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
                            <span className="text-[11px] text-gray-400 font-mono">{msg.timestamp}</span>
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
                                  <span className="px-2.5 py-1 rounded-full bg-zinc-900 text-amber-400 font-mono text-[11px] font-bold border border-amber-500/30">
                                    {msg.design.format === 'story'
                                      ? 'Story 9:16'
                                      : msg.design.format === 'square'
                                      ? 'Carré 1:1'
                                      : 'Carrousel 4:5'}
                                  </span>
                                  <span className="text-zinc-400 text-xs font-medium">
                                    Slide {(msg.design.activeSlideIndex || 0) + 1} sur {msg.design.slides.length}
                                  </span>
                                </div>

                                {/* Actions d'export & copie */}
                                <div className="flex items-center gap-1.5">
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

                                  <button
                                    onClick={() =>
                                      handleExportSlide(
                                        msg.design!.title,
                                        (msg.design!.activeSlideIndex || 0) + 1,
                                        msg.design!.slides[msg.design!.activeSlideIndex || 0].image
                                      )
                                    }
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-xs tracking-wide transition-all shadow-sm cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>PNG HD</span>
                                  </button>
                                </div>
                              </div>

                              {/* Le Canvas Visuel Actif avec transition animée des slides */}
                              {(() => {
                                const slide = msg.design.slides[msg.design.activeSlideIndex || 0];
                                const isStory = msg.design.format === 'story';
                                const isSquare = msg.design.format === 'square';

                                return (
                                  <div
                                    className={`my-4 mx-auto w-full transition-all duration-300 ${
                                      isStory
                                        ? 'aspect-[9/14] max-w-sm'
                                        : isSquare
                                        ? 'aspect-square max-w-md'
                                        : 'aspect-[4/5] max-w-md'
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
                                            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-black font-extrabold text-[10px] overflow-hidden">
                                              {brandLogo ? (
                                                <img src={brandLogo} alt="Logo" className="w-full h-full object-contain p-0.5" />
                                              ) : (
                                                brandName.slice(0, 2).toUpperCase()
                                              )}
                                            </div>
                                            <span className="text-xs font-extrabold tracking-wider text-white uppercase">
                                              {brandName}
                                            </span>
                                          </div>

                                          <div className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                            {String(slide.slideNumber).padStart(2, '0')} /{' '}
                                            {String(msg.design.slides.length).padStart(2, '0')}
                                          </div>
                                        </div>

                                        {/* Slide Middle Content */}
                                        <div className="relative z-10 my-auto py-4 space-y-3">
                                          <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400">
                                              {slide.tag}
                                            </span>
                                          </div>

                                          {/* Big Hook Headline */}
                                          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-tight">
                                            {slide.highlightWord && slide.title.includes(slide.highlightWord) ? (
                                              <>
                                                {slide.title.split(slide.highlightWord)[0]}
                                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 underline decoration-amber-500/40 underline-offset-4">
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
                                              <div className="text-3xl font-extrabold font-mono text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
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
                                          <div className="flex items-center gap-1 text-zinc-400 font-mono">
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
                                onClick={() => handleSendMessage(sug)}
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
                              onClick={() => showToast('Merci pour votre feedback positif !')}
                              className="p-1 rounded-full hover:bg-gray-100 hover:text-gray-700 transition-colors"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => showToast('Feedback enregistré.')}
                              className="p-1 rounded-full hover:bg-gray-100 hover:text-gray-700 transition-colors"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(msg.text);
                                showToast('Texte copié !');
                              }}
                              className="p-1 rounded-full hover:bg-gray-100 hover:text-gray-700 transition-colors"
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
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                      <span>Génération et mise en page du visuel dans le Canvas...</span>
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
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-none">
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
            <div className="relative flex flex-col bg-gray-50 hover:bg-gray-100/90 focus-within:bg-white rounded-3xl sm:rounded-full px-3 py-2 border border-gray-200/90 shadow-md focus-within:shadow-lg focus-within:border-gray-300 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all">
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
                  placeholder={
                    selectedFormat === 'scroller'
                      ? `Demander à l'IA... (Carrousel de ${carouselSlidesCount} slides)`
                      : "Demander à l'IA... (ex: Crée un post percutant sur la productivité)"
                  }
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
                        {selectedFormat === 'story' ? '9:16' : selectedFormat === 'square' ? '1:1' : '4:5'}
                      </span>
                      <ChevronDown className="w-3 h-3 text-gray-400" />
                    </button>

                    {/* Menu déroulant format */}
                    {isFormatDropdownOpen && (
                      <div className="absolute right-0 bottom-12 w-48 rounded-2xl bg-white border border-gray-200 shadow-xl p-1.5 z-30 space-y-1">
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
                  {selectedFormat === 'scroller' && (
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
            </div>

            {/* Disclaimer en bas */}
            <p className="text-[11px] text-gray-400 text-center mt-2 font-normal">
              Aura AI génère des visuels optimisés pour LinkedIn, Instagram et X. Vérifiez les textes avant publication.
            </p>
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
                  <h3 className="font-extrabold text-gray-900 text-base">Configuration Brand Kit</h3>
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
                    Votre prénom (Salutation Gemini)
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
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:border-amber-500"
                    placeholder="@votrecompte"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                    Couleur d'accentuation
                  </label>
                  <div className="flex items-center gap-2">
                    {['#F59E0B', '#EA580C', '#EAB308', '#F97316'].map((color) => (
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
                  onClick={() => setIsBrandKitOpen(false)}
                  className="px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL TEMPLATES */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isTemplatesOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-2xs p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-lg p-6 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="w-5 h-5 text-amber-500" />
                  <h3 className="font-extrabold text-gray-900 text-base">Templates Prêts à l'Emploi</h3>
                </div>
                <button
                  onClick={() => setIsTemplatesOpen(false)}
                  className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                {[
                  {
                    title: 'Carrousel Hacks B2B',
                    format: 'Carrousel 4:5',
                    prompt: 'Génère un carrousel 5 slides sur les erreurs fatales des startups en phase de scaling.',
                  },
                  {
                    title: 'Story Teaser Masterclass',
                    format: 'Story 9:16',
                    prompt: 'Génère une story teaser pour une masterclass IA jeudi à 18h avec compte à rebours.',
                  },
                  {
                    title: 'Poster Citation Minimaliste',
                    format: 'Carré 1:1',
                    prompt: 'Crée un post carré percutant avec une citation de Steve Jobs sur le focus et la discipline.',
                  },
                  {
                    title: 'Carrousel Avant / Après',
                    format: 'Carrousel 4:5',
                    prompt: 'Génère un comparatif avant/après en 4 slides sur l\'optimisation de temps avec l\'IA.',
                  },
                ].map((tpl, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setIsTemplatesOpen(false);
                      handleSendMessage(tpl.prompt);
                    }}
                    className="p-3.5 rounded-2xl border border-gray-200 hover:border-amber-500/50 hover:bg-amber-50/30 transition-all cursor-pointer space-y-1.5 group"
                  >
                    <span className="text-[10px] font-mono font-bold text-amber-600 uppercase">
                      {tpl.format}
                    </span>
                    <h4 className="text-xs font-bold text-gray-900 group-hover:text-amber-800">
                      {tpl.title}
                    </h4>
                    <p className="text-[11px] text-gray-500 line-clamp-2">{tpl.prompt}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* TOAST NOTIFICATION FLOTTANT */}
      {/* ========================================================= */}
      {toastMessage && (
        <div className="fixed bottom-24 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-gray-900 text-white shadow-xl text-xs font-medium animate-fade-in">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
