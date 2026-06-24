import { io } from 'socket.io-client';

const WS_URL = (import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

let socket = null;

export function getSocket() {
  if (!socket) {
    const token = localStorage.getItem('token');
    socket = io(WS_URL, {
      auth: { token: token },
      transports: ['websocket', 'polling']
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}