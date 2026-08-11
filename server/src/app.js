require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const ApiError = require('./utils/ApiError');
const prisma = require('./utils/prisma');

// Routes
const authRoutes = require('./routes/auth.routes');
const propertyRoutes = require('./routes/property.routes');
const unitRoutes = require('./routes/unit.routes');
const tenantRoutes = require('./routes/tenant.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const paymentRoutes = require('./routes/payment.routes');
const expenseRoutes = require('./routes/expense.routes');
const reportRoutes = require('./routes/report.routes');
const notificationRoutes = require('./routes/notification.routes');
const maintenanceRoutes = require('./routes/maintenance.routes');
const ownerRoutes = require('./routes/owner.routes');
const vendorRoutes = require('./routes/vendor.routes');
const leaseRoutes = require('./routes/lease.routes');
const prospectRoutes = require('./routes/prospect.routes');
const inspectionRoutes = require('./routes/inspection.routes');
const budgetRoutes = require('./routes/budget.routes');
const accountRoutes = require('./routes/account.routes');
const ledgerRoutes = require('./routes/ledger.routes');
const importRoutes = require('./routes/import.routes');

const app = express();

// Trust Railway's proxy so express-rate-limit can read X-Forwarded-For correctly
app.set('trust proxy', 1);

// Security
app.use(helmet());
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts, please try again later.' },
});

app.use(limiter);

// Parsing & utilities
app.use(compression());
// `verify` stashes the exact raw bytes onto req.rawBody — webhook signature
// checks must hash the raw body, not a re-serialized copy of req.body
// (whitespace/key-order differences would break the HMAC comparison).
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
}

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'RentFlow API is running', timestamp: new Date().toISOString() });
});

// API routes
const API = '/api/v1';
app.use(`${API}/auth`, authLimiter, authRoutes);
app.use(`${API}/properties`, propertyRoutes);
app.use(`${API}/units`, unitRoutes);
app.use(`${API}/properties/:propertyId/units`, require('./routes/unit.routes'));
app.use(`${API}/tenants`, tenantRoutes);
app.use(`${API}/invoices`, invoiceRoutes);
app.use(`${API}/payments`, paymentRoutes);
app.use(`${API}/expenses`, expenseRoutes);
app.use(`${API}/reports`, reportRoutes);
app.use(`${API}/notifications`, notificationRoutes);
app.use(`${API}/maintenance`, maintenanceRoutes);
app.use(`${API}/owner`, ownerRoutes);
app.use(`${API}/vendors`, vendorRoutes);
app.use(`${API}/lease-documents`, leaseRoutes);
app.use(`${API}/prospects`, prospectRoutes);
app.use(`${API}/inspections`, inspectionRoutes);
app.use(`${API}/budgets`, budgetRoutes);
app.use(`${API}/accounts`, accountRoutes);
app.use(`${API}/ledger`, ledgerRoutes);
app.use(`${API}/imports`, importRoutes);

// 404 handler
app.use((req, res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.path} not found`));
});

// Global error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    // Backfill any chart-of-accounts entries added since an org registered
    // (e.g. a new expense category) — upsert is a no-op where the account
    // already exists, so this is cheap and safe to run on every boot.
    const { seedDefaultChartOfAccounts } = require('./utils/defaultChartOfAccounts');
    const organizations = await prisma.organization.findMany({ select: { id: true } });
    await Promise.all(organizations.map((org) => seedDefaultChartOfAccounts(prisma, org.id)));

    // Initialize scheduled jobs
    if (process.env.NODE_ENV !== 'test') {
      const { initializeJobs } = require('./jobs/invoiceJob');
      initializeJobs();
      logger.info('Cron jobs initialized');
    }

    const server = app.listen(PORT, () => {
      logger.info(`RentFlow API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Server closed');
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return server;
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
