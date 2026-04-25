import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

window.addEventListener('error', (e) => {
  if (e.message?.includes('ResizeObserver')) e.stopImmediatePropagation();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
