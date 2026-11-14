import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './i18n';
import Login from './pages/Login';
import SyndicDashboard from './pages/SyndicDashboard';
import ResidentDashboard from './pages/ResidentDashboard';

function getAuthState() {
  const userRole = localStorage.getItem('userRole');
  const userId = localStorage.getItem('userId');
  const syndicAuth = localStorage.getItem('syndicAuth');
  const hasValidId = Boolean(userId && userId !== 'undefined' && userId !== 'null');

  return {
    isSyndic: syndicAuth === '1' && userRole === 'syndic' && hasValidId,
    isResident: userRole === 'resident' && hasValidId,
  };
}

export default function App() {
  const [auth, setAuth] = useState(getAuthState);

  useEffect(() => {
    const syncAuth = () => setAuth(getAuthState());
    window.addEventListener('authChanged', syncAuth);
    window.addEventListener('storage', syncAuth);
    return () => {
      window.removeEventListener('authChanged', syncAuth);
      window.removeEventListener('storage', syncAuth);
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            auth.isSyndic ? (
              <SyndicDashboard />
            ) : auth.isResident ? (
              <Navigate to="/resident" replace />
            ) : (
              <Login />
            )
          }
        />
        <Route
          path="/login"
          element={
            auth.isSyndic ? (
              <Navigate to="/" replace />
            ) : auth.isResident ? (
              <Navigate to="/resident" replace />
            ) : (
              <Login />
            )
          }
        />
        <Route
          path="/syndic"
          element={auth.isSyndic ? <SyndicDashboard /> : <Navigate to="/" replace />}
        />
        <Route
          path="/resident"
          element={auth.isResident ? <ResidentDashboard /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
