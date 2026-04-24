const path = require('path');
const fs = require('fs');

const files = [
    './routes/mikrotik',
    './routes/mpesa',
    './routes/communication',
    './routes/receipt',
    './routes/customers',
    './routes/services',
    './routes/settings',
    './workers/billingWorker',
    './services/radiusServer'
];

process.on('uncaughtException', (err) => {
    console.error('FAILED:', err.message);
    process.exit(1);
});

files.forEach(file => {
    console.log('Testing', file, '...');
    require(path.join(__dirname, 'backend/src', file));
    console.log('OK');
});
