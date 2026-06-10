import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { AuthProvider, useAuth } from './store/authStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Finance from './pages/Finance';
import Tax from './pages/Tax';
import Calendar from './pages/Calendar';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import AdminUsers from './pages/AdminUsers';

function AuthGate() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  return mode === 'login'
    ? <Login onSwitch={() => setMode('register')} />
    : <Register onSwitch={() => setMode('login')} />;
}

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <AuthGate />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="pos"       element={<POS />} />
                <Route path="finance"   element={<Finance />} />
                <Route path="tax"       element={<Tax />} />
                <Route path="calendar"  element={<Calendar />} />
                <Route path="chat"      element={<Chat />} />
                <Route path="settings"  element={<Settings />} />
                <Route path="admin"     element={<AdminRoute><AdminUsers /></AdminRoute>} />
                <Route path="*"         element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
