import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import FirstRunWizard from './pages/FirstRunWizard';
import AppShell from './layout/AppShell';

export default function App() {
  const { ready, user, firstRun } = useAuth();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Starting…</div>
      </div>
    );
  }

  if (!user) {
    if (firstRun) {
      return <FirstRunWizard />;
    }
    return <LoginPage />;
  }

  return <AppShell />;
}
