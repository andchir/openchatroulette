#!/usr/bin/env node

/**
 * Test script to verify how to access client IP address and headers
 * from PeerJS WebSocket connections when behind nginx proxy.
 */

'use strict';

const express = require('express');
const http = require('http');
const { ExpressPeerServer } = require('peer');

const port = 9998;

const app = express();
const server = http.createServer(app);

const peerServerOptions = {
    proxied: true,
    debug: true,
    path: '/openchatroulette',
    key: 'peerjs'
};

console.log('Creating ExpressPeerServer with options:', JSON.stringify(peerServerOptions, null, 2));

const peerServer = ExpressPeerServer(server, peerServerOptions);

// Test events
peerServer.on('connection', (client) => {
    console.log('\n=== CONNECTION EVENT ===');
    console.log('Client ID:', client.getId());

    const socket = client.getSocket();
    console.log('\n--- Socket Analysis ---');

    if (socket) {
        console.log('Socket exists: true');
        console.log('Socket constructor name:', socket.constructor ? socket.constructor.name : 'unknown');

        // Check _socket (underlying TCP socket)
        if (socket._socket) {
            console.log('\n_socket exists: true');
            console.log('_socket.remoteAddress:', socket._socket.remoteAddress);
            console.log('_socket.remotePort:', socket._socket.remotePort);
        }

        // Check for upgrade request (this is where headers would be)
        if (socket._req) {
            console.log('\n_req (HTTP upgrade request) exists: true');
            console.log('_req.headers:', JSON.stringify(socket._req.headers, null, 2));
        } else {
            console.log('\n_req does not exist on socket');
        }

        // Check for upgradeReq (older API)
        if (socket.upgradeReq) {
            console.log('\nupgradeReq exists: true');
            console.log('upgradeReq.headers:', JSON.stringify(socket.upgradeReq.headers, null, 2));
        } else {
            console.log('\nupgradeReq does not exist on socket');
        }

        // List all enumerable properties of socket
        console.log('\nSocket properties:', Object.keys(socket));

        // Check non-enumerable/prototype properties
        console.log('\nChecking socket._isServer:', socket._isServer);
        console.log('Checking socket.readyState:', socket.readyState);
    } else {
        console.log('Socket is null');
    }
});

peerServer.on('error', (error) => {
    console.error('PeerServer error:', error);
});

app.use(peerServer);

// Health check endpoint
app.get('/health', (req, res) => {
    console.log('\n--- HTTP Request Headers ---');
    console.log('x-real-ip:', req.headers['x-real-ip']);
    console.log('x-forwarded-for:', req.headers['x-forwarded-for']);
    console.log('All headers:', JSON.stringify(req.headers, null, 2));
    res.json({ status: 'ok' });
});

server.listen(port, () => {
    console.log('\n=== IP Detection Test Server ===');
    console.log(`Server listening on: http://localhost:${port}`);
    console.log(`PeerServer path: /openchatroulette`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log('\nPress Ctrl+C to stop the server.\n');

    // Auto-shutdown after 30 seconds for testing purposes
    setTimeout(() => {
        console.log('\nAuto-shutting down after 30 seconds...');
        process.exit(0);
    }, 30000);
});
