import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RealtimeProvider } from './context/RealtimeContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import './App.css';

function Router() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading Retrek...</p>
      </div>
    );
  }

  // Handle route matching & protection
  if (currentPath === '/login') {
    if (isAuthenticated) {
      navigate('/dashboard');
      return null;
    }
    return <Login navigate={navigate} />;
  }

  if (currentPath === '/signup') {
    if (isAuthenticated) {
      navigate('/dashboard');
      return null;
    }
    return <Signup navigate={navigate} />;
  }

  if (currentPath.startsWith('/dashboard')) {
    if (!isAuthenticated) {
      navigate('/login');
      return null;
    }
    return <RealtimeProvider><Dashboard navigate={navigate} currentPath={currentPath} /></RealtimeProvider>;
  }

  // Fallback to Landing page
  return <Landing navigate={navigate} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
