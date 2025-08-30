
require('dotenv').config();
const express = require('express');
console.log('[startup] Starting server.js ...');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { authLimiter, apiLimiter } = require('./middleware/rateLimiter');
const { logger } = require('./middleware/logger');
const routeMonitor = require('./middleware/routeMonitor');

// Initialize error tracking
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', reason);
});

// Enable request logging
const requestLogger = morgan('combined', {
    stream: {
        write: (message) => logger.info(message.trim())
    }
});
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');

// Import routes
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const deviceApiRoutes = require('./routes/deviceApi');
const esp32Routes = require('./routes/esp32');
const scheduleRoutes = require('./routes/schedules');
const userRoutes = require('./routes/users');  // Using the new users route
const activityRoutes = require('./routes/activities');
const securityRoutes = require('./routes/security');
const settingsRoutes = require('./routes/settings');

// Import services (only those actively used)
const scheduleService = require('./services/scheduleService');
// Removed legacy DeviceSocketService/TestSocketService/ESP32SocketService for cleanup

// Import Google Calendar routes
const googleCalendarRoutes = require('./routes/googleCalendar');


// MongoDB Connection with retry logic (non-fatal if exhausts)
let dbConnected = false;
const connectDB = async (retries = 5) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iot-automation', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    dbConnected = true;
    logger.info('Connected to MongoDB');
    try {
      await createAdminUser();
    } catch (adminError) {
      logger.error('Admin user creation error:', adminError);
    }
  } catch (err) {
    logger.error('MongoDB connection error (continuing in LIMITED MODE):', err.message || err);
    if (retries > 0) {
      logger.info(`Retrying connection... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return connectDB(retries - 1);
    } else {
      logger.warn('MongoDB not connected. API running in LIMITED MODE (DB-dependent routes may fail).');
    }
  }
};

connectDB().catch(()=>{});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
});

const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Manual preflight handler (before cors) to guarantee PATCH visibility
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const devOrigins = ['http://localhost:5173','http://localhost:5174','http://localhost:5175'];
    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? [process.env.FRONTEND_URL || 'https://your-frontend-domain.com']
      : devOrigins;
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization');
  // Silenced verbose preflight logging
    return res.status(204).end();
  }
  next();
});

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL || 'https://your-frontend-domain.com']
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));



// Body parser (single instance)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize main Socket.IO instance
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? [process.env.FRONTEND_URL || 'https://your-frontend-domain.com']
      : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true
  }
});

// (Removed old namespace socket services)

// Rate limiting - Very permissive for development
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'production' 
    ? (parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100)  // 100 requests per minute in production
    : 1000000,  // Essentially unlimited in development
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting only in production
if (process.env.NODE_ENV === 'production') {
  app.use('/api/', limiter);
}

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes with rate limiting
const apiRouter = express.Router();

// Apply rate limiting to all auth routes
apiRouter.use('/auth', authLimiter);
apiRouter.use('/auth', authRoutes);

// Apply API rate limiting to other routes
apiRouter.use('/bulk', apiLimiter, require('./routes/bulk'));
apiRouter.use('/helper', apiLimiter, require('./routes/helper'));
apiRouter.use('/devices', apiLimiter, deviceRoutes);
apiRouter.use('/device-api', apiLimiter, deviceApiRoutes);
apiRouter.use('/esp32', apiLimiter, esp32Routes);
apiRouter.use('/schedules', apiLimiter, scheduleRoutes);
apiRouter.use('/users', apiLimiter, userRoutes);
apiRouter.use('/activities', apiLimiter, activityRoutes);
apiRouter.use('/security', apiLimiter, securityRoutes);
apiRouter.use('/settings', apiLimiter, settingsRoutes);
// Google Calendar routes (primary path + legacy alias)
apiRouter.use('/google-calendar', apiLimiter, googleCalendarRoutes);
apiRouter.use('/calendar', apiLimiter, googleCalendarRoutes); // legacy alias

// Mount all routes under /api
app.use('/api', apiRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}


// Create default admin user
const createAdminUser = async () => {
  try {
    const User = require('./models/User');
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (!existingAdmin) {
      // IMPORTANT: Provide the plain password here so the pre-save hook hashes it ONCE.
      // Previously this code hashed manually AND the pre-save hook re-hashed, breaking login.
      await User.create({
        name: process.env.ADMIN_NAME || 'System Administrator',
        email: process.env.ADMIN_EMAIL || 'admin@college.edu',
        password: process.env.ADMIN_PASSWORD || 'admin123456',
        role: 'admin',
        department: 'IT Department',
        accessLevel: 'full'
      });
      logger.info('Default admin user created (single-hash)');
    }
  } catch (error) {
    logger.error('Error creating admin user:', error);
  }
};

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  logger.info('Client connected:', socket.id);
  
  socket.on('join-room', (room) => {
    socket.join(room);
    logger.info(`Socket ${socket.id} joined room ${room}`);
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.set('io', io);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Start the server (single attempt)
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

module.exports = { app, io };
