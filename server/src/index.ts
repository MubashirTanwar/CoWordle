import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';

import setupGameHandler from './socket/gameHandler';
import type { TypedServer } from './socket/types';
import { health } from './routes/health';
import soloRouter from './routes/solo';
import { fail } from './lib/response';

const app = express();
const server = http.createServer(app);

// Allow multiple origins (localhost for dev, Vercel domain for prod)
const rawOrigins = process.env.CLIENT_URL || 'http://localhost:3000';
const CLIENT_URL = rawOrigins.split(',').map((s) => s.trim());

const io: TypedServer = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 20000,      // 20s before declaring a client disconnected (default)
  pingInterval: 25000,     // ping clients every 25s (default)
  upgradeTimeout: 10000,   // 10s to upgrade from polling to WebSocket (default)
});

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

// Health check — `/health` for uptime monitors, `/api/health` for the client
app.get('/health', health);
app.get('/api/health', health);

app.use('/api/solo', soloRouter);

app.use('/api', (_req, res) => fail(res, 404, 'NOT_FOUND', 'Route not found'));

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cowordle';
mongoose
  .connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err: Error) => console.error('❌ MongoDB error:', err.message));

// Auto-reconnect on connection drop
mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected, retrying...'));
mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconnected'));

// Setup socket handlers
setupGameHandler(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 CoWordle server running on port ${PORT}`);
});
