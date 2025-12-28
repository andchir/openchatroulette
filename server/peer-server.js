#!/usr/bin/env node

'use strict';

const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const { ExpressPeerServer } = require('peer');
const Reader = require('@maxmind/geoip2-node').Reader;

require('dotenv').config();

// ============================================================================
// Configuration
// ============================================================================

/**
 * Server configuration object containing all environment settings
 */
const config = {
    port: process.env.PORT || 9000,
    environment: process.env.NODE_ENV || 'prod',
    secure: process.env.SECURE === 'true',
    sslKeyPath: process.env.SSL_KEY || '',
    sslCertPath: process.env.SSL_CERT || '',
    adminUsername: process.env.ADMIN_USERNAME || '',
    adminPassword: process.env.ADMIN_PASSWORD || '',
    geoipDbPath: 'geoip/GeoLite2-Country.mmdb',
    allowedPurposes: ['discussion', 'dating', 'language']
};

// ============================================================================
// Utility Classes
// ============================================================================

/**
 * Utility class providing validation and sanitization methods
 */
class ValidationUtils {
    /**
     * Validate and sanitize country code
     * @param {string} code - Country code to validate
     * @returns {string} Sanitized country code or empty string
     */
    static sanitizeCountryCode(code) {
        if (typeof code !== 'string') {
            return '';
        }
        // Country codes are 2-letter ISO codes
        const sanitized = code.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
        return sanitized.length === 2 ? sanitized : '';
    }

    /**
     * Validate and sanitize purpose value
     * @param {string} purpose - Purpose to validate
     * @returns {string} Valid purpose or default
     */
    static sanitizePurpose(purpose) {
        if (typeof purpose !== 'string') {
            return 'discussion';
        }
        return config.allowedPurposes.includes(purpose) ? purpose : 'discussion';
    }

    /**
     * Safely parse JSON string
     * @param {string} jsonString - JSON string to parse
     * @param {Function} logFn - Logging function
     * @returns {object|null} Parsed object or null on error
     */
    static safeJsonParse(jsonString, logFn = () => {}) {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            logFn('JSON parse error:', error.message);
            return null;
        }
    }

    /**
     * Safely read SSL certificate files
     * @param {string} keyPath - Path to SSL key file
     * @param {string} certPath - Path to SSL certificate file
     * @returns {{key: Buffer, cert: Buffer} | null} SSL options or null on error
     */
    static readSslFiles(keyPath, certPath) {
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
    }
}

// ============================================================================
// GeoIP Service
// ============================================================================

/**
 * Service for GeoIP country detection
 */
class GeoIPService {
    /**
     * Create a new GeoIPService instance
     * @param {string} dbPath - Path to GeoIP database file
     */
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.reader = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the GeoIP reader
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            this.reader = await Reader.open(this.dbPath);
            this.isInitialized = true;
            console.log('GeoIP database loaded successfully.');
        } catch (error) {
            console.error('Warning: GeoIP database not available:', error.message);
            console.error('Country detection will be disabled.');
            this.reader = null;
            this.isInitialized = false;
        }
    }

    /**
     * Detect country from IP address
     * @param {string} ipAddress - IP address to lookup
     * @returns {{countryCode: string, countryName: string}} Country data
     */
    detectCountry(ipAddress) {
        if (!this.reader || !ipAddress) {
            return { countryCode: '', countryName: 'Unknown' };
        }
        try {
            const response = this.reader.country(ipAddress);
            return {
                countryCode: response.country.isoCode || '',
                countryName: response.country.names.en || 'Unknown'
            };
        } catch (error) {
            return { countryCode: '', countryName: 'Unknown' };
        }
    }
}

// ============================================================================
// Peer Manager
// ============================================================================

/**
 * Manages peer connections, data storage, and matching logic
 */
class PeerManager {
    /**
     * Create a new PeerManager instance
     */
    constructor() {
        /** @type {Object.<string, {countryCode: string, countryCodeDetected: string, countryNameDetected: string, purpose: string, connectedAt: number}>} */
        this.peers = {};
        /** @type {Object.<string, Object.<string, string>>} */
        this.peerWaiting = {};
    }

    /**
     * Add a new peer
     * @param {string} peerId - Peer identifier
     * @param {string} countryCode - Detected country code
     * @param {string} countryName - Detected country name
     */
    addPeer(peerId, countryCode, countryName) {
        this.peers[peerId] = {
            countryCode,
            countryCodeDetected: countryCode,
            countryNameDetected: countryName,
            purpose: 'discussion',
            connectedAt: Date.now()
        };
    }

    /**
     * Remove a peer
     * @param {string} peerId - Peer identifier
     */
    removePeer(peerId) {
        if (this.peers[peerId]) {
            this.clearWaitingData(peerId);
            delete this.peers[peerId];
        }
    }

    /**
     * Check if peer exists
     * @param {string} peerId - Peer identifier
     * @returns {boolean} True if peer exists
     */
    hasPeer(peerId) {
        return !!this.peers[peerId];
    }

    /**
     * Get peer data by key
     * @param {string} peerId - Peer ID
     * @param {string} key - Data key to retrieve
     * @param {string} [defaultValue=''] - Default value if not found
     * @returns {string} Peer data value
     */
    getPeerData(peerId, key, defaultValue = '') {
        if (!peerId || typeof peerId !== 'string') {
            return defaultValue;
        }
        const peerData = this.peers[peerId];
        return peerData ? (peerData[key] || defaultValue) : defaultValue;
    }

    /**
     * Set peer data by key
     * @param {string} peerId - Peer ID
     * @param {string} key - Data key to set
     * @param {*} value - Value to set
     */
    setPeerData(peerId, key, value) {
        if (peerId && this.peers[peerId]) {
            this.peers[peerId][key] = value;
        }
    }

    /**
     * Get total number of connected peers
     * @returns {number} Number of connected peers
     */
    getPeerCount() {
        return Object.keys(this.peers).length;
    }

    /**
     * Get all peers data (for admin view)
     * @returns {Object} All peers data
     */
    getAllPeers() {
        return this.peers;
    }

    /**
     * Get waiting data (for admin view)
     * @returns {Object} Waiting data
     */
    getWaitingData() {
        return this.peerWaiting;
    }

    /**
     * Initialize waiting data structure for country and purpose
     * @param {string} countryCode - Country code
     * @param {string} purpose - Purpose value
     * @private
     */
    ensureWaitingStructure(countryCode, purpose) {
        if (!this.peerWaiting[countryCode]) {
            this.peerWaiting[countryCode] = {};
        }
        if (!this.peerWaiting[countryCode][purpose]) {
            this.peerWaiting[countryCode][purpose] = '';
        }
    }

    /**
     * Get peer waiting value for matching
     * @param {string} myPeerId - Current peer ID
     * @returns {string} Waiting peer ID or empty string
     * @private
     */
    getPeerWaitingValue(myPeerId) {
        const countryCode = this.getPeerData(myPeerId, 'countryCode', 'all');
        const purpose = this.getPeerData(myPeerId, 'purpose', 'discussion');
        this.ensureWaitingStructure(countryCode, purpose);
        return this.peerWaiting[countryCode][purpose];
    }

    /**
     * Set peer waiting value
     * @param {string} myPeerId - Current peer ID
     * @param {string} [value] - Value to set (defaults to myPeerId)
     * @private
     */
    setPeerWaitingValue(myPeerId, value) {
        const countryCode = this.getPeerData(myPeerId, 'countryCode', 'all');
        const purpose = this.getPeerData(myPeerId, 'purpose', 'discussion');
        this.ensureWaitingStructure(countryCode, purpose);
        this.peerWaiting[countryCode][purpose] = value !== undefined ? value : myPeerId;
    }

    /**
     * Clear waiting data for a peer
     * @param {string} peerId - Peer ID to clear
     */
    clearWaitingData(peerId) {
        const currentCountryCode = this.getPeerData(peerId, 'countryCode', 'all');
        const currentPurpose = this.getPeerData(peerId, 'purpose', 'all');
        if (this.peerWaiting[currentCountryCode] &&
            this.peerWaiting[currentCountryCode][currentPurpose] === peerId) {
            this.peerWaiting[currentCountryCode][currentPurpose] = '';
        }
    }

    /**
     * Get next peer ID for matching
     * @param {string} myPeerId - Current peer ID
     * @returns {string} Matched peer ID or empty string
     */
    getNextPeerId(myPeerId) {
        const peerWaitingValue = this.getPeerWaitingValue(myPeerId);
        if (peerWaitingValue && peerWaitingValue !== myPeerId) {
            this.setPeerWaitingValue(myPeerId, '');
            return peerWaitingValue;
        }
        if (myPeerId && !peerWaitingValue) {
            this.setPeerWaitingValue(myPeerId);
        }
        return '';
    }
}

// ============================================================================
// OpenChat Roulette Server
// ============================================================================

/**
 * Main server class for OpenChatRoulette
 * Handles HTTP/HTTPS server, PeerJS integration, and request routing
 */
class OpenChatRouletteServer {
    /**
     * Create a new OpenChatRouletteServer instance
     * @param {Object} serverConfig - Server configuration object
     */
    constructor(serverConfig) {
        this.config = serverConfig;
        this.app = express();
        this.server = null;
        this.peerServer = null;
        this.peerManager = new PeerManager();
        this.geoIPService = new GeoIPService(serverConfig.geoipDbPath);
        /**
         * Map storing real client IP addresses by socket remote port.
         * Used to correlate HTTP upgrade requests with WebSocket connections
         * when behind a reverse proxy (nginx).
         * @type {Map<number, string>}
         */
        this.clientIpMap = new Map();
    }

    /**
     * Logging function that only outputs in development mode
     * @param {...any} args - Arguments to log
     */
    log(...args) {
        if (this.config.environment === 'dev') {
            console.log(new Date().toISOString(), ...args);
        }
    }

    /**
     * Extract real client IP address from HTTP upgrade request.
     * Checks proxy headers (X-Real-IP, X-Forwarded-For) first, then falls back to socket.
     * This is needed when running behind nginx reverse proxy.
     * @param {http.IncomingMessage} req - HTTP upgrade request
     * @returns {string} Real client IP address
     * @private
     */
    extractRealIpFromRequest(req) {
        // Check X-Real-IP header first (set by nginx proxy_set_header X-Real-IP)
        const xRealIp = req.headers['x-real-ip'];
        if (xRealIp) {
            return String(xRealIp).replace('::ffff:', '');
        }

        // Check X-Forwarded-For header (can contain multiple IPs: client, proxy1, proxy2)
        const xForwardedFor = req.headers['x-forwarded-for'];
        if (xForwardedFor) {
            // Take the first IP which is the original client
            const clientIp = String(xForwardedFor).split(',')[0].trim();
            return clientIp.replace('::ffff:', '');
        }

        // Fallback to socket remote address (direct connection without proxy)
        const remoteAddress = req.socket?.remoteAddress || '';
        return remoteAddress.replace('::ffff:', '');
    }

    /**
     * Get client IP address from socket, using stored real IP if available.
     * When behind a reverse proxy (nginx), the real IP is captured from the
     * HTTP upgrade request headers and stored in clientIpMap.
     * @param {object} client - Peer client object
     * @returns {string} Client IP address
     * @private
     */
    getClientIpAddress(client) {
        try {
            const socket = client.getSocket();
            if (socket && socket._socket) {
                const remotePort = socket._socket.remotePort;
                // First try to get the real IP from the map (set during HTTP upgrade)
                if (remotePort && this.clientIpMap.has(remotePort)) {
                    return this.clientIpMap.get(remotePort);
                }
                // Fallback to direct socket address
                if (socket._socket.remoteAddress) {
                    return socket._socket.remoteAddress.replace('::ffff:', '');
                }
            }
        } catch (error) {
            this.log('Error getting client IP:', error.message);
        }
        return '';
    }

    /**
     * Set up HTTP upgrade event listener to capture real client IPs.
     * This is called before WebSocket handshake completes, allowing us to
     * extract IP addresses from proxy headers (X-Real-IP, X-Forwarded-For).
     * @private
     */
    setupUpgradeListener() {
        this.server.on('upgrade', (req, socket) => {
            const remotePort = socket.remotePort;
            const realIp = this.extractRealIpFromRequest(req);

            if (remotePort && realIp) {
                this.clientIpMap.set(remotePort, realIp);
                this.log('Captured IP for port', remotePort, ':', realIp);

                // Clean up the map entry when socket closes
                socket.once('close', () => {
                    this.clientIpMap.delete(remotePort);
                    this.log('Cleaned up IP map entry for port', remotePort);
                });
            }
        });
    }

    /**
     * Create HTTP or HTTPS server based on configuration
     * @returns {http.Server|https.Server|null} Server instance or null on error
     * @private
     */
    createServer() {
        if (this.config.secure) {
            const sslOptions = ValidationUtils.readSslFiles(
                this.config.sslKeyPath,
                this.config.sslCertPath
            );
            if (!sslOptions) {
                console.error('Cannot start HTTPS server without valid SSL certificates. Exiting.');
                return null;
            }
            return https.createServer(sslOptions, this.app);
        }
        return http.createServer(this.app);
    }

    /**
     * Create and configure PeerServer
     * @private
     */
    createPeerServer() {
        const peerServerOptions = {
            proxied: true,
            debug: this.config.environment === 'dev',
            path: '/openchatroulette',
            secure: this.config.secure,
            key: 'peerjs'
        };

        if (this.config.secure) {
            const sslOptions = ValidationUtils.readSslFiles(
                this.config.sslKeyPath,
                this.config.sslCertPath
            );
            if (sslOptions) {
                peerServerOptions.ssl = sslOptions;
            }
        }

        this.peerServer = ExpressPeerServer(this.server, peerServerOptions);
        this.setupPeerServerEvents();
    }

    /**
     * Set up PeerServer event handlers
     * @private
     */
    setupPeerServerEvents() {
        this.peerServer.on('connection', (client) => this.handleConnection(client));
        this.peerServer.on('disconnect', (client) => this.handleDisconnect(client));
        this.peerServer.on('message', (client, message) => this.handleMessage(client, message));
        this.peerServer.on('error', (error) => this.handleError(error));
    }

    /**
     * Handle new peer connection
     * @param {object} client - Peer client object
     * @private
     */
    handleConnection(client) {
        const clientId = client.getId();
        const clientIpAddress = this.getClientIpAddress(client);

        const { countryCode, countryName } = this.geoIPService.detectCountry(clientIpAddress);

        this.log('CONNECTION', clientId, clientIpAddress, countryCode);

        this.peerManager.addPeer(clientId, countryCode, countryName);

        try {
            client.send({
                type: 'COUNTRY_DETECTED',
                countryCode,
                countryName
            });
        } catch (error) {
            this.log('Error sending COUNTRY_DETECTED to', clientId, ':', error.message);
        }

        this.log('ALL PEERS', this.peerManager.getPeerCount());
    }

    /**
     * Handle peer disconnection
     * @param {object} client - Peer client object
     * @private
     */
    handleDisconnect(client) {
        const clientId = client.getId();
        this.log('DISCONNECT', clientId);

        this.peerManager.removePeer(clientId);

        this.log('ALL PEERS', this.peerManager.getPeerCount(), 'WAITING', JSON.stringify(this.peerManager.getWaitingData()));
    }

    /**
     * Handle incoming message from peer
     * @param {object} client - Peer client object
     * @param {object} message - Message object
     * @private
     */
    handleMessage(client, message) {
        const clientId = client.getId();
        const messageType = String(message.type || '');

        switch (messageType) {
            case 'NEW_REMOTE_PEER_REQUEST':
                this.handleNewRemotePeerRequest(client, clientId, message);
                break;
            case 'COUNTRY_SET':
                this.handleCountrySet(clientId, message);
                break;
            case 'PURPOSE_SET':
                this.handlePurposeSet(clientId, message);
                break;
            case 'ANSWER':
                this.handleAnswer(client, message);
                break;
            default:
                this.log('Unknown message type:', messageType);
        }
    }

    /**
     * Handle NEW_REMOTE_PEER_REQUEST message
     * @param {object} client - Peer client object
     * @param {string} clientId - Client identifier
     * @param {object} message - Message object
     * @private
     */
    handleNewRemotePeerRequest(client, clientId, message) {
        this.log('MESSAGE', 'NEW_REMOTE_PEER_REQUEST', clientId);
        this.peerManager.clearWaitingData(clientId);

        if (message.payload && this.peerManager.hasPeer(clientId)) {
            const data = ValidationUtils.safeJsonParse(message.payload, (...args) => this.log(...args));
            if (data) {
                this.peerManager.setPeerData(clientId, 'countryCode', ValidationUtils.sanitizeCountryCode(data.countryCode));
                this.peerManager.setPeerData(clientId, 'purpose', ValidationUtils.sanitizePurpose(data.purpose));
            }
        }

        const remotePeerId = this.peerManager.getNextPeerId(clientId);
        try {
            client.send({
                type: 'NEW_REMOTE_PEER',
                peerId: remotePeerId,
                countryCode: this.peerManager.getPeerData(remotePeerId, 'countryCodeDetected')
            });
        } catch (error) {
            this.log('Error sending NEW_REMOTE_PEER to', clientId, ':', error.message);
        }

        this.log('ALL PEERS', this.peerManager.getPeerCount(), 'WAITING', JSON.stringify(this.peerManager.getWaitingData()));
    }

    /**
     * Handle COUNTRY_SET message
     * @param {string} clientId - Client identifier
     * @param {object} message - Message object
     * @private
     */
    handleCountrySet(clientId, message) {
        this.log('MESSAGE', 'COUNTRY_SET', clientId);
        this.peerManager.clearWaitingData(clientId);

        if (this.peerManager.hasPeer(clientId)) {
            const sanitizedCode = typeof message.payload === 'string'
                ? ValidationUtils.sanitizeCountryCode(message.payload)
                : '';
            this.peerManager.setPeerData(clientId, 'countryCode', sanitizedCode);
        }

        this.log('ALL PEERS', this.peerManager.getPeerCount(), 'WAITING', JSON.stringify(this.peerManager.getWaitingData()));
    }

    /**
     * Handle PURPOSE_SET message
     * @param {string} clientId - Client identifier
     * @param {object} message - Message object
     * @private
     */
    handlePurposeSet(clientId, message) {
        this.log('MESSAGE', 'PURPOSE_SET', clientId);
        this.peerManager.clearWaitingData(clientId);

        if (this.peerManager.hasPeer(clientId)) {
            this.peerManager.setPeerData(clientId, 'purpose', ValidationUtils.sanitizePurpose(message.payload));
        }

        this.log('ALL PEERS', this.peerManager.getPeerCount(), 'WAITING', JSON.stringify(this.peerManager.getWaitingData()));
    }

    /**
     * Handle ANSWER message
     * @param {object} client - Peer client object
     * @param {object} message - Message object
     * @private
     */
    handleAnswer(client, message) {
        try {
            client.send({
                type: 'REMOTE_COUNTRY_SET',
                peerId: message.dst,
                countryCode: this.peerManager.getPeerData(message.dst, 'countryCodeDetected')
            });
        } catch (error) {
            this.log('Error sending REMOTE_COUNTRY_SET to', client.getId(), ':', error.message);
        }
    }

    /**
     * Handle PeerServer error
     * @param {Error} error - Error object
     * @private
     */
    handleError(error) {
        console.error('PeerServer error:', error);
    }

    /**
     * Configure Express static file serving
     * @private
     */
    configureStaticFiles() {
        const distPath = path.join(path.dirname(__dirname), 'openchatroulette/dist/openchatroulette');
        this.app.set('views', distPath);
        this.app.use(express.static(path.join(distPath, 'en')));
        this.app.use('/ru', express.static(path.join(distPath, 'ru')));
        this.app.use('/ua', express.static(path.join(distPath, 'ua')));
        this.app.use('/fr', express.static(path.join(distPath, 'fr')));
    }

    /**
     * Configure HTTP routes
     * @private
     */
    configureRoutes() {
        // Main route
        this.app.get('/', (req, res) => {
            res.sendFile('/en/index.html', {
                root: this.app.get('views')
            });
        });

        // Admin route
        this.app.get('/chatadmin', (req, res) => this.handleAdminRoute(req, res));

        // Language route
        this.app.get('/:lang', (req, res) => {
            const lang = req.params.lang;
            if (lang === 'en') {
                res.redirect(301, '/');
                return;
            }
            res.redirect(301, '/en/');
        });
    }

    /**
     * Handle admin route with authentication
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     * @private
     */
    handleAdminRoute(req, res) {
        // Check if admin credentials are configured
        if (!this.config.adminUsername || !this.config.adminPassword) {
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
            this.log('Auth decode error:', error.message);
        }

        // Use constant-time comparison for credentials
        const loginMatch = login && login.length === this.config.adminUsername.length &&
            login.split('').every((char, i) => char === this.config.adminUsername[i]);
        const passwordMatch = password && password.length === this.config.adminPassword.length &&
            password.split('').every((char, i) => char === this.config.adminPassword[i]);

        if (loginMatch && passwordMatch) {
            res.set('Content-Type', 'text/plain; charset=UTF-8');
            const peerCount = this.peerManager.getPeerCount();
            const output = `All peers (${peerCount}): \n\n`
                + JSON.stringify(this.peerManager.getAllPeers(), null, 4)
                + '\n\nWaiting: \n'
                + JSON.stringify(this.peerManager.getWaitingData(), null, 4);
            res.send(output);
            return;
        }

        // Access denied
        res.set('WWW-Authenticate', 'Basic realm="401"');
        res.status(401).send('Authentication required.');
    }

    /**
     * Initialize and start the server
     * @returns {Promise<void>}
     */
    async start() {
        // Initialize GeoIP service
        await this.geoIPService.initialize();

        // Create HTTP/HTTPS server
        this.server = this.createServer();
        if (!this.server) {
            process.exit(1);
        }

        // Set up upgrade listener to capture real client IPs from proxy headers
        // This must be done before PeerServer setup to intercept WebSocket upgrades
        this.setupUpgradeListener();

        // Create and configure PeerServer
        this.createPeerServer();

        // Configure Express
        this.configureStaticFiles();
        this.app.use(this.peerServer);
        this.configureRoutes();

        // Start listening
        this.server.listen(this.config.port, () => {
            console.log('PeerServer initialized.');
            console.log(`Listening on: ${this.config.port}`);
            console.log(`Environment: ${this.config.environment}`);
            console.log(`Secure: ${this.config.secure}`);
        });
    }
}

// ============================================================================
// Application Entry Point
// ============================================================================

const server = new OpenChatRouletteServer(config);
server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
