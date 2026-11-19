import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const registerSw = () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  };
  if (document.readyState === 'complete') {
    registerSw();
  } else {
    window.addEventListener('load', registerSw, { once: true });
  }
}
