import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Moon, Sun, Save, Trash2 } from 'lucide-react';
import { api } from '../api.js';

export default function Profile() {
  const [me, setMe] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const [hasAvatar, setHasAvatar] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const fileRef = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    api.me().then(u => {
      setMe(u);
      setHasAvatar(u.hasAvatar);
      setName(u.name);
      const savedTheme = u.theme || 'light';
      localStorage.setItem('theme', savedTheme);
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }).catch(() => {});
  }, []);

  async function handleAvatarUpload(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      await api.uploadAvatar(f);
      setHasAvatar(true);
      setMsg('Avatar updated');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { console.error(e.message); }
  }

  async function handleDeleteAvatar() {
    try {
      await api.deleteAvatar();
      setHasAvatar(false);
      setMsg('Avatar removed');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { console.error(e.message); }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const u = await api.updateProfile({ name: name.trim() });
      setMe(u);
      setMsg('Profile saved');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { console.error(e.message); }
    setSaving(false);
  }

  function AvatarDisplay() {
    if (hasAvatar) return <img src={api.avatarUrl(me.id)} alt="" className="profile-avatar" />;
    return <div className="profile-avatar avatar-placeholder-big">{(me.name || '?')[0].toUpperCase()}</div>;
  }

  return (
    <div className="container">
      <header>
        <h2>Profile</h2>
        <button className="theme-btn" onClick={() => {
          const next = theme === 'light' ? 'dark' : 'light';
          setTheme(next);
          api.updateProfile({ theme: next }).catch(e => console.error(e.message));
        }}>
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </header>

      <div className="tabs">
        <span onClick={() => nav('/')}>Chats</span>
        <span onClick={() => nav('/feed')}>Feed</span>
        <span className="active">Profile</span>
        <span onClick={() => nav('/settings')}>Settings</span>
      </div>

      <div className="profile-card">
        <div className="profile-avatar-section">
          <div className="avatar-upload" onClick={() => fileRef.current?.click()}>
            <AvatarDisplay />
            <div className="avatar-overlay"><Camera size={28} /></div>
          </div>
          <input type="file" accept="image/*" ref={fileRef} onChange={handleAvatarUpload} hidden />
          {hasAvatar && <button className="link-btn" onClick={handleDeleteAvatar}><Trash2 size={14} style={{ marginRight: 4 }} />Remove avatar</button>}
        </div>

        <form onSubmit={handleSave} className="profile-form">
          <label>Email</label>
          <input type="email" value={me.email || ''} disabled className="profile-input disabled" />

          <label>Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="profile-input" />

          <div className="profile-actions">
            <button type="submit" disabled={saving || !name.trim()}>
              <Save size={16} style={{ marginRight: 6 }} />{saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>

        {msg && <div className="success-msg">{msg}</div>}
      </div>
    </div>
  );
}
