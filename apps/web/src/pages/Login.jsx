import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [visible, setVisible] = useState(false);
  const nav = useNavigate();
  const cardRef = useRef(null);

  useEffect(() => { setTimeout(() => setVisible(true), 50); }, []);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      const data = await api.login({ email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      if (data.user.theme) {
        localStorage.setItem('theme', data.user.theme);
        document.documentElement.setAttribute('data-theme', data.user.theme);
      }
      nav('/');
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="auth-page">
      <div className="auth-particles">
        {Array.from({ length: 25 }).map((_, i) => (
          <span key={i} className="auth-particle" style={{
            left: Math.random() * 100 + '%',
            top: Math.random() * 100 + '%',
            width: 2 + Math.random() * 4 + 'px',
            height: 2 + Math.random() * 4 + 'px',
            animationDelay: Math.random() * 5 + 's',
            animationDuration: 3 + Math.random() * 4 + 's',
          }} />
        ))}
      </div>

      <div className={`auth-card ${visible ? 'visible' : ''}`} ref={cardRef}>
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <h1 className="auth-title">VoidMsg</h1>
          <p className="auth-subtitle">Enter the void</p>
        </div>

        <form onSubmit={submit} className="auth-form">
          <div className="auth-input-group">
            <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>

          <div className="auth-input-group">
            <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <input
              placeholder="Password"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button type="button" className="auth-eye" onClick={() => setShowPass(!showPass)} tabIndex={-1}>
              {showPass ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>

          {err && <div className="auth-err">{err}</div>}

          <button type="submit" className="auth-submit">
            <span>Enter</span>
          </button>

          <Link to="/register" className="auth-link">No account? <strong>Create one</strong></Link>
        </form>
      </div>
    </div>
  );
}
