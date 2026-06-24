import { useEffect, useState, useRef } from 'react';
import { Camera, Moon, Sun, MessageCircle, X, Trash2, Send } from 'lucide-react';
import { api } from '../api.js';
import { useNavigate } from 'react-router-dom';

function Avatar({ userId, name, hasAvatar }) {
  if (hasAvatar) return <img src={api.avatarUrl(userId)} alt="" className="avatar" />;
  return <div className="avatar-placeholder">{(name || '?')[0].toUpperCase()}</div>;
}

function Comments({ postId }) {
  const [items, setItems] = useState([]);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);

  async function load() {
    try { setItems(await api.getComments(postId)); } catch (e) {}
  }
  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const c = await api.createComment(postId, text.trim());
      setItems(prev => [...prev, c]);
      setText('');
    } catch (e) { console.error(e.message); }
  }
  async function del(commentId) {
    try {
      await api.deleteComment(postId, commentId);
      setItems(prev => prev.filter(c => c.id !== commentId));
    } catch (e) { console.error(e.message); }
  }

  const me = JSON.parse(localStorage.getItem('user') || '{}');

  if (!open) return <button className="comment-toggle" onClick={() => { setOpen(true); load(); }}><MessageCircle size={14} style={{ marginRight: 4 }} />{items.length > 0 ? items.length : ''} Comments</button>;

  return (
    <div className="comments-section">
      <div className="comments-header">
        <span>Comments</span>
        <button className="comment-toggle" onClick={() => setOpen(false)}>Close</button>
      </div>
      {items.map(c => (
        <div key={c.id} className="comment-item">
          <div className="comment-author">
            <Avatar userId={c.author?.id} name={c.author?.name} hasAvatar={c.author?.hasAvatar} size="sm" />
            <span>{c.author?.name}</span>
          </div>
          <div className="comment-text">{c.text}</div>
          {c.authorId === me.id && <button className="delete-btn" onClick={() => del(c.id)} title="Delete"><Trash2 size={14} /></button>}
        </div>
      ))}
      <form onSubmit={send} className="comment-form">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Write a comment..." maxLength={500} />
        <button type="submit" disabled={!text.trim()}><Send size={14} /></button>
      </form>
    </div>
  );
}

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedErr, setFeedErr] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const fileRef = useRef(null);
  const nav = useNavigate();
  const me = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => { load(); }, []);

  async function load() {
    setFeedErr('');
    try {
      const data = await api.getPosts({ limit: 30 });
      setPosts(data.items);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch (e) {
      if (posts.length === 0) setFeedErr('Could not load posts — server may be waking up. ' + e.message);
    }
    setLoading(false);
  }

  async function loadMore() {
    if (!hasMore || !nextCursor) return;
    const data = await api.getPosts({ limit: 30, cursor: nextCursor });
    setPosts(prev => [...prev, ...data.items]);
    setHasMore(data.hasMore);
    setNextCursor(data.nextCursor);
  }

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImage(f);
    setPreview(URL.createObjectURL(f));
  }

  function clearFile() {
    setImage(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handlePost(e) {
    e.preventDefault();
    if (!text.trim() && !image) return;
    setSending(true);
    try {
      const post = await api.createPost({ text: text.trim(), image });
      setPosts(prev => [post, ...prev]);
      setText('');
      clearFile();
    } catch (e) { console.error(e.message); }
    setSending(false);
  }

  async function handleDelete(id) {
    try {
      await api.deletePost(id);
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch (e) { console.error(e.message); }
  }

  if (loading) return <div className="container loading">Loading...</div>;

  return (
    <div className="container">
      <header>
        <h2>Feed</h2>
        <button className="theme-btn" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </header>

      <div className="tabs">
        <span onClick={() => nav('/')}>Chats</span>
        <span className="active">Feed</span>
        <span onClick={() => nav('/profile')}>Profile</span>
        <span onClick={() => nav('/settings')}>Settings</span>
      </div>

      <form onSubmit={handlePost} className="post-form">
        <textarea
          placeholder="What's on your mind?"
          value={text}
          onChange={e => setText(e.target.value)}
          maxLength={1000}
          rows={3}
        />
        {preview && (
          <div className="image-preview">
            <img src={preview} alt="preview" />
            <button type="button" className="remove-file" onClick={clearFile}><X size={14} /></button>
          </div>
        )}
        <div className="post-form-footer">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" className="attach-btn" onClick={() => fileRef.current?.click()}><Camera size={20} /></button>
            <span className="muted">{text.length}/1000</span>
          </div>
          <button type="submit" disabled={sending || (!text.trim() && !image)}>{sending ? '...' : 'Post'}</button>
        </div>
        <input type="file" accept="image/*" ref={fileRef} onChange={handleFile} hidden />
      </form>

      <div className="feed">
        {posts.map(p => (
          <div key={p.id} className="feed-item">
            <div className="feed-header">
              <Avatar userId={p.author?.id} name={p.author?.name} hasAvatar={p.author?.hasAvatar} />
              <div>
                <div className="feed-author">{p.author?.name}</div>
                <div className="feed-time">{new Date(p.createdAt).toLocaleString()}</div>
              </div>
              {p.authorId === me.id && (
                <button className="delete-btn" onClick={() => handleDelete(p.id)} title="Delete"><Trash2 size={16} /></button>
              )}
            </div>
            {p.text && <div className="feed-text">{p.text}</div>}
            {p.imageMimeType && (
              <div className="feed-image">
                <img src={api.postImageUrl(p.id)} alt="" loading="lazy" />
              </div>
            )}
            <Comments postId={p.id} />
          </div>
        ))}
        {feedErr && <div className="err" style={{ margin: '16px 0' }}>{feedErr} <button onClick={load} className="link-btn">Retry</button></div>}
        {hasMore && <button onClick={loadMore} className="load-more-btn">Load older posts</button>}
        {!feedErr && posts.length === 0 && <div className="empty">No posts yet. Be the first!</div>}
      </div>
    </div>
  );
}
