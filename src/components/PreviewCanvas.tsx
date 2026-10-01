import React, { useState, useRef } from 'react';
import { 
  Download, 
  Share2, 
  Copy, 
  ChevronLeft, 
  ChevronRight, 
  Grid3X3, 
  Edit3, 
  Eye, 
  Check, 
  Maximize2, 
  Sparkles, 
  Plus, 
  Sliders, 
  FileCode,
  Image as ImageIcon,
  CheckCircle2,
  Bookmark
} from 'lucide-react';
import { DesignProject, SlideData, BrandKit, FormatType } from '../types';

interface PreviewCanvasProps {
  project: DesignProject;
  brandKit: BrandKit;
  onUpdateSlide: (slideIndex: number, updated: Partial<SlideData>) => void;
  onAddSlide: () => void;
  onSelectSlide: (index: number) => void;
  onShowToast: (message: string) => void;
}

export const PreviewCanvas: React.FC<PreviewCanvasProps> = ({
  project,
  brandKit,
  onUpdateSlide,
  onAddSlide,
  onSelectSlide,
  onShowToast,
}) => {
  const [zoomLevel, setZoomLevel] = useState<'fit' | '75%' | '100%'>('fit');
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const currentSlide = project.slides[project.currentSlideIndex] || project.slides[0];
  const totalSlides = project.slides.length;

  const canvasRef = useRef<HTMLDivElement>(null);

  // Format dimensions
  const formatSpecs: Record<FormatType, { label: string; ratio: string; w: number; h: number; containerClass: string }> = {
    scroller: {
      label: 'Portrait Scroller (4:5)',
      ratio: '4/5',
      w: 1080,
      h: 1350,
      containerClass: 'aspect-[4/5] max-h-[640px] w-auto',
    },
    story: {
      label: 'Vertical Story (9:16)',
      ratio: '9/16',
      w: 1080,
      h: 1920,
      containerClass: 'aspect-[9/16] max-h-[700px] w-auto',
    },
    square: {
      label: 'Square Post (1:1)',
      ratio: '1/1',
      w: 1080,
      h: 1080,
      containerClass: 'aspect-square max-h-[580px] w-auto',
    },
  };

  const currentFormat = formatSpecs[project.format];

  // Navigation handlers
  const handlePrevSlide = () => {
    if (project.currentSlideIndex > 0) {
      onSelectSlide(project.currentSlideIndex - 1);
    }
  };

  const handleNextSlide = () => {
    if (project.currentSlideIndex < totalSlides - 1) {
      onSelectSlide(project.currentSlideIndex + 1);
    }
  };

  // Export handlers
  const handleExportPNG = () => {
    onShowToast(`Exportation PNG HD (1080x${currentFormat.h}px) en cours...`);
    setTimeout(() => {
      // Create a downloadable canvas representation
      const element = document.createElement('a');
      element.setAttribute('href', currentSlide.image || '/src/assets/images/social_abstract_accent_1790812839231.jpg');
      element.setAttribute('download', `${project.title.replace(/\s+/g, '_')}_slide_${currentSlide.slideNumber}.png`);
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      onShowToast(`Slide #${currentSlide.slideNumber} téléchargé en Haute Définition !`);
    }, 600);
  };

  const handleCopyCode = () => {
    const slideJson = JSON.stringify(
      {
        projectTitle: project.title,
        format: project.format,
        slideNumber: currentSlide.slideNumber,
        tag: currentSlide.tag,
        title: currentSlide.title,
        subtitle: currentSlide.subtitle,
        bullets: currentSlide.bulletPoints,
        stat: currentSlide.stat,
        brandKit: {
          name: brandKit.name,
          handle: brandKit.handle,
          primaryColor: brandKit.primaryColor,
        },
      },
      null,
      2
    );

    navigator.clipboard.writeText(slideJson);
    setCopiedCode(true);
    onShowToast('Données et structure du slide copiées dans le presse-papier !');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    onShowToast('Lien de prévisualisation copié !');
  };

  // Helper to render headline with highlight
  const renderStyledTitle = () => {
    if (!currentSlide.highlightWord || !currentSlide.title.includes(currentSlide.highlightWord)) {
      return currentSlide.title;
    }

    const parts = currentSlide.title.split(currentSlide.highlightWord);
    return (
      <>
        {parts[0]}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 font-extrabold decoration-amber-500/50 underline underline-offset-4 decoration-2">
          {currentSlide.highlightWord}
        </span>
        {parts[1]}
      </>
    );
  };

  return (
    <aside className="w-[520px] 2xl:w-[580px] h-full bg-zinc-950 flex flex-col shrink-0 text-white select-none border-l border-zinc-800/80">
      {/* Top Action Bar */}
      <div className="h-14 px-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="font-mono text-zinc-300 font-semibold">{currentFormat.label}</span>
          </div>

          <span className="text-[11px] font-mono text-zinc-500">
            {currentFormat.w} × {currentFormat.h}px
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {/* Toggle safe zones */}
          <button
            onClick={() => setShowSafeZones(!showSafeZones)}
            title="Afficher les safe zones Instagram / TikTok"
            className={`p-1.5 rounded-lg border text-xs transition-colors ${
              showSafeZones
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border-zinc-800'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
          </button>

          {/* Toggle direct editor mode */}
          <button
            onClick={() => setIsEditingInline(!isEditingInline)}
            title="Activer l'édition directe de texte"
            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold transition-colors ${
              isEditingInline
                ? 'bg-amber-500 text-black border-amber-400'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border-zinc-800'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditingInline ? 'Édition ON' : 'Éditer'}</span>
          </button>

          {/* Copy JSON */}
          <button
            onClick={handleCopyCode}
            title="Copier la structure JSON"
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-amber-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Export PNG */}
          <button
            onClick={handleExportPNG}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black text-xs font-extrabold tracking-wide shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>EXPORT PNG</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas Display Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden bg-gradient-to-b from-zinc-950 via-black to-zinc-950">
        {/* Subtle grid pattern background */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#F59E0B 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />

        {/* Ambient Amber Glow behind canvas */}
        <div className="absolute w-96 h-96 rounded-full bg-amber-500/[0.04] blur-3xl pointer-events-none -top-10" />

        {/* Canvas Frame Container */}
        <div
          ref={canvasRef}
          className={`relative rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.85)] border border-zinc-800/90 transition-all duration-300 ${currentFormat.containerClass} flex flex-col justify-between`}
          style={{
            backgroundColor: brandKit.backgroundColor || '#09090B',
            fontFamily: brandKit.fontFamily,
          }}
        >
          {/* Optional Background visual image */}
          {currentSlide.image && currentSlide.imagePosition === 'background' && (
            <div className="absolute inset-0 z-0">
              <img
                src={currentSlide.image}
                alt="Slide background visual"
                className="w-full h-full object-cover opacity-30 mix-blend-luminosity filter contrast-125"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-zinc-950/90 to-black/80" />
            </div>
          )}

          {/* Safe Zones Overlay (for Instagram / TikTok preview) */}
          {showSafeZones && (
            <div className="absolute inset-0 pointer-events-none z-40 border-2 border-dashed border-amber-500/40 m-4 rounded-xl flex flex-col justify-between p-2">
              <span className="text-[10px] font-mono text-amber-400 bg-black/80 px-1.5 py-0.5 rounded self-start">
                Safe Zone Header (15%)
              </span>
              <span className="text-[10px] font-mono text-amber-400 bg-black/80 px-1.5 py-0.5 rounded self-end">
                Safe Zone CTA (20%)
              </span>
            </div>
          )}

          {/* Slide Content Layer */}
          <div className="relative z-10 p-6 md:p-8 flex flex-col justify-between h-full">
            {/* 1. Header: Brand Logo & Slide Counter */}
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
              {brandKit.showLogo && (
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-black font-extrabold text-xs shadow-sm">
                    {brandKit.logoUrl ? (
                      <img src={brandKit.logoUrl} alt="Logo" className="w-5 h-5 object-contain" />
                    ) : (
                      brandKit.name.slice(0, 2).toUpperCase() || 'AU'
                    )}
                  </div>
                  <span className="text-xs font-extrabold tracking-wider text-white uppercase">
                    {brandKit.name}
                  </span>
                </div>
              )}

              {brandKit.showSlideNumber && totalSlides > 1 && (
                <div className="text-[11px] font-mono font-bold tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  {String(currentSlide.slideNumber).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
                </div>
              )}
            </div>

            {/* 2. Middle: Content & Visuals */}
            <div className="my-auto py-4 space-y-4">
              {/* Category Kicker / Tag */}
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {isEditingInline ? (
                  <input
                    type="text"
                    value={currentSlide.tag}
                    onChange={(e) => onUpdateSlide(project.currentSlideIndex, { tag: e.target.value })}
                    className="bg-zinc-900/90 text-amber-400 text-xs font-mono tracking-wider uppercase px-2 py-0.5 rounded border border-amber-500/50 w-full"
                  />
                ) : (
                  <span className="text-xs font-mono font-bold tracking-wider text-amber-400 uppercase">
                    {currentSlide.tag}
                  </span>
                )}
              </div>

              {/* Main Headline (Ultimate Font style) */}
              {isEditingInline ? (
                <textarea
                  rows={2}
                  value={currentSlide.title}
                  onChange={(e) => onUpdateSlide(project.currentSlideIndex, { title: e.target.value })}
                  className="w-full bg-zinc-900/90 text-white font-extrabold text-xl md:text-2xl tracking-tight p-2 rounded-lg border border-amber-500/50 resize-none"
                />
              ) : (
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-[1.15]">
                  {renderStyledTitle()}
                </h1>
              )}

              {/* Subtitle / Context */}
              {isEditingInline ? (
                <textarea
                  rows={2}
                  value={currentSlide.subtitle}
                  onChange={(e) => onUpdateSlide(project.currentSlideIndex, { subtitle: e.target.value })}
                  className="w-full bg-zinc-900/90 text-zinc-300 text-xs md:text-sm p-2 rounded-lg border border-amber-500/50 resize-none"
                />
              ) : (
                <p className="text-zinc-300 text-xs md:text-sm leading-relaxed font-medium">
                  {currentSlide.subtitle}
                </p>
              )}

              {/* Stat Callout variation if present */}
              {currentSlide.stat && (
                <div className="p-4 rounded-xl bg-zinc-900/80 border border-amber-500/30 shadow-[0_4px_20px_rgba(245,158,11,0.08)] my-3">
                  <div className="text-3xl md:text-4xl font-extrabold font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500">
                    {currentSlide.stat.value}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1 font-medium">
                    {currentSlide.stat.label}
                  </div>
                </div>
              )}

              {/* Bullet points if present */}
              {currentSlide.bulletPoints && currentSlide.bulletPoints.length > 0 && (
                <div className="space-y-2 pt-1">
                  {currentSlide.bulletPoints.map((bullet, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs md:text-sm text-zinc-200">
                      <div className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 text-amber-400 stroke-[3]" />
                      </div>
                      <span className="leading-snug">{bullet}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Contained image preview if bottom or center */}
              {currentSlide.image && currentSlide.imagePosition === 'bottom' && (
                <div className="rounded-xl overflow-hidden border border-zinc-800/80 mt-2 max-h-36">
                  <img
                    src={currentSlide.image}
                    alt="Visual illustration"
                    className="w-full h-full object-cover filter contrast-110"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
            </div>

            {/* 3. Footer: Handle & CTA Action */}
            <div className="border-t border-zinc-800/60 pt-4 flex items-center justify-between">
              {brandKit.showHandle && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono font-medium">
                  <span className="text-amber-400">@</span>
                  <span className="text-white">{brandKit.handle.replace('@', '')}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20 inline" />
                </div>
              )}

              {currentSlide.ctaText && (
                <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/25">
                  <span>{currentSlide.ctaText}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Slide Navigation & Thumbnails Drawer (Bottom Bar) */}
      <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/95 space-y-2 shrink-0">
        <div className="flex items-center justify-between text-xs px-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white tracking-tight">Carrousel Slides</span>
            <span className="text-[11px] font-mono text-zinc-500">
              ({project.currentSlideIndex + 1} sur {totalSlides})
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevSlide}
              disabled={project.currentSlideIndex === 0}
              className={`p-1 rounded-md border text-xs transition-colors ${
                project.currentSlideIndex === 0
                  ? 'bg-zinc-950 text-zinc-600 border-zinc-900 cursor-not-allowed'
                  : 'bg-zinc-900 text-zinc-300 hover:text-white border-zinc-800 hover:border-amber-500/40 cursor-pointer'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextSlide}
              disabled={project.currentSlideIndex === totalSlides - 1}
              className={`p-1 rounded-md border text-xs transition-colors ${
                project.currentSlideIndex === totalSlides - 1
                  ? 'bg-zinc-950 text-zinc-600 border-zinc-900 cursor-not-allowed'
                  : 'bg-zinc-900 text-zinc-300 hover:text-white border-zinc-800 hover:border-amber-500/40 cursor-pointer'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={onAddSlide}
              title="Ajouter un slide"
              className="flex items-center gap-1 ml-2 px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-amber-400 hover:text-amber-300 rounded-md text-xs font-semibold cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Slide</span>
            </button>
          </div>
        </div>

        {/* Thumbnails Row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
          {project.slides.map((slide, idx) => {
            const isSelected = idx === project.currentSlideIndex;
            return (
              <button
                key={slide.id}
                onClick={() => onSelectSlide(idx)}
                className={`group relative shrink-0 w-24 h-16 rounded-lg p-1.5 text-left border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-amber-500 bg-zinc-900 ring-2 ring-amber-500/30'
                    : 'border-zinc-800/80 bg-zinc-950 hover:bg-zinc-900/60'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className={isSelected ? 'text-amber-400 font-bold' : 'text-zinc-500'}>
                    #{slide.slideNumber}
                  </span>
                  {slide.stat && <span className="text-[9px] text-amber-500 font-bold">Stat</span>}
                </div>
                <div className="text-[10px] text-zinc-300 font-bold tracking-tight line-clamp-1">
                  {slide.title}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
