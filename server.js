/**
 * Sales Resolve SaaS - Backend Server
 * Express.js API for the SaaS platform
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
// Enable Supabase and email service when environment variables are configured
const { supabase } = require('./config/supabase');
const emailService = require('./services/emailService');
require('dotenv').config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'https://salesresolvefrontend-6bgv.vercel.app',
      'https://salesresolvefrontend.vercel.app',
      'http://localhost:3000'
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// In-memory storage for messages (temporary until Supabase is configured)
let messagesStorage = [
  {
    id: '1',
    name: 'Test User 1',
    email: 'test1@example.com',
    message: 'Test message 1',
    status: 'new',
    created_at: new Date().toISOString()
  },
  {
    id: '2', 
    name: 'Test User 2',
    email: 'test2@example.com',
    message: 'Test message 2',
    status: 'new',
    created_at: new Date().toISOString()
  }
];

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all requests
app.use(limiter);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://salesresolvefrontend-6bgv.vercel.app',
    'https://salesresolvefrontend.vercel.app',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: '1.0.0',
  });
});

// API routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Sales Resolve SaaS API is running',
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Sales Resolve SaaS Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      api: '/api/health',
      messages: '/api/messages',
      auth: '/api/auth',
      projects: '/api/projects',
      clients: '/api/clients'
    },
    timestamp: new Date().toISOString()
  });
});

// Messages API - Hybrid storage (Supabase + in-memory fallback)
app.get('/api/messages', async (req, res) => {
  try {
    // Try Supabase first if configured
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && messages) {
        return res.json({
          messages: messages,
          status: 'OK',
          message: 'Messages fetched from Supabase successfully'
        });
      }
    }
  } catch (error) {
    console.log('Supabase unavailable, using in-memory storage');
  }

  // Fallback to in-memory storage
  res.json({
    messages: messagesStorage,
    status: 'OK',
    message: 'Messages fetched from memory successfully'
  });
});

app.post('/api/messages', async (req, res) => {
  const { name, email, message } = req.body;
  
  if (!name || !email || !message) {
    return res.status(400).json({
      error: 'Missing required fields',
      code: 'VALIDATION_ERROR'
    });
  }
  
  const newMessage = {
    id: Date.now().toString(),
    name,
    email,
    message,
    status: 'new',
    created_at: new Date().toISOString()
  };

  try {
    // Try Supabase first if configured
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('🔍 Attempting to save message to Supabase...');
      const { data: savedMessage, error } = await supabase
        .from('messages')
        .insert({
          name,
          email,
          message,
          status: 'new'
        })
        .select()
        .single();

      if (error) {
        console.log('❌ Supabase error:', error);
      }

      if (!error && savedMessage) {
        // Send email notification
        await emailService.sendNewMessageNotification({ name, email, message });
        
        console.log('📨 New message saved to Supabase:', savedMessage);
        return res.status(201).json({
          message: 'Message sent successfully',
          data: savedMessage
        });
      }
    }
  } catch (error) {
    console.log('❌ Supabase exception:', error.message);
    console.log('Supabase unavailable, using in-memory storage');
  }

  // Fallback to in-memory storage
  messagesStorage.push(newMessage);
  console.log('📨 New message stored in memory:', newMessage);
  console.log('📊 Total messages in memory:', messagesStorage.length);

  res.status(201).json({
    message: 'Message sent successfully (stored in memory)',
    data: newMessage
  });
});

// Auth API
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Mock authentication
  const users = {
    'romanetflavia@gmail.com': { role: 'admin', password: 'admin123' },
    'alex@salesresolve.com': { role: 'team', password: 'team123' },
    'adrian@salesresolve.com': { role: 'team', password: 'team123' }
  };
  
  if (users[email] && users[email].password === password) {
    res.json({
      success: true,
      user: {
        email,
        role: users[email].role,
        name: email.split('@')[0]
      },
      token: 'mock-jwt-token'
    });
  } else {
    res.status(401).json({
      error: 'Invalid credentials',
      code: 'AUTH_ERROR'
    });
  }
});

// Projects API
app.get('/api/projects', (req, res) => {
  res.json({
    projects: [],
    status: 'OK'
  });
});

// Clients API
app.get('/api/clients', (req, res) => {
  res.json({
    clients: [],
    status: 'OK'
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join room based on user role
  socket.on('join-room', (data) => {
    const { roomId, userId, userRole } = data;
    
    // Verify user has access to this room
    if (userRole === 'client') {
      // Clients can only join client rooms
      socket.join(`client-${userId}`);
    } else {
      // Team members and admin can join team rooms
      socket.join(roomId);
    }
    
    console.log(`User ${userId} joined room ${roomId}`);
  });

  // Handle new messages
  socket.on('new-message', (data) => {
    const { roomId, message } = data;
    
    // Broadcast message to room
    io.to(roomId).emit('message-received', {
      ...message,
      timestamp: new Date().toISOString(),
    });
    
    console.log(`Message broadcasted to room ${roomId}`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Don't leak error details in production
  const errorResponse = {
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message,
    code: 'INTERNAL_ERROR',
    ...(NODE_ENV === 'development' && { stack: err.stack }),
  };

  res.status(err.status || 500).json(errorResponse);
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
  });
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Sales Resolve SaaS Backend running on port ${PORT}`);
  console.log(`📱 Environment: ${NODE_ENV}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`💾 Database: Supabase`);
  console.log(`🔒 Security: Enabled`);
  console.log(`📊 Logging: Enabled`);
  console.log(`🌐 CORS Origins: ${JSON.stringify([
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://salesresolvefrontend-6bgv.vercel.app',
    'https://salesresolvefrontend.vercel.app',
    'http://localhost:3000'
  ])}`);
});

module.exports = { app, server, io };

