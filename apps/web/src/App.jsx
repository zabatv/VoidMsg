import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ChatList from './pages/ChatList.jsx';
import ChatView from './pages/ChatView.jsx';
import Feed from './pages/Feed.jsx';
import Profile from './pages/Profile.jsx';
import Settings from './pages/Settings.jsx';
import useNotifications from './useNotifications.js';

function Private({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />;
}

function Notify() {
  useNotifications();
  return null;
}

function Warmup() {
  useEffect(() => {
    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    if (apiUrl) {
      const t = setTimeout(() => { fetch(apiUrl + '/health').catch(() => {}); }, 2000);
      return () => clearTimeout(t);
    }
  }, []);
  return null;
}

export default function App() {
  useEffect(() => {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  return (
    <>
      {localStorage.getItem('token') && <Notify />}
      {localStorage.getItem('token') && <Warmup />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<Private><ChatList /></Private>} />
        <Route path="/chat/:id" element={<Private><ChatView /></Private>} />
        <Route path="/feed" element={<Private><Feed /></Private>} />
        <Route path="/profile" element={<Private><Profile /></Private>} />
        <Route path="/settings" element={<Private><Settings /></Private>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
