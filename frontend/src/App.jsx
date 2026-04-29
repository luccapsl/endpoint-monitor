import { useState, useEffect } from 'react';
import SetupWizard from './pages/SetupWizard';
import Dashboard from './pages/Dashboard';
import { checkSetupStatus } from './services/api';

export default function App() {
  const [configured, setConfigured] = useState(null);

  useEffect(() => {
    checkSetupStatus()
      .then((data) => setConfigured(data.configured))
      .catch(() => setConfigured(false));
  }, []);

  if (configured === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white text-lg animate-pulse">Carregando...</div>
      </div>
    );
  }

  return configured ? <Dashboard /> : <SetupWizard />;
}
