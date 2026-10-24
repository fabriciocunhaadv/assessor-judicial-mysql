import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './lib/AuthContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { instalarMonitorDeErros } from './utils/monitorErros';
import { aplicarTema } from './utils/tema';

instalarMonitorDeErros();
aplicarTema();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);

