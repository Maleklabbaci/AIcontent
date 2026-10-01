import React from 'react';
import { CheckCircle2, Sparkles, X } from 'lucide-react';

interface ToastProps {
  message: string | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900 border border-amber-500/40 text-white shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-md animate-fade-in">
      <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
      </div>
      <p className="text-xs font-semibold text-zinc-200">{message}</p>
      <button
        onClick={onClose}
        className="p-1 rounded-md text-zinc-400 hover:text-white transition-colors ml-2"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
