import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import PortalHome, { Portal } from './layout/PortalHome';
import TillPortal from './layout/TillPortal';
import ManagementPortal from './layout/ManagementPortal';

export default function App() {
  const { ready, user } = useAuth();
  const [portal, setPortal] = useState<Portal | null>(null);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Starting…</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (!portal) {
    return <PortalHome onOpen={setPortal} />;
  }

  if (portal === 'till') {
    return <TillPortal onHome={() => setPortal(null)} />;
  }

  return <ManagementPortal onHome={() => setPortal(null)} />;
}
