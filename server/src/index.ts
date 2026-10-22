import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { ipMiddleware } from './middleware/ip.middleware';
import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import auditRoutes from './routes/audit.routes';
import residentsRoutes from './routes/residents.routes';
import blotterRoutes from './routes/blotter.routes';
import officialsRoutes from './routes/officials.routes';
import templatesRoutes from './routes/templates.routes';
import systemRoutes from './routes/system.routes';
import issuancesRoutes from './routes/issuances.routes';

const app = express();

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(ipMiddleware);

// Baseline health check endpoint
app.get('/api/health', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/residents', residentsRoutes);
app.use('/api/blotter', blotterRoutes);
app.use('/api/officials', officialsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/issuances', issuancesRoutes);

// Production static file serving & SPA fallback
const clientDistPath = path.resolve(__dirname, '../../client/dist');
const serveStatic = express.static(clientDistPath);

// Serve static assets in production mode
app.use((req, res, next) => {
  if (process.env.NODE_ENV?.trim() === 'production') {
    return serveStatic(req, res, next);
  }
  next();
});

// SPA fallback for non-API routes in production mode
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  if (process.env.NODE_ENV?.trim() === 'production') {
    const indexPath = path.join(clientDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

// 404 handler for API routes
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Host and Port configuration
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

let server: ReturnType<typeof app.listen> | null = null;

export function startServer(port = PORT, host = HOST) {
  return app.listen(port, host, () => {
    console.log(`[Barangay System] Server listening on http://${host}:${port}`);
    console.log(`[Barangay System] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

// Automatically start server unless running in test environment
if (process.env.NODE_ENV !== 'test') {
  server = startServer();
}

export { app, server };
export default app;
