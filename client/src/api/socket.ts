import { io, Socket } from 'socket.io-client';
import { API_BASE } from './config';

let socket: Socket | null = null;

export function getSocket(token?: string | null): Socket {
  if (!socket) {
    socket = io(API_BASE, {
      autoConnect: false,
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  } else if (token && socket.auth && (socket.auth as { token?: string }).token !== token) {
    (socket.auth as { token?: string }).token = token;
    if (socket.connected) {
      socket.disconnect().connect();
    }
  }

  return socket;
}

export function connectSocket(token: string): Socket {
  const s = getSocket(token);
  (s.auth as { token?: string }) = { token };
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
  }
}
