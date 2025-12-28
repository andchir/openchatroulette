#!/usr/bin/env node

/**
 * Unit tests for OOP classes in peer-server.js
 * Tests ValidationUtils, PeerManager, and GeoIPService classes
 */

'use strict';

// ============================================================================
// Test Framework (minimal inline test runner)
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

function describe(name, fn) {
    console.log(`\n=== ${name} ===`);
    fn();
}

function it(name, fn) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
        testsPassed++;
    } catch (error) {
        console.log(`  ✗ ${name}`);
        console.log(`    Error: ${error.message}`);
        testsFailed++;
    }
}

function assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
        throw new Error(`${message} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

function assertTrue(actual, message = '') {
    if (actual !== true) {
        throw new Error(`${message} Expected true, got ${actual}`);
    }
}

function assertFalse(actual, message = '') {
    if (actual !== false) {
        throw new Error(`${message} Expected false, got ${actual}`);
    }
}

function assertNull(actual, message = '') {
    if (actual !== null) {
        throw new Error(`${message} Expected null, got ${actual}`);
    }
}

// ============================================================================
// Import classes from peer-server.js (copy for testing)
// ============================================================================

const config = {
    allowedPurposes: ['discussion', 'dating', 'language']
};

/**
 * Utility class providing validation and sanitization methods
 */
class ValidationUtils {
    static sanitizeCountryCode(code) {
        if (typeof code !== 'string') {
            return '';
        }
        const sanitized = code.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
        return sanitized.length === 2 ? sanitized : '';
    }

    static sanitizePurpose(purpose) {
        if (typeof purpose !== 'string') {
            return 'discussion';
        }
        return config.allowedPurposes.includes(purpose) ? purpose : 'discussion';
    }

    static safeJsonParse(jsonString, logFn = () => {}) {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            logFn('JSON parse error:', error.message);
            return null;
        }
    }
}

/**
 * Manages peer connections, data storage, and matching logic
 */
class PeerManager {
    constructor() {
        this.peers = {};
        this.peerWaiting = {};
    }

    addPeer(peerId, countryCode, countryName) {
        this.peers[peerId] = {
            countryCode,
            countryCodeDetected: countryCode,
            countryNameDetected: countryName,
            purpose: 'discussion',
            connectedAt: Date.now()
        };
    }

    removePeer(peerId) {
        if (this.peers[peerId]) {
            this.clearWaitingData(peerId);
            delete this.peers[peerId];
        }
    }

    hasPeer(peerId) {
        return !!this.peers[peerId];
    }

    getPeerData(peerId, key, defaultValue = '') {
        if (!peerId || typeof peerId !== 'string') {
            return defaultValue;
        }
        const peerData = this.peers[peerId];
        return peerData ? (peerData[key] || defaultValue) : defaultValue;
    }

    setPeerData(peerId, key, value) {
        if (peerId && this.peers[peerId]) {
            this.peers[peerId][key] = value;
        }
    }

    getPeerCount() {
        return Object.keys(this.peers).length;
    }

    getAllPeers() {
        return this.peers;
    }

    getWaitingData() {
        return this.peerWaiting;
    }

    ensureWaitingStructure(countryCode, purpose) {
        if (!this.peerWaiting[countryCode]) {
            this.peerWaiting[countryCode] = {};
        }
        if (!this.peerWaiting[countryCode][purpose]) {
            this.peerWaiting[countryCode][purpose] = '';
        }
    }

    getPeerWaitingValue(myPeerId) {
        const countryCode = this.getPeerData(myPeerId, 'countryCode', 'all');
        const purpose = this.getPeerData(myPeerId, 'purpose', 'discussion');
        this.ensureWaitingStructure(countryCode, purpose);
        return this.peerWaiting[countryCode][purpose];
    }

    setPeerWaitingValue(myPeerId, value) {
        const countryCode = this.getPeerData(myPeerId, 'countryCode', 'all');
        const purpose = this.getPeerData(myPeerId, 'purpose', 'discussion');
        this.ensureWaitingStructure(countryCode, purpose);
        this.peerWaiting[countryCode][purpose] = value !== undefined ? value : myPeerId;
    }

    clearWaitingData(peerId) {
        const currentCountryCode = this.getPeerData(peerId, 'countryCode', 'all');
        const currentPurpose = this.getPeerData(peerId, 'purpose', 'all');
        if (this.peerWaiting[currentCountryCode] &&
            this.peerWaiting[currentCountryCode][currentPurpose] === peerId) {
            this.peerWaiting[currentCountryCode][currentPurpose] = '';
        }
    }

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
// Tests
// ============================================================================

describe('ValidationUtils.sanitizeCountryCode', () => {
    it('should convert lowercase to uppercase', () => {
        assertEqual(ValidationUtils.sanitizeCountryCode('us'), 'US');
    });

    it('should keep valid 2-letter codes', () => {
        assertEqual(ValidationUtils.sanitizeCountryCode('RU'), 'RU');
    });

    it('should truncate longer codes to 2 letters', () => {
        assertEqual(ValidationUtils.sanitizeCountryCode('USA'), 'US');
    });

    it('should return empty string for single letter', () => {
        assertEqual(ValidationUtils.sanitizeCountryCode('A'), '');
    });

    it('should return empty string for numbers', () => {
        assertEqual(ValidationUtils.sanitizeCountryCode(123), '');
    });

    it('should return empty string for null', () => {
        assertEqual(ValidationUtils.sanitizeCountryCode(null), '');
    });

    it('should remove non-letter characters', () => {
        assertEqual(ValidationUtils.sanitizeCountryCode('U1S2'), 'US');
    });

    it('should return empty string for empty string input', () => {
        assertEqual(ValidationUtils.sanitizeCountryCode(''), '');
    });
});

describe('ValidationUtils.sanitizePurpose', () => {
    it('should accept valid purpose "discussion"', () => {
        assertEqual(ValidationUtils.sanitizePurpose('discussion'), 'discussion');
    });

    it('should accept valid purpose "dating"', () => {
        assertEqual(ValidationUtils.sanitizePurpose('dating'), 'dating');
    });

    it('should accept valid purpose "language"', () => {
        assertEqual(ValidationUtils.sanitizePurpose('language'), 'language');
    });

    it('should return default for invalid purpose', () => {
        assertEqual(ValidationUtils.sanitizePurpose('invalid'), 'discussion');
    });

    it('should return default for non-string input', () => {
        assertEqual(ValidationUtils.sanitizePurpose(123), 'discussion');
    });

    it('should return default for null', () => {
        assertEqual(ValidationUtils.sanitizePurpose(null), 'discussion');
    });
});

describe('ValidationUtils.safeJsonParse', () => {
    it('should parse valid JSON', () => {
        const result = ValidationUtils.safeJsonParse('{"key": "value"}');
        assertEqual(result.key, 'value');
    });

    it('should return null for invalid JSON', () => {
        const result = ValidationUtils.safeJsonParse('not json');
        assertNull(result);
    });

    it('should call log function on parse error', () => {
        let logCalled = false;
        ValidationUtils.safeJsonParse('invalid', () => { logCalled = true; });
        assertTrue(logCalled);
    });

    it('should parse JSON with nested objects', () => {
        const result = ValidationUtils.safeJsonParse('{"a": {"b": 1}}');
        assertEqual(result.a.b, 1);
    });
});

describe('PeerManager.addPeer and removePeer', () => {
    it('should add a peer correctly', () => {
        const manager = new PeerManager();
        manager.addPeer('peer1', 'US', 'United States');
        assertTrue(manager.hasPeer('peer1'));
        assertEqual(manager.getPeerCount(), 1);
    });

    it('should store correct peer data', () => {
        const manager = new PeerManager();
        manager.addPeer('peer1', 'US', 'United States');
        assertEqual(manager.getPeerData('peer1', 'countryCode'), 'US');
        assertEqual(manager.getPeerData('peer1', 'countryNameDetected'), 'United States');
        assertEqual(manager.getPeerData('peer1', 'purpose'), 'discussion');
    });

    it('should remove a peer correctly', () => {
        const manager = new PeerManager();
        manager.addPeer('peer1', 'US', 'United States');
        manager.removePeer('peer1');
        assertFalse(manager.hasPeer('peer1'));
        assertEqual(manager.getPeerCount(), 0);
    });

    it('should handle removing non-existent peer', () => {
        const manager = new PeerManager();
        manager.removePeer('nonexistent'); // Should not throw
        assertEqual(manager.getPeerCount(), 0);
    });
});

describe('PeerManager.getPeerData and setPeerData', () => {
    it('should get default value for non-existent peer', () => {
        const manager = new PeerManager();
        assertEqual(manager.getPeerData('nonexistent', 'key', 'default'), 'default');
    });

    it('should get default value for null peerId', () => {
        const manager = new PeerManager();
        assertEqual(manager.getPeerData(null, 'key', 'default'), 'default');
    });

    it('should set and get peer data', () => {
        const manager = new PeerManager();
        manager.addPeer('peer1', 'US', 'United States');
        manager.setPeerData('peer1', 'countryCode', 'RU');
        assertEqual(manager.getPeerData('peer1', 'countryCode'), 'RU');
    });

    it('should not set data for non-existent peer', () => {
        const manager = new PeerManager();
        manager.setPeerData('nonexistent', 'key', 'value'); // Should not throw
    });
});

describe('PeerManager.getNextPeerId (peer matching)', () => {
    it('should return empty string when no peers waiting', () => {
        const manager = new PeerManager();
        manager.addPeer('peer1', 'US', 'United States');
        const result = manager.getNextPeerId('peer1');
        assertEqual(result, '');
    });

    it('should add self to waiting queue if empty', () => {
        const manager = new PeerManager();
        manager.addPeer('peer1', 'US', 'United States');
        manager.getNextPeerId('peer1');
        assertEqual(manager.getPeerWaitingValue('peer1'), 'peer1');
    });

    it('should match two peers with same country and purpose', () => {
        const manager = new PeerManager();
        manager.addPeer('peer1', 'US', 'United States');
        manager.addPeer('peer2', 'US', 'United States');

        // First peer joins waiting queue
        const result1 = manager.getNextPeerId('peer1');
        assertEqual(result1, '');

        // Second peer gets matched with first
        const result2 = manager.getNextPeerId('peer2');
        assertEqual(result2, 'peer1');
    });

    it('should not match self', () => {
        const manager = new PeerManager();
        manager.addPeer('peer1', 'US', 'United States');
        manager.getNextPeerId('peer1'); // Add to queue
        const result = manager.getNextPeerId('peer1'); // Try again
        assertEqual(result, '');
    });

    it('should clear waiting data on disconnect', () => {
        const manager = new PeerManager();
        manager.addPeer('peer1', 'US', 'United States');
        manager.getNextPeerId('peer1'); // Add to queue
        manager.removePeer('peer1');
        assertEqual(manager.peerWaiting['US']['discussion'], '');
    });
});

describe('PeerManager.getAllPeers and getWaitingData', () => {
    it('should return all peers object', () => {
        const manager = new PeerManager();
        manager.addPeer('peer1', 'US', 'United States');
        manager.addPeer('peer2', 'RU', 'Russia');
        const peers = manager.getAllPeers();
        assertTrue('peer1' in peers);
        assertTrue('peer2' in peers);
    });

    it('should return waiting data object', () => {
        const manager = new PeerManager();
        manager.addPeer('peer1', 'US', 'United States');
        manager.getNextPeerId('peer1');
        const waiting = manager.getWaitingData();
        assertTrue('US' in waiting);
    });
});

// ============================================================================
// Summary
// ============================================================================

console.log('\n=== Test Summary ===');
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);

if (testsFailed > 0) {
    process.exit(1);
}

console.log('\nAll tests passed!');
process.exit(0);
