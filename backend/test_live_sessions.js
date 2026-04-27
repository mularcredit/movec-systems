require('dotenv').config();
const radiusService = require('./src/services/radiusServer');

// This script is run inside the active process to read live state. 
// But wait! We can't import the active process state from another node command.
// We can just look at the active backend container logs instead!
console.log('Use docker compose logs to view active packet traces.');
