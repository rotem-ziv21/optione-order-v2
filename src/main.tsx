import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx';
import './index.css';
import { initializeApp } from './lib/init';

// אתחול המערכת
console.log('Initializing app...');
initializeApp();
console.log('App initialized');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
