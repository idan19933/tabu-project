import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { env } from './config/env';
import { notFound, errorHandler } from './middlewares';
import { apiRouter } from './api/routes';

const app = express();

// Trust proxy for production deployments
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: env.NODE_ENV === 'production' ? env.CORS_ORIGIN : '*',
    credentials: true,
  })
);

// Rate limiting
app.use(
  rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 500,
  })
);

// HTTP logging
app.use(morgan('dev'));

// JSON body parser
app.use(express.json({ limit: '50mb' }));

// API routes
app.use('/api', apiRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '2.0.0' });
});

// Serve static frontend files in production
const staticDir = path.join(__dirname, '..', 'static');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
  });
}

// Error handling
app.use(notFound);
app.use(errorHandler);

export { app };
