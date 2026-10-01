import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  Smartphone, 
  Square, 
  Layers, 
  Maximize, 
  ChevronRight, 
  RefreshCw,
  Copy,
  Check,
  Zap,
  SlidersHorizontal,
  Lightbulb
} from 'lucide-react';
import { ChatMessage, FormatType, ContentType, DesignProject } from '../types';
import { QUICK_TEMPLATES } from '../data/mockData';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentProject: DesignProject;
  onSendMessage: (text: string, format: FormatType, contentType: ContentType) => void;
  onSelectFormat: (format: FormatType) => void;
  onApplyTemplatePrompt: (prompt: string, format: FormatType, type: ContentType) => void;
  isGenerating: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  currentProject,
  onSendMessage,
  onSelectFormat,
  onApplyTemplatePrompt,
  isGenerating,
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<FormatType>(currentProject.format);
  const [selectedContentType, setSelectedContentType] = useState<ContentType>(currentProject.contentType);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSelectedFormat(currentProject.format);
  }, [currentProject.format]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleSend = () => {
    if (!inputText.trim() || isGenerating) return;
    onSendMessage(inputText.trim(), selectedFormat, selectedContentType);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFormatClick = (fmt: FormatType) => {
    setSelectedFormat(fmt);
    onSelectFormat(fmt);
  };

  const copyMessageContent = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <section className="flex-1 flex flex-col h-full bg-zinc-950 border-r border-zinc-800/80 min-w-0">
      {/* Top Header of Chat Area */}
      <div className="h-14 px-5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/60 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-extrabold text-white tracking-tight truncate max-w-sm">
              {currentProject.title}
            </h2>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-zinc-900 text-amber-400 border border-amber-500/30">
              {currentProject.format === 'scroller' ? '4:5 Carrousel' : currentProject.format === 'story' ? '9:16 Story' : '1:1 Carré'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-mono text-[11px] text-zinc-300">Aura-Vision 2.5 Active</span>
          </div>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        {messages.map((message) => {
          const isAssistant = message.sender === 'assistant';

          return (
            <div
              key={message.id}
              className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'} max-w-2xl ${
                isAssistant ? 'mr-auto' : 'ml-auto'
              }`}
            >
              {/* Header of message */}
              <div className="flex items-center gap-2 mb-1.5 px-1">
                {isAssistant ? (
                  <>
                    <div className="w-5 h-5 rounded-md bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                    </div>
                    <span className="text-xs font-bold text-white tracking-tight">Aura AI Copilot</span>
                  </>
                ) : (
                  <span className="text-xs font-bold text-zinc-400">Vous</span>
                )}
                <span className="text-[11px] text-zinc-500 font-mono">{message.timestamp}</span>
              </div>

              {/* Message Bubble */}
              <div
                className={`relative group rounded-2xl p-4 text-sm leading-relaxed ${
                  isAssistant
                    ? 'bg-zinc-900/80 border border-zinc-800/80 text-zinc-200 shadow-sm'
                    : 'bg-zinc-800/90 border border-amber-500/40 text-white shadow-[0_0_15px_rgba(245,158,11,0.06)]'
                }`}
              >
                <div className="whitespace-pre-line space-y-2">
                  {message.content}
                </div>

                {/* Quick copy affordance for Assistant */}
                {isAssistant && (
                  <button
                    onClick={() => copyMessageContent(message.id, message.content)}
                    className="absolute top-3 right-3 p-1 rounded-md text-zinc-500 hover:text-amber-400 bg-zinc-950/60 border border-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Copier le texte"
                  >
                    {copiedId === message.id ? (
                      <Check className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>

              {/* Suggestions Chips from Assistant */}
              {isAssistant && message.suggestedPrompts && message.suggestedPrompts.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 pl-1">
                  {message.suggestedPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSendMessage(prompt, selectedFormat, selectedContentType)}
                      className="text-xs py-1 px-2.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-850 hover:border-amber-500/50 text-zinc-300 hover:text-white border border-zinc-800 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>{prompt}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Loading generation indicator */}
        {isGenerating && (
          <div className="flex flex-col items-start mr-auto max-w-xl">
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <div className="w-5 h-5 rounded-md bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />
              </div>
              <span className="text-xs font-bold text-white">Génération du design en temps réel...</span>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-900/90 border border-amber-500/30 flex items-center gap-3 text-sm text-zinc-300">
              <div className="flex space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-zinc-400">
                Composition des hooks, équilibrage visuel & application du Brand Kit...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Inspiration Templates bar */}
      <div className="px-5 py-2 border-t border-zinc-850 bg-zinc-950/90">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-zinc-500 text-[11px] font-mono shrink-0 flex items-center gap-1">
            <Lightbulb className="w-3 h-3 text-amber-400" />
            Inspiration :
          </span>
          {QUICK_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => onApplyTemplatePrompt(tpl.prompt, tpl.format, tpl.type)}
              className="shrink-0 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 hover:border-amber-500/40 text-[11px] font-medium transition-colors"
            >
              {tpl.title}
            </button>
          ))}
        </div>
      </div>

      {/* Input Composer Zone */}
      <div className="p-4 border-t border-zinc-800/80 bg-zinc-950">
        <div className="p-2.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 focus-within:border-amber-500/60 focus-within:ring-1 focus-within:ring-amber-500/30 transition-all shadow-lg">
          {/* Format Selectors and Content Type Bar */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/70 text-xs">
            {/* Format selection buttons */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-zinc-400 mr-1 font-mono">Format :</span>

              {/* Scroller 4:5 */}
              <button
                type="button"
                onClick={() => handleFormatClick('scroller')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedFormat === 'scroller'
                    ? 'bg-amber-500 text-black shadow-sm font-bold'
                    : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Scroller 4:5</span>
              </button>

              {/* Story 9:16 */}
              <button
                type="button"
                onClick={() => handleFormatClick('story')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedFormat === 'story'
                    ? 'bg-amber-500 text-black shadow-sm font-bold'
                    : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Story 9:16</span>
              </button>

              {/* Square 1:1 */}
              <button
                type="button"
                onClick={() => handleFormatClick('square')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedFormat === 'square'
                    ? 'bg-amber-500 text-black shadow-sm font-bold'
                    : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                <Square className="w-3.5 h-3.5" />
                <span>Carré 1:1</span>
              </button>
            </div>

            {/* Content Type Pill Select */}
            <div className="flex items-center gap-1 text-[11px]">
              {(['carousel', 'poster'] as ContentType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedContentType(type)}
                  className={`px-2 py-0.5 rounded capitalize transition-colors ${
                    selectedContentType === type
                      ? 'text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {type === 'carousel' ? 'Carrousel' : 'Poster Unique'}
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Décrivez votre idée de carrousel ou vos modifications... (ex: 'Rends le hook du slide 1 plus percutant')"
              className="w-full bg-transparent text-white placeholder-zinc-500 text-sm focus:outline-none resize-none px-1"
            />
          </div>

          {/* Bottom input toolbar */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-[11px] text-zinc-500 font-mono">
              <span className="text-zinc-400">Entrée</span> pour envoyer · <span className="text-zinc-400">Shift+Entrée</span> saut de ligne
            </div>

            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isGenerating}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-extrabold text-xs tracking-wide transition-all ${
                inputText.trim() && !isGenerating
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.3)] cursor-pointer'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
              }`}
            >
              <span>GÉNÉRER</span>
              <Send className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
