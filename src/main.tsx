// Ensure window.fetch is writable and configurable in all execution contexts
(function() {
  try {
    if (typeof window !== 'undefined' && window.fetch) {
      let currentFetch = window.fetch;
      Object.defineProperty(window, 'fetch', {
        get() {
          return currentFetch;
        },
        set(newFetch) {
          currentFetch = newFetch;
        },
        configurable: true,
        enumerable: true,
      });
    }
  } catch (_) {
    // Ignore if already patched or restricted
  }
})();

import {createRoot} from 'react-dom/client';
import {LazyMotion} from 'motion/react';
import App from './App.tsx';
import './index.css';

// Les fonctionnalités d'animation (drag inclus) sont chargées à part pour alléger le premier affichage
const loadMotionFeatures = () => import('./motionFeatures').then((m) => m.default);

createRoot(document.getElementById('root')!).render(
  <LazyMotion features={loadMotionFeatures}>
    <App />
  </LazyMotion>,
);

// PWA : service worker (production uniquement)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
