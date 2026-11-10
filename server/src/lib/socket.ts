import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { CLIENT_URL, JWT_SECRET } from '../config/env.js';
import type { UserTokenPayload } from '../types/index.js';

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowedOrigins = [
          CLIENT_URL,
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'https://gymtrack-prdf.onrender.com',
        ];
        if (allowedOrigins.includes(origin) || origin.endsWith('.onrender.com')) {
          return callback(null, true);
        }
        callback(new Error(`Socket CORS blocked for origin: ${origin}`));
      },
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  // Authentication middleware: inspects handshake auth or Authorization header
  io.use((socket: Socket, next) => {
    try {
      const authHeader = socket.handshake.headers.authorization;
      const token =
        socket.handshake.auth?.token ||
        (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

      if (!token) {
        return next(new Error('Authentication error: Missing token'));
      }

      const payload = jwt.verify(token, JWT_SECRET) as UserTokenPayload;
      if (!payload || !payload.id) {
        return next(new Error('Authentication error: Invalid token payload'));
      }

      socket.data.user = payload;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as UserTokenPayload;
    if (user?.id) {
      // User joins a dedicated room scoped to their userId
      const userRoom = `user:${user.id}`;
      socket.join(userRoom);
      console.log(`🔌 [Socket.IO] User connected: ${user.email} (id: ${user.id}, socketId: ${socket.id})`);

      socket.on('disconnect', (reason) => {
        console.log(`🔌 [Socket.IO] User disconnected: ${user.email} (${reason})`);
      });
    }
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

/**
 * Emits an event specifically to a given user across all their connected devices/tabs.
 */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

/**
 * Broadcasts an event to all connected clients (e.g. gym traffic telemetry).
 */
export function broadcastEvent(event: string, payload: unknown): void {
  if (!io) return;
  io.emit(event, payload);
}
