#!/usr/bin/env node

/**
 * Test script to inspect all available socket properties for IP extraction
 */

'use strict';

const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const port = 9997;

const app = express();
const server = http.createServer(app);

// Create a raw WebSocket server to see what's available
const wss = new WebSocket.Server({
    server: server,
    path: '/test'
});

wss.on('connection', (socket, req) => {
    console.log('\n=== WebSocket Connection ===');

    console.log('\n--- HTTP Upgrade Request (req) ---');
    console.log('req.headers:', JSON.stringify(req.headers, null, 2));
    console.log('req.socket.remoteAddress:', req.socket.remoteAddress);
    console.log('req.connection.remoteAddress:', req.connection?.remoteAddress);

    // Check for proxy headers
    console.log('\n--- Proxy Headers ---');
    console.log('x-real-ip:', req.headers['x-real-ip']);
    console.log('x-forwarded-for:', req.headers['x-forwarded-for']);

    console.log('\n--- Socket Object (WebSocket) ---');
    console.log('socket._socket.remoteAddress:', socket._socket?.remoteAddress);

    // The upgrade request is NOT stored by default on the WebSocket
    console.log('\n--- Checking for request on socket ---');
    console.log('socket.upgradeReq:', socket.upgradeReq); // Old API (deprecated)
    console.log('socket._req:', socket._req); // Does not exist

    // Check all socket properties
    console.log('\n--- All socket properties ---');
    for (const key of Object.getOwnPropertyNames(socket)) {
        const type = typeof socket[key];
        console.log(`  ${key}: ${type}`);
    }

    socket.send(JSON.stringify({ type: 'connected' }));
    socket.close();
});

server.listen(port, () => {
    console.log(`Test server listening on port ${port}`);
    console.log(`WebSocket endpoint: ws://localhost:${port}/test`);

    // Connect as a test client after 500ms
    setTimeout(() => {
        console.log('\n--- Connecting test client ---');
        const client = new WebSocket(`ws://localhost:${port}/test`);

        client.on('message', (data) => {
            console.log('Client received:', data.toString());
        });

        client.on('close', () => {
            console.log('\nTest completed, shutting down...');
            process.exit(0);
        });

        client.on('error', (err) => {
            console.error('Client error:', err);
            process.exit(1);
        });
    }, 500);
});
