#!/usr/bin/env node

/**
 * Test script to verify IP extraction via HTTP upgrade event interception.
 * This approach captures the HTTP upgrade request before WebSocket handshake completes.
 */

'use strict';

const express = require('express');
const http = require('http');
const { ExpressPeerServer } = require('peer');
const WebSocket = require('ws');

const port = 9996;

const app = express();
const server = http.createServer(app);

// Map to store client IP addresses by socket remote port
// We use remote port because it's unique per connection and available on both
// the upgrade request socket and the WebSocket's _socket
const clientIpMap = new Map();

/**
 * Extract real IP address from request headers or socket
 * @param {http.IncomingMessage} req - HTTP upgrade request
 * @returns {string} Real client IP address
 */
function extractRealIp(req) {
    // Check X-Real-IP header first (set by nginx proxy_set_header X-Real-IP)
    const xRealIp = req.headers['x-real-ip'];
    if (xRealIp) {
        console.log('  Found X-Real-IP header:', xRealIp);
        return xRealIp;
    }

    // Check X-Forwarded-For header (can contain multiple IPs: client, proxy1, proxy2)
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
        // Take the first IP which is the original client
        const clientIp = xForwardedFor.split(',')[0].trim();
        console.log('  Found X-Forwarded-For header:', xForwardedFor, '-> using:', clientIp);
        return clientIp;
    }

    // Fallback to socket remote address
    const remoteAddress = req.socket.remoteAddress || '';
    const ip = remoteAddress.replace('::ffff:', '');
    console.log('  Using socket remoteAddress:', ip);
    return ip;
}

// Intercept HTTP upgrade events to capture client IP before WebSocket handshake
server.on('upgrade', (req, socket, head) => {
    // Store IP mapped to socket's remote port (unique identifier for this connection)
    const remotePort = socket.remotePort;
    const realIp = extractRealIp(req);

    console.log('\n=== HTTP Upgrade Event ===');
    console.log('Remote port:', remotePort);
    console.log('Real IP:', realIp);
    console.log('URL:', req.url);

    // Store in map for later retrieval
    clientIpMap.set(remotePort, realIp);

    // Clean up the map entry when socket closes
    socket.once('close', () => {
        clientIpMap.delete(remotePort);
        console.log(`Cleaned up IP map entry for port ${remotePort}`);
    });
});

// PeerServer setup
const peerServerOptions = {
    proxied: true,
    debug: true,
    path: '/openchatroulette',
    key: 'peerjs'
};

const peerServer = ExpressPeerServer(server, peerServerOptions);

// PeerServer connection handler
peerServer.on('connection', (client) => {
    console.log('\n=== PeerServer Connection ===');
    console.log('Client ID:', client.getId());

    const socket = client.getSocket();
    if (socket && socket._socket) {
        const remotePort = socket._socket.remotePort;
        console.log('Socket remote port:', remotePort);

        // Retrieve the stored real IP
        const realIp = clientIpMap.get(remotePort);
        console.log('Retrieved real IP from map:', realIp);

        // Also show direct socket address for comparison
        console.log('Direct socket remoteAddress:', socket._socket.remoteAddress?.replace('::ffff:', ''));
    }
});

app.use(peerServer);

server.listen(port, () => {
    console.log('\n=== Upgrade Interception Test Server ===');
    console.log(`Server listening on: http://localhost:${port}`);
    console.log(`PeerServer path: /openchatroulette`);
    console.log('\nWaiting for connections...\n');

    // Test connection with headers (simulating proxy)
    setTimeout(() => {
        console.log('\n--- Testing client connection with X-Real-IP header ---');

        // Connect with custom headers (simulating nginx proxy)
        const clientOptions = {
            headers: {
                'X-Real-IP': '192.168.1.100',
                'X-Forwarded-For': '192.168.1.100, 10.0.0.1'
            }
        };

        const wsUrl = `ws://localhost:${port}/openchatroulette/peerjs?key=peerjs&id=test-client-1&token=test-token-123`;
        console.log('Connecting to:', wsUrl);

        const client = new WebSocket(wsUrl, clientOptions);

        client.on('open', () => {
            console.log('\nClient WebSocket connected!');
        });

        client.on('message', (data) => {
            console.log('Client received:', data.toString());
        });

        client.on('error', (err) => {
            console.error('Client error:', err.message);
        });

        client.on('close', () => {
            console.log('Client disconnected');
            console.log('\n=== Test Complete ===');
            process.exit(0);
        });

        // Close after 2 seconds
        setTimeout(() => {
            client.close();
        }, 2000);

    }, 1000);
});
