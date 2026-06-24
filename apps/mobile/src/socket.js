import AsyncStorage from '@react-native-async-storage/async-storage';

const WS_URL = (process.env.EXPO_PUBLIC_WS_URL || process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');

let socket = null;

export async function getSocket() {
  if (!socket) {
    const token = await AsyncStorage.getItem('token');
    const { io } = await import('socket.io-client');
    socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
