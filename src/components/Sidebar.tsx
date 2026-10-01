import React, { useState } from 'react';
import { 
  Sparkles, 
  Plus, 
  History, 
  Palette, 
  Trash2, 
  Bookmark, 
  Search, 
  Check, 
  Sliders, 
  ArrowUpRight,
  ShieldCheck,
  Upload,
  UserCheck
} from 'lucide-react';
import { Session, BrandKit, FormatType } from '../types';

interface SidebarProps {
  sessions: Session[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  brandKit: BrandKit;
  onUpdateBrandKit: (updated: Partial<BrandKit>) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  brandKit,
  onUpdateBrandKit,
}) => {
  const [activeTab, setActiveTab] = useState<'sessions' | 'brandkit'>('sessions');
  const [searchQuery, setSearchQuery] = useState('');
  const [customLogoInput, setCustomLogoInput] = useState('');

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.previewText.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatLabels: Record<FormatType, string> = {
    scroller: '4:5 Carrousel',
    story: '9:16 Story',
    square: '1:1 Carré',
  };

  const presetAmberColors = [
    { label: 'Ambre Radiant', primary: '#F59E0B', secondary: '#EA580C' },
    { label: 'Orange Solaire', primary: '#FB923C', secondary: '#C2410C' },
    { label: 'Or Chaud', primary: '#FACC15', secondary: '#D97706' },
    { label: 'Tangerine Pure', primary: '#F97316', secondary: '#9A3412' },
  ];

  const presetBackgrounds = [
    { label: 'Noir Pur', color: '#000000' },
    { label: 'Zinc 950', color: '#09090B' },
    { label: 'Graphite Sombre', color: '#121214' },
  ];

  const fontOptions = [
    { name: 'Manrope', label: 'Manrope (Défaut)' },
    { name: 'Poppins', label: 'Poppins Rounded' },
    { name: 'JetBrains Mono', label: 'Monospace Minimal' },
  ];

  return (
    <aside className="w-80 h-full bg-zinc-950 border-r border-zinc-800/80 flex flex-col shrink-0 select-none text-zinc-300">
      {/* Brand Header */}
      <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.25)]">
            <Sparkles className="w-4 h-4 text-black font-extrabold stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-white text-base tracking-tight leading-none">Aura Studio</span>
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 font-medium mt-0.5">Social Media AI Canvas</p>
          </div>
        </div>

        <button
          onClick={onNewSession}
          title="Créer un nouveau design"
          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-400 hover:text-amber-300 border border-zinc-800 hover:border-amber-500/40 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Action Button */}
      <div className="p-3">
        <button
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-xs tracking-wide shadow-[0_4px_20px_rgba(245,158,11,0.2)] transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>NOUVEAU DESIGN SOCIAL</span>
        </button>
      </div>

      {/* Navigation Tabs (Sessions / Brand Kit) */}
      <div className="px-3 pb-2">
        <div className="grid grid-cols-2 p-1 bg-zinc-900/90 rounded-lg border border-zinc-800/80 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md transition-all ${
              activeTab === 'sessions'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/50'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span>Historique</span>
          </button>
          <button
            onClick={() => setActiveTab('brandkit')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md transition-all ${
              activeTab === 'brandkit'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/50'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-amber-400" />
            <span>Brand Kit</span>
          </button>
        </div>
      </div>

      {/* Tab Content 1: Sessions History */}
      {activeTab === 'sessions' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Search bar */}
          <div className="px-3 py-1.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une création..."
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 transition-colors"
              />
            </div>
          </div>

          {/* Sessions list */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 px-1 mb-1">
              Sessions Récentes ({filteredSessions.length})
            </div>

            {filteredSessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <div
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={`group relative p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-zinc-900/90 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.08)] text-white'
                      : 'bg-zinc-900/40 hover:bg-zinc-900/70 border-zinc-800/60 text-zinc-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-white tracking-tight line-clamp-1">
                      {session.title}
                    </h4>
                    {session.isPinned && (
                      <Bookmark className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0 mt-0.5" />
                    )}
                  </div>

                  <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                    {session.previewText}
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800/40 text-[10px] text-zinc-500 font-mono">
                    <span className="text-amber-400/90 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      {formatLabels[session.format]}
                    </span>
                    <span>{session.lastUpdated}</span>
                  </div>

                  {/* Delete button on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    title="Supprimer la session"
                    className="absolute right-2 top-2 p-1 rounded bg-zinc-900 text-zinc-500 hover:text-red-400 border border-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            {filteredSessions.length === 0 && (
              <div className="text-center py-8 text-zinc-500 text-xs">
                Aucune création trouvée.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content 2: Brand Kit Configuration */}
      {activeTab === 'brandkit' && (
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
          <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white tracking-tight">Logo & Identifiant</span>
              <span className="text-[10px] text-amber-400 font-mono">Synchronisé</span>
            </div>

            {/* Logo Preview & Input */}
            <div className="space-y-2">
              <label className="text-[11px] text-zinc-400 block font-medium">Nom de marque</label>
              <input
                type="text"
                value={brandKit.name}
                onChange={(e) => onUpdateBrandKit({ name: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                placeholder="Ex: AURA STUDIO"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] text-zinc-400 block font-medium">Handle Social Media</label>
              <input
                type="text"
                value={brandKit.handle}
                onChange={(e) => onUpdateBrandKit({ handle: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                placeholder="@votrecompte"
              />
            </div>

            {/* Quick Logo URL / Monogram */}
            <div className="space-y-2">
              <label className="text-[11px] text-zinc-400 block font-medium">Logo URL ou Icône SVG</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customLogoInput}
                  onChange={(e) => setCustomLogoInput(e.target.value)}
                  placeholder="https://... ou vide pour monogramme"
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 truncate"
                />
                <button
                  onClick={() => {
                    if (customLogoInput.trim()) {
                      onUpdateBrandKit({ logoUrl: customLogoInput.trim() });
                      setCustomLogoInput('');
                    }
                  }}
                  className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg cursor-pointer transition-colors"
                >
                  OK
                </button>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-extrabold text-xs">
                  {brandKit.logoUrl ? (
                    <img 
                      src={brandKit.logoUrl} 
                      alt="Logo" 
                      className="w-6 h-6 object-contain"
                      referrerPolicy="no-referrer"
                      onError={() => onUpdateBrandKit({ logoUrl: '' })}
                    />
                  ) : (
                    brandKit.name.slice(0, 2).toUpperCase() || 'AU'
                  )}
                </div>
                <span className="text-[11px] text-zinc-400">
                  {brandKit.logoUrl ? 'Logo personnalisé chargé' : 'Monogramme vectoriel par défaut'}
                </span>
              </div>
            </div>

            {/* Toggles */}
            <div className="pt-2 border-t border-zinc-800 space-y-2">
              <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
                <span>Afficher le logo en entête</span>
                <input
                  type="checkbox"
                  checked={brandKit.showLogo}
                  onChange={(e) => onUpdateBrandKit({ showLogo: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
                <span>Afficher le @handle au footer</span>
                <input
                  type="checkbox"
                  checked={brandKit.showHandle}
                  onChange={(e) => onUpdateBrandKit({ showHandle: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
                <span>Indicateur de slide (01 / 04)</span>
                <input
                  type="checkbox"
                  checked={brandKit.showSlideNumber}
                  onChange={(e) => onUpdateBrandKit({ showSlideNumber: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Brand Palette */}
          <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/80 space-y-3">
            <span className="text-xs font-bold text-white tracking-tight block">Palette Couleurs de Marque</span>
            <div className="space-y-2">
              {presetAmberColors.map((palette, idx) => {
                const isSelected = brandKit.primaryColor === palette.primary;
                return (
                  <button
                    key={idx}
                    onClick={() =>
                      onUpdateBrandKit({
                        primaryColor: palette.primary,
                        secondaryColor: palette.secondary,
                      })
                    }
                    className={`w-full flex items-center justify-between p-2 rounded-lg border transition-all text-xs ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 text-white'
                        : 'border-zinc-800/80 bg-zinc-950/60 text-zinc-400 hover:text-white hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex items-center -space-x-1">
                        <span
                          className="w-4 h-4 rounded-full border border-black shadow-sm"
                          style={{ backgroundColor: palette.primary }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-black shadow-sm"
                          style={{ backgroundColor: palette.secondary }}
                        />
                      </div>
                      <span className="font-medium text-xs">{palette.label}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </button>
                );
              })}
            </div>

            {/* Background Tone */}
            <div className="pt-2 border-t border-zinc-800 space-y-1.5">
              <label className="text-[11px] text-zinc-400 block font-medium">Teinte de Fond du Canvas</label>
              <div className="grid grid-cols-3 gap-1.5">
                {presetBackgrounds.map((bg, idx) => (
                  <button
                    key={idx}
                    onClick={() => onUpdateBrandKit({ backgroundColor: bg.color })}
                    className={`py-1.5 px-2 rounded-md border text-[11px] font-medium transition-all ${
                      brandKit.backgroundColor === bg.color
                        ? 'border-amber-500 text-amber-400 bg-zinc-900'
                        : 'border-zinc-800 text-zinc-400 hover:text-white bg-zinc-950'
                    }`}
                  >
                    {bg.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Typography Choice */}
          <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/80 space-y-2">
            <span className="text-xs font-bold text-white tracking-tight block">Typographie d'Accroche</span>
            <div className="space-y-1">
              {fontOptions.map((font, idx) => (
                <button
                  key={idx}
                  onClick={() => onUpdateBrandKit({ fontFamily: font.name })}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs transition-all flex items-center justify-between ${
                    brandKit.fontFamily === font.name
                      ? 'border-amber-500 text-white bg-amber-500/10'
                      : 'border-zinc-800 text-zinc-400 hover:text-white bg-zinc-950/40'
                  }`}
                >
                  <span className="font-semibold">{font.label}</span>
                  {brandKit.fontFamily === font.name && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer User / Plan Status */}
      <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-zinc-900 border border-amber-500/40 flex items-center justify-center text-[11px] font-bold text-amber-400">
              AL
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-none">Abdelmalek L.</p>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">abdelmalek@growth.io</p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
            Pro Active
          </span>
        </div>
      </div>
    </aside>
  );
};
