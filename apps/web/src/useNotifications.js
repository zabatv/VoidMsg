import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { getSocket } from './socket.js';

function playSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch {}
}

function showNotification(title, body) {
  try {
    if (Notification.permission === 'granted') {
      const n = new Notification(title, { body });
      setTimeout(() => n.close(), 4000);
    }
  } catch (e) { console.error('notify error:', e); }
}

export default function useNotifications() {
  const location = useLocation();
  const unreadRef = useRef(0);

  const matchChat = location.pathname.match(/^\/chat\/(\d+)$/);
  const currentConvId = matchChat ? Number(matchChat[1]) : null;

  const updateTitle = useCallback((count) => {
    document.title = count > 0 ? `(${count}) VoidMsg` : 'VoidMsg';
  }, []);

  useEffect(() => {
    updateTitle(0);
  }, [location.pathname, updateTitle]);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const handler = () => {
        Notification.requestPermission();
        document.removeEventListener('click', handler);
      };
      document.addEventListener('click', handler, { once: true });
    }
  }, []);

  useEffect(() => {
    const sock = getSocket();

    const onMsg = (msg) => {
      if (msg.authorId === meId()) return;
      if (msg.conversationId === currentConvId) return;

      unreadRef.current += 1;
      updateTitle(unreadRef.current);

      playSound();
      showNotification(
        msg.author?.name || 'New message',
        msg.text || (msg.attachments?.length > 0 ? '[Image]' : '')
      );
    };

    sock.on('messageCreated', onMsg);
    return () => { sock.off('messageCreated', onMsg); };
  }, [currentConvId, updateTitle]);
}

function meId() {
  try { return JSON.parse(localStorage.getItem('user') || '{}').id; } catch { return null; }
}
