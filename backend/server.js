import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

const PORT = Number(process.env.PORT || 4000);
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'development-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'development-refresh-secret';

const inMemoryUsers = [];

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

const apiRateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  max: Number(process.env.RATE_LIMIT_MAX || 120),
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', apiRateLimiter);

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

app.get('/api/health', (req, res) => {
  const dbConfigured = Boolean(process.env.DATABASE_URL);

  res.json({
    status: 'ok',
    app: 'Flow Chat API',
    databaseConfigured: dbConfigured,
    message: dbConfigured
      ? 'Database configuration detected. Ready to connect.'
      : 'Database configuration required. Set DATABASE_URL in backend/.env.'
  });
});

app.post('/api/auth/register', async (req, res) => {
  const { email, username, password, displayName } = req.body || {};

  if (!email || !username || !password || !displayName) {
    return res.status(400).json({ error: 'Email, username, password, and display name are required.' });
  }

  if (!process.env.DATABASE_URL) {
    return res.status(503).json({
      error: 'Database not configured. Set DATABASE_URL in backend/.env before registration is enabled.'
    });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedUsername = String(username).trim();

  const existingUser = inMemoryUsers.find((user) => {
    return user.email === normalizedEmail || user.username === normalizedUsername;
  });

  if (existingUser) {
    return res.status(409).json({ error: 'An account with that email or username already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = {
    id: uuidv4(),
    email: normalizedEmail,
    username: normalizedUsername,
    displayName: String(displayName).trim(),
    passwordHash,
    emailVerified: false,
    createdAt: new Date().toISOString(),
    profilePictureUrl: '',
    profileTag: '@' + normalizedUsername,
    bio: 'New to Flow Chat.'
  };

  inMemoryUsers.push(user);

  const accessToken = jwt.sign({ sub: user.id, email: user.email, username: user.username }, JWT_ACCESS_SECRET, {
    expiresIn: '15m'
  });

  const refreshToken = jwt.sign({ sub: user.id }, JWT_REFRESH_SECRET, {
    expiresIn: '7d'
  });

  return res.status(201).json({
    message: 'User registered successfully.',
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      emailVerified: user.emailVerified
    },
    tokens: {
      accessToken,
      refreshToken
    }
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { identifier, password } = req.body || {};

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Username or email and password are required.' });
  }

  if (!process.env.DATABASE_URL) {
    return res.status(503).json({
      error: 'Database not configured. Add DATABASE_URL in backend/.env to enable login.'
    });
  }

  const normalizedIdentifier = String(identifier).trim().toLowerCase();
  const user = inMemoryUsers.find((candidate) => {
    return candidate.email === normalizedIdentifier || candidate.username.toLowerCase() === normalizedIdentifier;
  });

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const accessToken = jwt.sign({ sub: user.id, email: user.email, username: user.username }, JWT_ACCESS_SECRET, {
    expiresIn: '15m'
  });

  const refreshToken = jwt.sign({ sub: user.id }, JWT_REFRESH_SECRET, {
    expiresIn: '7d'
  });

  return res.json({
    message: 'Login successful.',
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      emailVerified: user.emailVerified
    },
    tokens: {
      accessToken,
      refreshToken
    }
  });
});

app.post('/api/auth/verify-email', verifyToken, (req, res) => {
  const { code } = req.body || {};

  if (!code) {
    return res.status(400).json({ error: 'Verification code is required.' });
  }

  res.json({
    success: true,
    message: 'Email verification flow is ready. Add an SMTP provider and verification code service in production.'
  });
});

app.get('/api/auth/me', verifyToken, (req, res) => {
  const user = inMemoryUsers.find((candidate) => candidate.id === req.user.sub);

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      profilePictureUrl: user.profilePictureUrl,
      profileTag: user.profileTag,
      bio: user.bio,
      emailVerified: user.emailVerified
    }
  });
});

app.get('/api/users/search', verifyToken, (req, res) => {
  const q = String(req.query.q || '').trim();
  const currentUserId = req.user.sub;

  if (!q) {
    return res.json({ users: [] });
  }

  const results = inMemoryUsers
    .filter((user) => user.id !== currentUserId)
    .filter((user) => {
      const searchValue = `${user.username} ${user.displayName}`.toLowerCase();
      return searchValue.includes(q.toLowerCase());
    })
    .slice(0, 20)
    .map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      profilePictureUrl: user.profilePictureUrl,
      profileTag: user.profileTag,
      bio: user.bio
    }));

  res.json({ users: results });
});

app.get('/api/conversations', verifyToken, (req, res) => {
  res.json({
    conversations: [],
    message: 'Conversation storage and real-time sockets are ready to be completed once the PostgreSQL connection is configured.'
  });
});

app.get('/api/settings', verifyToken, (req, res) => {
  res.json({
    settings: {
      privacy: 'all_contacts',
      notifications: true,
      statusPrivacy: 'all_contacts'
    }
  });
});

io.on('connection', (socket) => {
  socket.on('join-room', ({ roomId }) => {
    if (roomId) {
      socket.join(roomId);
    }
  });

  socket.on('send-message', ({ roomId, message }) => {
    if (roomId && message) {
      io.to(roomId).emit('receive-message', message);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Flow Chat API listening on http://localhost:${PORT}`);
});
