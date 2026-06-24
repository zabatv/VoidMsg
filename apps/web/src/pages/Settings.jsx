import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Palette } from 'lucide-react';
import { api } from '../api.js';

const themes = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  {
    id: 'dreamscape',
    label: 'Dreamscape',
    icon: Palette,
    colors: {
      '--bg': '#0d4f5c',
      '--surface': '#021014',
      '--surface-hover': '#145a6a',
      '--border': '#145a6a',
      '--text': '#4a9aaa',
      '--text-secondary': '#2a9aaa',
      '--primary': '#2a9aaa',
      '--primary-text': '#021014',
      '--msg-other': '#145a6a',
      '--msg-other-text': '#4a9aaa',
      '--msg-mine': '#2a9aaa',
      '--msg-mine-text': '#021014',
      '--shadow': 'rgba(0,0,0,0.4)',
      '--search-shadow': 'rgba(0,0,0,0.5)',
      '--overlay': 'rgba(0,0,0,0.7)',
    }
  }
];

export default function Settings() {
  const nav = useNavigate();
  const currentTheme = localStorage.getItem('theme') || 'light';

  useEffect(() => {
    const t = localStorage.getItem('theme') || 'light';
    const found = themes.find(x => x.id === t);
    if (found?.colors) {
      Object.entries(found.colors).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    }
  }, []);

  async function applyTheme(t) {
    localStorage.setItem('theme', t.id);
    document.documentElement.setAttribute('data-theme', t.id);
    if (t.colors) {
      Object.entries(t.colors).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    } else {
      document.documentElement.removeAttribute('style');
    }
    try { await api.updateProfile({ theme: t.id }); } catch (e) { console.error(e.message); }
    window.location.reload();
  }

  return (
    <div className="container">
      <header>
        <h2>Settings</h2>
      </header>

      <div className="tabs">
        <span onClick={() => nav('/')}>Chats</span>
        <span onClick={() => nav('/feed')}>Feed</span>
        <span onClick={() => nav('/profile')}>Profile</span>
        <span className="active">Settings</span>
      </div>

      <div className="settings-section">
        <h3>Theme</h3>
        <div className="theme-grid">
          {themes.map(t => {
            const Icon = t.icon;
            return (
              <div
                key={t.id}
                className={`theme-card ${currentTheme === t.id ? 'active' : ''}`}
                onClick={() => applyTheme(t)}
              >
                <div className="theme-icon"><Icon size={28} /></div>
                <div className="theme-label">{t.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
