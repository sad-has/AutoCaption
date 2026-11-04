import React from 'react';
import ReactDOM from 'react-dom/client';
import './landing.css';
import { LandingPage } from './LandingPage';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <LandingPage />
    </React.StrictMode>
  );
} else {
  console.error('Fatal: Failed to locate #root DOM element for landing page');
}