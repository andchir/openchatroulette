#!/usr/bin/env node

'use strict';

const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const {ExpressPeerServer} = require('peer');
const Reader = require('@maxmind/geoip2-node').Reader;

require('dotenv').config();

const port = process.env.PORT || 9000;
const environment = process.env.NODE_ENV || 'prod';
const GEOIP_DB_PATH = 'geoip/GeoLite2-Country.mmdb';

// Allowed purposes for chat to prevent arbitrary values
const ALLOWED_PURPOSES = ['discussion', 'dating', 'language'];

/**
 * Safely read SSL certificate files
 * @param {string} keyPath - Path to SSL key file
 * @param {string} certPath - Path to SSL certificate file
 * @returns {{key: Buffer, cert: Buffer} | null} SSL options or null on error
 */
const readSslFiles = (keyPath, certPath) => {
    try {
        if (!keyPath || !certPath) {
            console.error('SSL_KEY and SSL_CERT environment variables are required when SECURE=true');
            return null;
        }
        return {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
        };
    } catch (error) {
        console.error('Failed to read SSL certificate files:', error.message);
        return null;
    }
};

/**
 * Logging function that only outputs in development mode
 * @param {...any} args - Arguments to log
 */
const logging = (...args) => {
    if (environment === 'dev') {
        console.log(new Date().toISOString(), ...args);
    }
};

/**
 * Validate and sanitize country code
 * @param {string} code - Country code to validate
 * @returns {string} Sanitized country code or empty string
 */
const sanitizeCountryCode = (code) => {
    if (typeof code !== 'string') {
        return '';
    }
    // Country codes are 2-letter ISO codes
    const sanitized = code.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    return sanitized.length === 2 ? sanitized : '';
};

/**
 * Validate and sanitize purpose value
 * @param {string} purpose - Purpose to validate
 * @returns {string} Valid purpose or default
 */
const sanitizePurpose = (purpose) => {
    if (typeof purpose !== 'string') {
        return 'discussion';
    }
    return ALLOWED_PURPOSES.includes(purpose) ? purpose : 'discussion';
};

/**
 * Safely parse JSON string
 * @param {string} jsonString - JSON string to parse
 * @returns {object|null} Parsed object or null on error
 */
const safeJsonParse = (jsonString) => {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        logging('JSON parse error:', error.message);
        return null;
    }
};

/**
 * Get client IP address from socket
 * @param {object} client - Peer client object
 * @returns {string} Client IP address
 */
const getClientIpAddress = (client) => {
    try {
        const socket = client.getSocket();
        if (socket && socket._socket && socket._socket.remoteAddress) {
            return socket._socket.remoteAddress.replace('::ffff:', '');
        }
    } catch (error) {
        logging('Error getting client IP:', error.message);
    }
    return '';
};

const app = express();

// Create server based on SECURE setting
let server;
if (process.env.SECURE === 'true') {
    const sslOptions = readSslFiles(process.env.SSL_KEY, process.env.SSL_CERT);
    if (!sslOptions) {
        console.error('Cannot start HTTPS server without valid SSL certificates. Exiting.');
        process.exit(1);
    }
    server = https.createServer(sslOptions, app);
} else {
    server = http.createServer(app);
}

const auth = {
    login: process.env.ADMIN_USERNAME || '',
    password: process.env.ADMIN_PASSWORD || ''
};

// Configure peer server options
const peerServerOptions = {
    proxied: true,
    debug: environment === 'dev',
    path: '/openchatroulette',
    secure: process.env.SECURE === 'true',
    key: 'peerjs'
};

// Add SSL options only if SECURE is true
if (process.env.SECURE === 'true') {
    const sslOptions = readSslFiles(process.env.SSL_KEY, process.env.SSL_CERT);
    if (sslOptions) {
        peerServerOptions.ssl = sslOptions;
    }
}

const peerServer = ExpressPeerServer(server, peerServerOptions);

app.set('views', path.join(path.dirname(__dirname), 'openchatroulette/dist/openchatroulette'));
app.use(express.static(path.join(path.dirname(__dirname), 'openchatroulette/dist/openchatroulette/en')));
app.use('/ru', express.static(path.join(path.dirname(__dirname), 'openchatroulette/dist/openchatroulette/ru')));
app.use('/ua', express.static(path.join(path.dirname(__dirname), 'openchatroulette/dist/openchatroulette/ua')));
app.use('/fr', express.static(path.join(path.dirname(__dirname), 'openchatroulette/dist/openchatroulette/fr')));
app.use(peerServer);

// Peer data storage
const peers = {};
const peerWaiting = {};

// GeoIP reader - initialized once at startup
let geoReader = null;

/**
 * Initialize GeoIP reader
 * @returns {Promise<void>}
 */
const initGeoReader = async () => {
    try {
        geoReader = await Reader.open(GEOIP_DB_PATH);
        console.log('GeoIP database loaded successfully.');
    } catch (error) {
        console.error('Warning: GeoIP database not available:', error.message);
        console.error('Country detection will be disabled.');
        geoReader = null;
    }
};

/**
 * Get peer data by key
 * @param {string} peerId - Peer ID
 * @param {string} key - Data key to retrieve
 * @param {string} [defaultValue=''] - Default value if not found
 * @returns {string} Peer data value
 */
const getPeerData = (peerId, key, defaultValue = '') => {
    if (!peerId || typeof peerId !== 'string') {
        return defaultValue;
    }
    const peerData = peers[peerId];
    return peerData ? (peerData[key] || defaultValue) : defaultValue;
};

/**
 * Set peer data by key
 * @param {string} peerId - Peer ID
 * @param {string} key - Data key to set
 * @param {*} value - Value to set
 */
const setPeerData = (peerId, key, value) => {
    if (peerId && peers[peerId]) {
        peers[peerId][key] = value;
    }
};

/**
 * Initialize waiting data structure for country and purpose
 * @param {string} countryCode - Country code
 * @param {string} purpose - Purpose value
 */
const ensureWaitingStructure = (countryCode, purpose) => {
    if (!peerWaiting[countryCode]) {
        peerWaiting[countryCode] = {};
    }
    if (!peerWaiting[countryCode][purpose]) {
        peerWaiting[countryCode][purpose] = '';
    }
};

/**
 * Get peer waiting value for matching
 * @param {string} myPeerId - Current peer ID
 * @returns {string} Waiting peer ID or empty string
 */
const getPeerWaitingValue = (myPeerId) => {
    const countryCode = getPeerData(myPeerId, 'countryCode', 'all');
    const purpose = getPeerData(myPeerId, 'purpose', 'discussion');
    ensureWaitingStructure(countryCode, purpose);
    return peerWaiting[countryCode][purpose];
};

/**
 * Set peer waiting value
 * @param {string} myPeerId - Current peer ID
 * @param {string} [value] - Value to set (defaults to myPeerId)
 */
const setPeerWaitingValue = (myPeerId, value) => {
    const countryCode = getPeerData(myPeerId, 'countryCode', 'all');
    const purpose = getPeerData(myPeerId, 'purpose', 'discussion');
    ensureWaitingStructure(countryCode, purpose);
    peerWaiting[countryCode][purpose] = value !== undefined ? value : myPeerId;
};

/**
 * Clear waiting data for a peer
 * @param {string} peerId - Peer ID to clear
 */
const clearWaitingData = (peerId) => {
    const currentCountryCode = getPeerData(peerId, 'countryCode', 'all');
    const currentPurpose = getPeerData(peerId, 'purpose', 'all');
    if (peerWaiting[currentCountryCode] &&
        peerWaiting[currentCountryCode][currentPurpose] === peerId) {
        peerWaiting[currentCountryCode][currentPurpose] = '';
    }
};

/**
 * Get next peer ID for matching
 * @param {string} myPeerId - Current peer ID
 * @returns {string} Matched peer ID or empty string
 */
const getNextPeerId = (myPeerId) => {
    const peerWaitingValue = getPeerWaitingValue(myPeerId);
    if (peerWaitingValue && peerWaitingValue !== myPeerId) {
        setPeerWaitingValue(myPeerId, '');
        return peerWaitingValue;
    }
    if (myPeerId && !peerWaitingValue) {
        setPeerWaitingValue(myPeerId);
    }
    return '';
};

/**
 * Detect country from IP address using GeoIP
 * @param {string} ipAddress - IP address to lookup
 * @returns {{countryCode: string, countryName: string}} Country data
 */
const detectCountry = (ipAddress) => {
    if (!geoReader || !ipAddress) {
        return { countryCode: '', countryName: 'Unknown' };
    }
    try {
        const response = geoReader.country(ipAddress);
        return {
            countryCode: response.country.isoCode || '',
            countryName: response.country.names.en || 'Unknown'
        };
    } catch (error) {
        logging('GeoIP lookup failed for', ipAddress, ':', error.message);
        return { countryCode: '', countryName: 'Unknown' };
    }
};

// Peer server event handlers
peerServer.on('connection', (client) => {
    const clientId = client.getId();
    const clientIpAddress = getClientIpAddress(client);
    logging('CONNECTION', clientId, clientIpAddress);

    const { countryCode, countryName } = detectCountry(clientIpAddress);

    peers[clientId] = {
        countryCode,
        countryCodeDetected: countryCode,
        countryNameDetected: countryName,
        purpose: 'discussion',
        connectedAt: Date.now()
    };

    try {
        client.send({
            type: 'COUNTRY_DETECTED',
            countryCode,
            countryName
        });
    } catch (error) {
        logging('Error sending COUNTRY_DETECTED to', clientId, ':', error.message);
    }

    logging('ALL PEERS', Object.keys(peers).length);
});

peerServer.on('disconnect', (client) => {
    const clientId = client.getId();
    logging('DISCONNECT', clientId);

    if (peers[clientId]) {
        clearWaitingData(clientId);
        delete peers[clientId];
    }

    logging('ALL PEERS', Object.keys(peers).length, 'WAITING', JSON.stringify(peerWaiting));
});

peerServer.on('message', (client, message) => {
    const clientId = client.getId();
    const messageType = String(message.type || '');

    switch (messageType) {
        case 'NEW_REMOTE_PEER_REQUEST': {
            logging('MESSAGE', messageType, clientId);
            clearWaitingData(clientId);

            if (message.payload && peers[clientId]) {
                const data = safeJsonParse(message.payload);
                if (data) {
                    setPeerData(clientId, 'countryCode', sanitizeCountryCode(data.countryCode));
                    setPeerData(clientId, 'purpose', sanitizePurpose(data.purpose));
                }
            }

            const remotePeerId = getNextPeerId(clientId);
            try {
                client.send({
                    type: 'NEW_REMOTE_PEER',
                    peerId: remotePeerId,
                    countryCode: getPeerData(remotePeerId, 'countryCodeDetected')
                });
            } catch (error) {
                logging('Error sending NEW_REMOTE_PEER to', clientId, ':', error.message);
            }

            logging('ALL PEERS', Object.keys(peers).length, 'WAITING', JSON.stringify(peerWaiting));
            break;
        }

        case 'COUNTRY_SET': {
            logging('MESSAGE', messageType, clientId);
            clearWaitingData(clientId);

            if (peers[clientId]) {
                const sanitizedCode = typeof message.payload === 'string'
                    ? sanitizeCountryCode(message.payload)
                    : '';
                setPeerData(clientId, 'countryCode', sanitizedCode);
            }

            logging('ALL PEERS', Object.keys(peers).length, 'WAITING', JSON.stringify(peerWaiting));
            break;
        }

        case 'PURPOSE_SET': {
            logging('MESSAGE', messageType, clientId);
            clearWaitingData(clientId);

            if (peers[clientId]) {
                setPeerData(clientId, 'purpose', sanitizePurpose(message.payload));
            }

            logging('ALL PEERS', Object.keys(peers).length, 'WAITING', JSON.stringify(peerWaiting));
            break;
        }

        case 'ANSWER': {
            try {
                client.send({
                    type: 'REMOTE_COUNTRY_SET',
                    peerId: message.dst,
                    countryCode: getPeerData(message.dst, 'countryCodeDetected')
                });
            } catch (error) {
                logging('Error sending REMOTE_COUNTRY_SET to', clientId, ':', error.message);
            }
            break;
        }

        default:
            logging('Unknown message type:', messageType);
    }
});

peerServer.on('error', (error) => {
    console.error('PeerServer error:', error);
});

// HTTP Routes
app.get('/', (req, res) => {
    res.sendFile('/en/index.html', {
        root: app.get('views')
    });
});

app.get('/chatadmin', (req, res) => {
    // Check if admin credentials are configured
    if (!auth.login || !auth.password) {
        res.status(503).send('Admin interface not configured.');
        return;
    }

    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    let login = '';
    let password = '';

    try {
        const decoded = Buffer.from(b64auth, 'base64').toString();
        const colonIndex = decoded.indexOf(':');
        if (colonIndex > -1) {
            login = decoded.slice(0, colonIndex);
            password = decoded.slice(colonIndex + 1);
        }
    } catch (error) {
        logging('Auth decode error:', error.message);
    }

    // Use constant-time comparison for credentials
    const loginMatch = login && login.length === auth.login.length &&
        login.split('').every((char, i) => char === auth.login[i]);
    const passwordMatch = password && password.length === auth.password.length &&
        password.split('').every((char, i) => char === auth.password[i]);

    if (loginMatch && passwordMatch) {
        res.set('Content-Type', 'text/plain; charset=UTF-8');
        const peerCount = Object.keys(peers).length;
        const output = `All peers (${peerCount}): \n\n`
            + JSON.stringify(peers, null, 4)
            + '\n\nWaiting: \n'
            + JSON.stringify(peerWaiting, null, 4);
        res.send(output);
        return;
    }

    // Access denied
    res.set('WWW-Authenticate', 'Basic realm="401"');
    res.status(401).send('Authentication required.');
});

// Language route - redirect to root for /en, otherwise to /en/
app.get('/:lang', (req, res) => {
    const lang = req.params.lang;

    if (lang === 'en') {
        res.redirect(301, '/');
        return;
    }
    res.redirect(301, '/en/');
});

// Initialize and start server
const startServer = async () => {
    await initGeoReader();

    server.listen(port, () => {
        console.log('PeerServer initialized.');
        console.log(`Listening on: ${port}`);
        console.log(`Environment: ${environment}`);
        console.log(`Secure: ${process.env.SECURE === 'true'}`);
    });
};

startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
