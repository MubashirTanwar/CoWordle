require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const setupGameHandler = require('./socket/gameHandler');

const app = express();
const server = http.createServer(app);

// Allow multiple origins (localhost for dev, Vercel domain for prod)
const rawOrigins = process.env.CLIENT_URL || 'http://localhost:3000';
const CLIENT_URL = rawOrigins.split(',').map(s => s.trim());

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,      // 60s before declaring a client disconnected
  pingInterval: 25000,     // ping clients every 25s
  upgradeTimeout: 30000,   // 30s to upgrade from polling to WebSocket
  maxHttpBufferSize: 1e6,  // 1 MB max message size
});

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cowordle';
mongoose
  .connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB error:', err.message));

// Auto-reconnect on connection drop
mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected, retrying...'));
mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconnected'));

// Setup socket handlers
setupGameHandler(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 CoWordle server running on port ${PORT}`);
});
