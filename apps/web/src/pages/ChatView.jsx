import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Moon, Sun, Camera, Send } from 'lucide-react';
import { api } from '../api.js';
import { getSocket } from '../socket.js';
import { parseMessage } from '../messageParser.js';
import { applyTheme, resetTheme } from '../themeEngine.js';
import { startRain, stopRain } from '../rainEffect.js';
import { startDust, stopDust } from '../dustEffect.js';

function Avatar({ userId, name, hasAvatar, size = 'normal' }) {
  const cls = size === 'sm' ? 'avatar-sm' : 'avatar';
  if (hasAvatar) return <img src={api.avatarUrl(userId)} alt="" className={cls} />;
  return <div className={`${cls} avatar-placeholder`}>{(name || '?')[0].toUpperCase()}</div>;
}

export default function ChatView() {
  const { id } = useParams();
  const convId = Number(id);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [conv, setConv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [currentCustomTheme, setCurrentCustomTheme] = useState(null);
  const [rainOn, setRainOn] = useState(false);
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const sendingRef = useRef(false);
  const nav = useNavigate();
  const me = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const sock = getSocket();
    sock.emit('joinConversation', convId);

    const onMsg = (msg) => {
      if (msg.conversationId !== convId) return;
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    const onThemeChanged = ({ themeName, num, changedBy }) => {
      if (changedBy === me.id) return;

      if (themeName === 'stoprain') {
        stopRain();
        setRainOn(false);
        return;
      }

      applyTheme(themeName, num).then(t => {
        if (t) setCurrentCustomTheme({ name: themeName, num });
        if (themeName === 'rain') {
          startRain();
          setRainOn(true);
        }
      });
    };

    sock.on('messageCreated', onMsg);
    sock.on('themeChanged', onThemeChanged);

    load();
    api.markRead(convId).catch(() => {});

    const saved = localStorage.getItem('customTheme');
    if (saved) {
      try {
        const { name, num } = JSON.parse(saved);
        applyTheme(name, num).then(t => {
          if (t) {
            setCurrentCustomTheme({ name, num });
            if (name === 'rain') { startRain(); setRainOn(true); }
          }
        });
      } catch (e) {}
    }

    return () => {
      sock.off('messageCreated', onMsg);
      sock.off('themeChanged', onThemeChanged);
      stopRain();
    };
  }, [convId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function load() {
    try {
      const data = await api.getMessages(convId);
      setMessages(data.items);
      const list = await api.listConversations();
      setConv(list.find(x => x.id === convId));
    } catch (e) {}
    setLoading(false);
  }

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function clearFile() {
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function send(e) {
    if (e) e.preventDefault();
    if (!text.trim() && !file) return;
    if (sendingRef.current) return;

    const lowerText = text.trim().toLowerCase();

    // Дождь
    if (lowerText === 'rain' && !file) {
      const sock = getSocket();
      sock.emit('themeChange', { conversationId: convId, themeName: 'rain', num: 1 });
      applyTheme('rain', 1).then(t => {
        if (t) setCurrentCustomTheme({ name: 'rain', num: 1 });
      });
      startRain();
      setRainOn(true);
      setText('');
      return;
    }

    if (lowerText === 'stoprain' && !file) {
      const sock = getSocket();
      sock.emit('themeChange', { conversationId: convId, themeName: 'stoprain', num: 0 });
      stopRain();
      setRainOn(false);
      setText('');
      return;
    }

    // Пыль
    if (lowerText === 'dust' && !file) {
      startDust();
      setText('');
      return;
    }

    if (lowerText === 'stopdust' && !file) {
      stopDust();
      setText('');
      return;
    }

    // Тема
    const themeMatch = text.match(/#(\w+)\s+(\d+)/);
    if (themeMatch && !file) {
      const [, themeName, num] = themeMatch;
      const sock = getSocket();
      sock.emit('themeChange', { conversationId: convId, themeName, num });

      const t = await applyTheme(themeName, num);
      if (t) {
        setCurrentCustomTheme({ name: themeName, num });
        if (themeName === 'rain') {
          startRain();
          setRainOn(true);
        }
      }
      setText('');
      return;
    }

    // Обычное сообщение
    sendingRef.current = true;
    setSending(true);
    try {
      const msg = await api.sendMessage(convId, { text: text.trim(), image: file });
      setMessages(prev => { if (prev.some(m => m.id === msg.id)) return prev; return [...prev, msg]; });
      setText('');
      clearFile();
    } catch (e) { console.error(e.message); }
    sendingRef.current = false;
    setSending(false);
  }

  if (loading) return <div className="container loading">Loading...</div>;

  return (
    <div className="chat">
      <header className="chat-header">
        <Link to="/"><ArrowLeft size={20} /></Link>
        {conv?.other && (
          <Avatar userId={conv.other.id} name={conv.other.name} hasAvatar={conv.other.hasAvatar} size="sm" />
        )}
        <h3>{conv?.other?.name || ('Chat #' + convId)}</h3>
        {currentCustomTheme && (
          <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 8 }}>
            🎨 {currentCustomTheme.name}/{currentCustomTheme.num}
          </span>
        )}
        {rainOn && (
          <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 8 }}>🌧</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {rainOn && (
            <button
              className="theme-btn"
              onClick={() => {
                const sock = getSocket();
                sock.emit('themeChange', { conversationId: convId, themeName: 'stoprain', num: 0 });
                stopRain();
                setRainOn(false);
              }}
              title="Выключить дождь"
              style={{ fontSize: 12 }}
            >
              ☀
            </button>
          )}
          {currentCustomTheme && (
            <button
              className="theme-btn"
              onClick={() => {
                resetTheme();
                setCurrentCustomTheme(null);
                stopRain();
                setRainOn(false);
              }}
              title="Сбросить тему"
              style={{ fontSize: 12 }}
            >
              ✕
            </button>
          )}
          <button className="theme-btn" onClick={() => setTheme(t => { const n = t === 'light' ? 'dark' : 'light'; localStorage.setItem('theme', n); return n; })}>
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>

      <div className="messages">
        {messages.map(m => (
          <div key={m.id} className={'msg ' + (m.authorId === me.id ? 'mine' : '')}>
            <div className="author">
              <Avatar userId={m.author?.id} name={m.author?.name} hasAvatar={m.author?.hasAvatar} size="sm" />
              {m.author?.name}
            </div>
            {m.text && (
              <div
                className="text"
                dangerouslySetInnerHTML={{ __html: parseMessage(m.text) }}
              />
            )}
            {m.attachments?.map(a => (
              <a key={a.id} href={api.attachmentUrl(a.id)} target="_blank" rel="noreferrer">
                <img src={api.attachmentUrl(a.id)} alt={a.fileName} loading="lazy" />
              </a>
            ))}
            <div className="time">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="composer">
        {preview && (
          <div className="image-preview">
            <img src={preview} alt="preview" />
            <button type="button" className="remove-file" onClick={clearFile}>&times;</button>
          </div>
        )}
        <div className="composer-row">
          <button type="button" className="attach-btn" onClick={() => fileRef.current?.click()} title="Attach image"><Camera size={22} /></button>
          <input type="file" accept="image/*" ref={fileRef} onChange={handleFile} hidden />
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Type a message..." className="text-input" />
          <button type="submit" disabled={sending || (!text.trim() && !file)}>{sending ? '...' : <Send size={16} />}</button>
        </div>
      </form>
    </div>
  );
}
