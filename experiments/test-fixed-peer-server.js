#!/usr/bin/env node

/**
 * Test script to verify the IP detection fix in peer-server.js
 * Simulates a proxy scenario by sending X-Real-IP and X-Forwarded-For headers
 */

'use strict';

const express = require('express');
const http = require('http');
const { ExpressPeerServer } = require('peer');
const WebSocket = require('ws');

const port = 9995;

// Mock config similar to peer-server.js
const config = {
    environment: 'dev', // Enable logging
};

// ============================================================================
// Recreate relevant parts from peer-server.js with the fix
// ============================================================================

class TestServer {
    constructor() {
        this.app = express();
        this.server = null;
        this.peerServer = null;
        this.clientIpMap = new Map();
        this.detectedIps = []; // Store detected IPs for verification
    }

    log(...args) {
        console.log(new Date().toISOString(), ...args);
    }

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

    start() {
        return new Promise((resolve) => {
            this.server = http.createServer(this.app);

            // Set up upgrade listener BEFORE PeerServer
            this.setupUpgradeListener();

            this.peerServer = ExpressPeerServer(this.server, {
                proxied: true,
                debug: true,
                path: '/openchatroulette',
                key: 'peerjs'
            });

            this.peerServer.on('connection', (client) => {
                const clientId = client.getId();
                const clientIpAddress = this.getClientIpAddress(client);
                this.log('CONNECTION', clientId, 'IP:', clientIpAddress);
                this.detectedIps.push({ clientId, ip: clientIpAddress });
            });

            this.app.use(this.peerServer);

            this.server.listen(port, () => {
                this.log('Test server listening on port', port);
                resolve();
            });
        });
    }

    stop() {
        return new Promise((resolve) => {
            this.server.close(resolve);
        });
    }
}

// ============================================================================
// Test execution
// ============================================================================

async function runTests() {
    const server = new TestServer();
    await server.start();

    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };

    // Test 1: X-Real-IP header
    console.log('\n=== Test 1: X-Real-IP header ===');
    await new Promise((resolve) => {
        const wsUrl = `ws://localhost:${port}/openchatroulette/peerjs?key=peerjs&id=test-xrealip&token=token1`;
        const client = new WebSocket(wsUrl, {
            headers: {
                'X-Real-IP': '203.0.113.42'
            }
        });
        client.on('open', () => {
            setTimeout(() => {
                client.close();
                resolve();
            }, 500);
        });
        client.on('error', (err) => {
            console.error('Test 1 error:', err.message);
            resolve();
        });
    });

    // Test 2: X-Forwarded-For header (single IP)
    console.log('\n=== Test 2: X-Forwarded-For header (single IP) ===');
    await new Promise((resolve) => {
        const wsUrl = `ws://localhost:${port}/openchatroulette/peerjs?key=peerjs&id=test-xff-single&token=token2`;
        const client = new WebSocket(wsUrl, {
            headers: {
                'X-Forwarded-For': '198.51.100.73'
            }
        });
        client.on('open', () => {
            setTimeout(() => {
                client.close();
                resolve();
            }, 500);
        });
        client.on('error', (err) => {
            console.error('Test 2 error:', err.message);
            resolve();
        });
    });

    // Test 3: X-Forwarded-For header (multiple IPs - proxy chain)
    console.log('\n=== Test 3: X-Forwarded-For header (multiple IPs) ===');
    await new Promise((resolve) => {
        const wsUrl = `ws://localhost:${port}/openchatroulette/peerjs?key=peerjs&id=test-xff-chain&token=token3`;
        const client = new WebSocket(wsUrl, {
            headers: {
                'X-Forwarded-For': '192.0.2.101, 10.0.0.1, 172.16.0.1'
            }
        });
        client.on('open', () => {
            setTimeout(() => {
                client.close();
                resolve();
            }, 500);
        });
        client.on('error', (err) => {
            console.error('Test 3 error:', err.message);
            resolve();
        });
    });

    // Test 4: X-Real-IP takes precedence over X-Forwarded-For
    console.log('\n=== Test 4: X-Real-IP precedence ===');
    await new Promise((resolve) => {
        const wsUrl = `ws://localhost:${port}/openchatroulette/peerjs?key=peerjs&id=test-precedence&token=token4`;
        const client = new WebSocket(wsUrl, {
            headers: {
                'X-Real-IP': '1.2.3.4',
                'X-Forwarded-For': '5.6.7.8, 9.10.11.12'
            }
        });
        client.on('open', () => {
            setTimeout(() => {
                client.close();
                resolve();
            }, 500);
        });
        client.on('error', (err) => {
            console.error('Test 4 error:', err.message);
            resolve();
        });
    });

    // Test 5: No proxy headers (direct connection)
    console.log('\n=== Test 5: No proxy headers (direct connection) ===');
    await new Promise((resolve) => {
        const wsUrl = `ws://localhost:${port}/openchatroulette/peerjs?key=peerjs&id=test-direct&token=token5`;
        const client = new WebSocket(wsUrl);
        client.on('open', () => {
            setTimeout(() => {
                client.close();
                resolve();
            }, 500);
        });
        client.on('error', (err) => {
            console.error('Test 5 error:', err.message);
            resolve();
        });
    });

    // Wait for all connections to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify results
    console.log('\n=== Test Results ===\n');

    const expected = {
        'test-xrealip': '203.0.113.42',
        'test-xff-single': '198.51.100.73',
        'test-xff-chain': '192.0.2.101', // First IP in chain
        'test-precedence': '1.2.3.4', // X-Real-IP takes precedence
        'test-direct': '::1' // localhost (or 127.0.0.1)
    };

    for (const { clientId, ip } of server.detectedIps) {
        const expectedIp = expected[clientId];
        let passed = false;

        if (clientId === 'test-direct') {
            // For direct connection, accept localhost variants
            passed = ip === '::1' || ip === '127.0.0.1' || ip === 'localhost';
        } else {
            passed = ip === expectedIp;
        }

        if (passed) {
            results.passed++;
            console.log(`✓ ${clientId}: detected IP = ${ip} (expected: ${expectedIp})`);
        } else {
            results.failed++;
            console.log(`✗ ${clientId}: detected IP = ${ip} (expected: ${expectedIp})`);
        }
        results.tests.push({ clientId, ip, expectedIp, passed });
    }

    console.log(`\n=== Summary: ${results.passed}/${results.passed + results.failed} tests passed ===\n`);

    await server.stop();

    process.exit(results.failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
});
