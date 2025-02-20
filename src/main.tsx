import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx';
import './index.css';
import { initializeApp } from './lib/init';

// אתחול המערכת
console.log('Initializing app...');
const { webhookChannel } = initializeApp();
console.log('App initialized');

// ניקוי כשהאפליקציה נסגרת
window.addEventListener('beforeunload', () => {
  if (webhookChannel) {
    webhookChannel.unsubscribe();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
