import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { TooltipProvider } from './components/ui/tooltip';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <TooltipProvider delay={200}>
        <App />
      </TooltipProvider>
    </AuthProvider>
  </React.StrictMode>
);
