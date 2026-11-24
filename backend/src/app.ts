import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { adminAuth } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import contactRoutes from './routes/contactRoutes';
import campaignRoutes from './routes/campaignRoutes';
import statsRoutes from './routes/statsRoutes';
import trackingRoutes from './routes/trackingRoutes';
import { setupSwagger } from './docs/swagger';

dotenv.config();

const app = express();

// Security headers with allowance for Swagger and tracking pixel
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })
);

// Body parsers
app.use(express.json({ limit: '5mb' }));
app.use(express.text({ type: 'text/csv', limit: '5mb' }));

// Rate limiting for API endpoints (protects against abuse)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // max 1000 requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests, please try again later.' } },
});

// Health check endpoint (public)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Swagger / OpenAPI documentation
setupSwagger(app);

// Tracking endpoints (public - tracking pixel & signed unsubscribe)
app.use('/api/track', trackingRoutes);

// Protected API routes with rate-limiting and admin token auth
app.use('/api', apiLimiter);
app.use('/api/dashboard', adminAuth, statsRoutes);
app.use('/api/contacts', adminAuth, contactRoutes);
app.use('/api/campaigns', adminAuth, campaignRoutes);

// Global Error Handler
app.use(errorHandler);

export { app };
