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
const app = express();
const server = process.env.SECURE === 'true'
    ? https.createServer({
        key: fs.readFileSync(process.env.SSL_KEY),
        cert: fs.readFileSync(process.env.SSL_CERT)
    }, app)
    : http.createServer(app);

const auth = {
    login: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD
};

const peerServer = ExpressPeerServer(server, {
    proxied: true,
    debug: true,
    // allow_discovery: true,//Allow to use GET /:key/peers
    path: '/openchatroulette',
    secure: process.env.SECURE === 'true',
    key: 'peerjs',
    ssl: process.env.SECURE === 'true' ? {
        key: fs.readFileSync(process.env.SSL_KEY),
        cert: fs.readFileSync(process.env.SSL_CERT)
    } : {}
});

app.set('views', path.join(path.dirname(__dirname), 'openchatroulette/dist/openchatroulette'))
app.use(express.static(path.join(path.dirname(__dirname), 'openchatroulette/dist/openchatroulette/en')));
app.use('/ru', express.static(path.join(path.dirname(__dirname), 'openchatroulette/dist/openchatroulette/ru')));
app.use('/ua', express.static(path.join(path.dirname(__dirname), 'openchatroulette/dist/openchatroulette/ua')));
app.use('/fr', express.static(path.join(path.dirname(__dirname), 'openchatroulette/dist/openchatroulette/fr')));
app.use(peerServer);
server.listen(port);

console.log('PeerServer initialized.');
console.log(`Listening on: ${port}`);

const peers = {};
const peerWaiting = {};

peerServer.on('connection', (client) => {
    const clientIpAddress = client.getSocket()._socket.remoteAddress.replace('::ffff:', '');
    logging('connection', client.getId(), clientIpAddress);
    Reader.open('geoip/GeoLite2-Country.mmdb').then(reader => {
        let countryCode, countryName;
        try {
            const response = reader.country(clientIpAddress);
            countryCode = response.country.isoCode;
            countryName = response.country.names.en;
        } catch (e) {
            // logging('ERROR', e);
            countryCode = '';
            countryName = 'Unknown';
        }
        peers[client.getId()] = {
            countryCode,
            countryCodeDetected: countryCode,
            countryNameDetected: countryName,
            purpose: 'discussion'
        };
        client.send({
            type: 'COUNTRY_DETECTED',
            countryCode,
            countryName
        });
        logging(peers);
    });
});

peerServer.on('disconnect', (client) => {
    logging('DISCONNECT', client.getId());
    if (peers[client.getId()]) {
        clearWaitingData(client.getId());
        delete peers[client.getId()];
    }
    logging('ALL PEERS', peers, peerWaiting);
});

peerServer.on('message', (client, message) => {
    switch (String(message.type)) {
        case 'NEW_REMOTE_PEER_REQUEST':
            logging('MESSAGE', message.type, client.getId(), message);
            clearWaitingData(client.getId());
            if (message.payload && peers[client.getId()]) {
                const data = JSON.parse(message.payload);
                setPeerData(client.getId(), 'countryCode', data.countryCode || '');
                setPeerData(client.getId(), 'purpose', data.purpose || 'discussion');
            }
            const remotePeerId = getNextPeerId(client.getId());
            client.send({
                type: 'NEW_REMOTE_PEER',
                peerId: remotePeerId,
                countryCode: getPeerData(remotePeerId, 'countryCodeDetected')
            });
            logging('ALL PEERS', peers, peerWaiting);
            break;
        case 'COUNTRY_SET':
            logging('MESSAGE', message.type, client.getId(), message);
            clearWaitingData(client.getId());
            if (peers[client.getId()]) {
                setPeerData(client.getId(), 'countryCode', message.payload);
            }
            logging('ALL PEERS', peers, peerWaiting);
            break;
        case 'PURPOSE_SET':
            logging('MESSAGE', message.type, client.getId(), message);
            clearWaitingData(client.getId());
            if (peers[client.getId()]) {
                setPeerData(client.getId(), 'purpose', message.payload);
            }
            logging('ALL PEERS', peers, peerWaiting);
            break;
        case 'ANSWER':
            client.send({
                type: 'REMOTE_COUNTRY_SET',
                peerId: message.dst,
                countryCode: getPeerData(message.dst, 'countryCodeDetected')
            });
            break;
    }
});

peerServer.on('error', (error) => {
    console.log('error', error);
});

app.get('/', (req, res) => {
    res.sendFile('/en/index.html', {
        root: app.get('views')
    });
});

app.get('/chatadmin', (req, res) => {
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

    if (login && password && login === auth.login && password === auth.password) {
        res.set('Content-Type', 'text/plain; charset=UTF-8');
        const output = `All peers (${Object.keys(peers).length}): \n\n`
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

app.get('/:lang', (req, res) => {
    // console.log(req.params);
    if (req.params.lang && req.params.lang === 'en') {
        res.redirect(301, '/');
        return;
    }
    res.redirect(301, '/en/');
});

const logging = (...args) => {
    if (environment === 'dev') {
        console.log(...args);
    }
};

const getNextPeerId = (myPeerId) => {
    let output = '';
    const peerWaitingValue = getPeerWaitingValue(myPeerId);
    if (peerWaitingValue && peerWaitingValue !== myPeerId) {
        output = peerWaitingValue;
        setPeerWaitingValue(myPeerId, '');
    } else {
        if (myPeerId && !peerWaitingValue) {
            setPeerWaitingValue(myPeerId);
        }
        output = '';
    }
    return output;
};

const getPeerWaitingValue = (myPeerId) => {
    const countryCode = getPeerData(myPeerId, 'countryCode', 'all');
    const purpose = getPeerData(myPeerId, 'purpose', 'discussion');
    if (!peerWaiting[countryCode]) {
        peerWaiting[countryCode] = {};
    }
    if (!peerWaiting[countryCode][purpose]) {
        peerWaiting[countryCode][purpose] = '';
    }
    return peerWaiting[countryCode][purpose];
};

const setPeerWaitingValue = (myPeerId, value) => {
    const countryCode = getPeerData(myPeerId, 'countryCode', 'all');
    const purpose = getPeerData(myPeerId, 'purpose', 'discussion');
    if (!peerWaiting[countryCode]) {
        peerWaiting[countryCode] = {};
    }
    if (!peerWaiting[countryCode][purpose]) {
        peerWaiting[countryCode][purpose] = '';
    }
    peerWaiting[countryCode][purpose] = typeof value !== 'undefined' ? value : myPeerId;
};

const clearWaitingData = (peerId) => {
    const currentCountryCode = getPeerData(peerId, 'countryCode', 'all');
    const currentPurpose = getPeerData(peerId, 'purpose', 'all');
    if (peerWaiting[currentCountryCode] && peerWaiting[currentCountryCode][currentPurpose] === peerId) {
        peerWaiting[currentCountryCode][currentPurpose] = '';
    }
};

const getPeerData = (peerId, key, defaultValue) => {
    if (!peerId) {
        return '';
    }
    if (!defaultValue) {
        defaultValue = '';
    }
    const peerData = peers[peerId];
    return peerData ? (peerData[key] || defaultValue) : defaultValue;
};

const setPeerData = (peerId, key, value) => {
    if (peers[peerId]) {
        peers[peerId][key] = value;
    }
};
