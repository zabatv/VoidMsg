import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Moon, Sun, LogOut } from 'lucide-react';
import { api } from '../api.js';

const themes = [
  { id: 'light' },
  { id: 'dark' },
  {
    id: 'dreamscape',
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

function Avatar({ userId, name, hasAvatar, size = 'normal' }) {
  const cls = size === 'sm' ? 'avatar-sm' : 'avatar';
  if (hasAvatar) return <img src={api.avatarUrl(userId)} alt="" className={cls} />;
  return <div className={`${cls} avatar-placeholder`}>{(name || '?')[0].toUpperCase()}</div>;
}

export default function ChatList() {
  const [list, setList] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState('');
  const [loadErr, setLoadErr] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [me, setMe] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const [meAvatar, setMeAvatar] = useState(false);
  const fileRef = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    load();
    api.me().then(u => {
      setMe(u);
      setMeAvatar(u.hasAvatar);
      localStorage.setItem('user', JSON.stringify(u));
      const savedTheme = u.theme || 'light';
      localStorage.setItem('theme', savedTheme);
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
      const found = themes.find(x => x.id === savedTheme);
      if (found?.colors) {
        Object.entries(found.colors).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
      } else {
        document.documentElement.removeAttribute('style');
      }
    }).catch(() => {});
  }, []);

  async function load() {
    setLoadErr('');
    try {
      setList(await api.listConversations());
    } catch (e) {
      if (list.length === 0) setLoadErr('Could not load conversations — server may be waking up. ' + e.message);
    }
  }

  let debounceTimer;
  function handleSearch(val) {
    setQuery(val);
    clearTimeout(debounceTimer);
    if (val.length < 2) { setResults([]); return; }
    debounceTimer = setTimeout(async () => {
      setSearching(true);
      try { setResults(await api.searchUsers(val)); } catch (e) {}
      setSearching(false);
    }, 300);
  }

  async function pickUser(user) {
    setErr('');
    try {
      const conv = await api.openConversation(user.id);
      nav('/chat/' + conv.id);
    } catch (e) { setErr(e.message); }
  }

  async function handleAvatarUpload(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      await api.uploadAvatar(f);
      setMeAvatar(true);
      load();
    } catch (e) { console.error(e.message); }
  }

  function logout() {
    localStorage.clear();
    nav('/login');
  }

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    api.updateProfile({ theme: next }).catch(e => console.error(e.message));
  }

  return (
    <div className="container">
      <header>
        <div className="header-left">
          <div className="avatar-upload" onClick={() => fileRef.current?.click()} title="Change avatar">
            <Avatar userId={me.id} name={me.name} hasAvatar={meAvatar} />
            <div className="avatar-overlay"><Camera size={24} /></div>
          </div>
          <input type="file" accept="image/*" ref={fileRef} onChange={handleAvatarUpload} hidden />
          <h2>{me.name}</h2>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="theme-btn" onClick={toggleTheme}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>
          <button onClick={logout}><LogOut size={16} style={{ marginRight: 4 }} /> Logout</button>
        </div>
      </header>

      <div className="tabs">
        <span className="active">Chats</span>
        <span onClick={() => nav('/feed')}>Feed</span>
        <span onClick={() => nav('/profile')}>Profile</span>
        <span onClick={() => nav('/settings')}>Settings</span>
      </div>

      <div className="search-box">
        <input
          placeholder="Search users by name or email..."
          value={query}
          onChange={e => handleSearch(e.target.value)}
        />
        {searching && <span className="spinner" />}
        {results.length > 0 && (
          <div className="search-results">
            {results.map(u => (
              <div key={u.id} className="search-result-item" onClick={() => pickUser(u)}>
                <Avatar userId={u.id} name={u.name} hasAvatar={u.hasAvatar} size="sm" />
                <div>
                  <div className="sr-name">{u.name}</div>
                  <div className="sr-email">{u.email}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {err && <div className="err">{err}</div>}
      {loadErr && <div className="err">{loadErr} <button onClick={load} className="link-btn">Retry</button></div>}

      <ul className="conv-list">
        {list.map(c => (
          <li key={c.id} onClick={() => nav('/chat/' + c.id)} className="conv-item">
            <Avatar userId={c.other?.id} name={c.other?.name} hasAvatar={c.other?.hasAvatar} />
            <div className="conv-info">
              <div className="name">{c.other?.name || 'Unknown'}</div>
              <div className="email">{c.other?.email}</div>
              <div className="last">
                {c.lastMessage
                  ? (c.lastMessage.attachments?.length > 0 ? '[Image]' : c.lastMessage.text || '')
                  : '(no messages)'}
              </div>
            </div>
          </li>
        ))}
        {!loadErr && list.length === 0 && <li className="empty">No conversations yet — search for a user above</li>}
      </ul>
    </div>
  );
}
