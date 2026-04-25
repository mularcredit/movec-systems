const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * Movec Connect Backend Server (Express 4 Stable)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// 1. GLOBAL SAFETY NET
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL UNCAUGHT EXCEPTION]', err);
    process.exit(1);
});

// 2. ENVIRONMENT VALIDATION
(function validateEnvironment() {
    const missing = [];
    if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!process.env.SUPABASE_SERVICE_KEY) missing.push('SUPABASE_SERVICE_KEY');
    if (!process.env.ENCRYPTION_KEY) missing.push('ENCRYPTION_KEY');

    if (missing.length > 0) {
        console.error('[STARTUP FAILURE] Missing critical env vars:', missing.join(', '));
        process.exit(1);
    }
    console.log('[STARTUP] Environment validation passed.');
})();

// 3. DEPENDENCIES
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const mikrotikRoutes      = require('./routes/mikrotik');
const mpesaRoutes         = require('./routes/mpesa');
const communicationRoutes = require('./routes/communication');
const receiptRoutes       = require('./routes/receipt');
const customerRoutes      = require('./routes/customers');
const servicesRoutes      = require('./routes/services');
const settingsRoutes      = require('./routes/settings');
const paymentMonitorRoutes = require('./routes/paymentMonitor');
const sessionsRoutes       = require('./routes/sessions');
const billingWorker       = require('./workers/billingWorker');
const radiusServer        = require('./services/radiusServer');

const app  = express();
const PORT = process.env.PORT || 3000;

// 4. MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const requireAuth = require('./middlewares/requireAuth');

// 5. API ROUTES
app.use('/api/router',          requireAuth, mikrotikRoutes);
app.use('/api/mpesa',           mpesaRoutes);
app.use('/api/comms',           requireAuth, communicationRoutes);
app.use('/api/payments',        requireAuth, receiptRoutes);
app.use('/api/customers',       requireAuth, customerRoutes);
app.use('/api/services',        requireAuth, servicesRoutes);
app.use('/api/settings',        requireAuth, settingsRoutes);
app.use('/api/payment-monitor', requireAuth, paymentMonitorRoutes);
app.use('/api/sessions',        requireAuth, sessionsRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.2' });
});

// 6. STATIC FILES (FRONTEND)
const possiblePaths = [
    path.join(__dirname, '../../frontend/dist'),
    path.join(__dirname, '../frontend/dist'),
    path.join(process.cwd(), 'frontend/dist')
];

let frontendDistPath = possiblePaths[0];
for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        frontendDistPath = p;
        break;
    }
}

console.log(`[STARTUP] Serving static files from: ${frontendDistPath}`);
app.use(express.static(frontendDistPath));

// 7. CATCH-ALL (Serve Frontend)
app.use((req, res) => {
    // If it's an API call that wasn't caught, 404 it
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Endpoint not found' });
    }
    
    // Otherwise, serve index.html for client-side routing
    const indexPath = path.join(frontendDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Frontend application not found.');
    }
});

// 8. BOOT
console.log(`[STARTUP] Attempting to start server on port ${PORT}...`);

// Start background services in parallel (non-blocking)
Promise.resolve().then(() => {
    billingWorker.start();
    radiusServer.start();
    console.log('[STARTUP] Background services initialization triggered.');
}).catch(err => {
    console.error('[CRITICAL] Background services failed to trigger:', err);
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SUCCESS] Movec Connect Server listening on http://0.0.0.0:${PORT}`);
});

server.on('error', (err) => {
    console.error('[CRITICAL] Server failed to bind to port:', err);
    process.exit(1);
});
