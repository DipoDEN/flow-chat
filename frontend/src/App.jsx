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
const conversations = [];

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

const getUserById = (userId) => inMemoryUsers.find((user) => user.id === userId);

const buildConversationSummary = (conversation, currentUserId) => {
  const participants = (conversation.participants || []).filter((userId) => userId !== currentUserId);
  const otherUser = participants.length ? getUserById(participants[0]) : null;
  const lastMessage = (conversation.messages || []).at(-1);

  return {
    id: conversation.id,
    name: otherUser ? otherUser.displayName : conversation.name || 'Chat',
    username: otherUser ? otherUser.username : '',
    lastMessage: lastMessage ? lastMessage.content : 'No messages yet',
    timestamp: lastMessage ? lastMessage.createdAt : conversation.createdAt,
    unreadCount: 0,
    online: otherUser ? true : false,
    participants: conversation.participants || []
  };
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

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedUsername = String(username).trim();

  const emailExists = inMemoryUsers.some((user) => user.email === normalizedEmail);
  const usernameExists = inMemoryUsers.some((user) => user.username === normalizedUsername);

  if (emailExists || usernameExists) {
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
  const user = getUserById(req.user.sub);

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
  const currentUserId = req.user.sub;

  const visibleConversations = conversations
    .filter((conversation) => (conversation.participants || []).includes(currentUserId))
    .map((conversation) => buildConversationSummary(conversation, currentUserId));

  res.json({ conversations: visibleConversations });
});

app.post('/api/conversations', verifyToken, (req, res) => {
  const { userId } = req.body || {};
  const currentUserId = req.user.sub;

  if (!userId || userId === currentUserId) {
    return res.status(400).json({ error: 'Valid contact id required to start a chat.' });
  }

  const existing = conversations.find((conversation) => {
    const participants = conversation.participants || [];
    return participants.includes(currentUserId) && participants.includes(userId);
  });

  if (existing) {
    return res.status(200).json({ conversation: buildConversationSummary(existing, currentUserId) });
  }

  const newConversation = {
    id: uuidv4(),
    participants: [currentUserId, userId],
    messages: [{
      id: uuidv4(),
      senderId: currentUserId,
      content: 'Hello! Started a new conversation.',
      createdAt: new Date().toISOString(),
      type: 'text'
    }],
    createdAt: new Date().toISOString(),
    name: 'Private chat'
  };

  conversations.push(newConversation);

  return res.status(201).json({ conversation: buildConversationSummary(newConversation, currentUserId) });
});

app.get('/api/conversations/:conversationId/messages', verifyToken, (req, res) => {
  const currentUserId = req.user.sub;
  const conversation = conversations.find((item) => item.id === req.params.conversationId);

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found.' });
  }

  if (!(conversation.participants || []).includes(currentUserId)) {
    return res.status(403).json({ error: 'You are not a member of this conversation.' });
  }

  const normalizedMessages = (conversation.messages || []).map((message) => ({
    id: message.id,
    content: message.content,
    createdAt: message.createdAt,
    senderId: message.senderId,
    sender: getUserById(message.senderId)
      ? {
          id: getUserById(message.senderId).id,
          displayName: getUserById(message.senderId).displayName,
          username: getUserById(message.senderId).username
        }
      : null,
    type: message.type || 'text'
  }));

  return res.json({ conversationId: conversation.id, messages: normalizedMessages });
});

app.post('/api/conversations/:conversationId/messages', verifyToken, async (req, res) => {
  const currentUserId = req.user.sub;
  const { content, type = 'text' } = req.body || {};
  const conversation = conversations.find((item) => item.id === req.params.conversationId);

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found.' });
  }

  if (!(conversation.participants || []).includes(currentUserId)) {
    return res.status(403).json({ error: 'You are not a member of this conversation.' });
  }

  const messageText = String(content || '').trim();
  if (!messageText) {
    return res.status(400).json({ error: 'Message content is required.' });
  }

  const message = {
    id: uuidv4(),
    senderId: currentUserId,
    content: messageText,
    createdAt: new Date().toISOString(),
    type
  };

  conversation.messages = conversation.messages || [];
  conversation.messages.push(message);

  const payload = {
    id: message.id,
    senderId: message.senderId,
    content: message.content,
    createdAt: message.createdAt,
    type: message.type,
    sender: getUserById(message.senderId)
      ? {
          id: getUserById(message.senderId).id,
          displayName: getUserById(message.senderId).displayName,
          username: getUserById(message.senderId).username
        }
      : null
  };

  io.to(`conversation:${conversation.id}`).emit('new-message', payload);

  return res.status(201).json({ message: payload });
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

const getUserRoomName = (userId) => `user:${userId}`;

io.on('connection', (socket) => {
  socket.on('register-user', ({ userId }) => {
    if (!userId) return;
    socket.join(getUserRoomName(userId));
  });

  socket.on('join-room', ({ conversationId }) => {
    if (conversationId) {
      socket.join(`conversation:${conversationId}`);
    }
  });

  socket.on('send-message', ({ conversationId, message }) => {
    if (conversationId && message) {
      const conversation = conversations.find((item) => item.id === conversationId);
      if (!conversation) return;

      const payload = {
        id: message.id || uuidv4(),
        senderId: message.senderId,
        content: message.content,
        createdAt: message.createdAt || new Date().toISOString(),
        type: message.type || 'text',
        sender: getUserById(message.senderId)
          ? {
              id: getUserById(message.senderId).id,
              displayName: getUserById(message.senderId).displayName,
              username: getUserById(message.senderId).username
            }
          : null
      };

      conversation.messages = conversation.messages || [];
      conversation.messages.push({
        id: payload.id,
        senderId: payload.senderId,
        content: payload.content,
        createdAt: payload.createdAt,
        type: payload.type
      });

      io.to(`conversation:${conversationId}`).emit('new-message', payload);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Flow Chat API listening on http://localhost:${PORT}`);
});

if (inMemoryUsers.length === 0) {
  inMemoryUsers.push({
    id: 'seed-user-1',
    email: 'nisha@example.com',
    username: 'nisha',
    displayName: 'Nisha Roy',
    passwordHash: bcrypt.hashSync('password123', 12),
    emailVerified: true,
    createdAt: new Date().toISOString(),
    profilePictureUrl: '',
    profileTag: '@nisha',
    bio: 'Product designer.'
  });

  inMemoryUsers.push({
    id: 'seed-user-2',
    email: 'arjun@example.com',
    username: 'arjun',
    displayName: 'Arjun Sen',
    passwordHash: bcrypt.hashSync('password123', 12),
    emailVerified: true,
    createdAt: new Date().toISOString(),
    profilePictureUrl: '',
    profileTag: '@arjun',
    bio: 'Frontend engineer.'
  });

  conversations.push({
    id: 'seed-conversation-1',
    participants: ['seed-user-1', 'seed-user-2'],
    messages: [
      {
        id: uuidv4(),
        senderId: 'seed-user-1',
        content: 'Hey! I’m in the app now. You can message me here.',
        createdAt: new Date().toISOString(),
        type: 'text'
      }
    ],
    createdAt: new Date().toISOString(),
    name: 'Arjun Sen'
  });
}
