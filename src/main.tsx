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
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
