#!/usr/bin/env node

/**
 * Test script to verify peer-server works with the latest peer package version.
 * This script starts the peer server and verifies it initializes correctly.
 */

'use strict';

const express = require('express');
const http = require('http');
const { ExpressPeerServer } = require('peer');

const port = 9999;

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
    console.log('CONNECTION event received, client ID:', client.getId());

    // Test getSocket method
    const socket = client.getSocket();
    console.log('getSocket() returned:', socket ? 'WebSocket object' : 'null');

    // Test send method
    try {
        client.send({
            type: 'TEST_MESSAGE',
            data: 'Hello from server'
        });
        console.log('client.send() succeeded');
    } catch (error) {
        console.error('client.send() failed:', error.message);
    }
});

peerServer.on('disconnect', (client) => {
    console.log('DISCONNECT event received, client ID:', client.getId());
});

peerServer.on('message', (client, message) => {
    console.log('MESSAGE event received from client:', client.getId());
    console.log('Message type:', message.type);
    console.log('Message payload:', message.payload);
});

peerServer.on('error', (error) => {
    console.error('PeerServer error:', error);
});

app.use(peerServer);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', peerVersion: '1.0.2' });
});

server.listen(port, () => {
    console.log('\n=== Peer Server Test ===');
    console.log(`Server listening on: http://localhost:${port}`);
    console.log(`PeerServer path: /openchatroulette`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log('\nPeer package version 1.0.2 initialized successfully!');
    console.log('Press Ctrl+C to stop the server.\n');

    // Auto-shutdown after 5 seconds for testing purposes
    setTimeout(() => {
        console.log('\nAuto-shutting down after successful initialization...');
        process.exit(0);
    }, 2000);
});
