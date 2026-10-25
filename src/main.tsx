import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import * as XLSX from 'xlsx';
import App from './App.tsx';
import { initButtonRippleEngine } from './lib/buttonAnimations';
import { initDesktopHostGuards } from './services/desktopHostBridge';
import './index.css';

// Expose bundled SheetJS (xlsx) globally so 100,000-volume Excel import/export runs 100% offline inside WebView2
(window as unknown as { XLSX: typeof XLSX }).XLSX = XLSX;

// Initialize native Windows WebView2 keyboard & context-menu guards
initDesktopHostGuards();

// Initialize global premium button micro-interactions
initButtonRippleEngine();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
