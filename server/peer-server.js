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
    logging('disconnect', client.getId());
    if (peers[client.getId()]) {
        const peerWaitingValue = getPeerWaitingValue(client.getId());
        if (peerWaitingValue === client.getId()) {
            setPeerWaitingValue(client.getId(), '');
        }
        delete peers[client.getId()];
    }
    logging(peers);
});

peerServer.on('message', (client, message) => {
    logging('message', client.getId(), message);
    switch (String(message.type)) {
        case 'NEW_REMOTE_PEER_REQUEST':
            if (message.payload && peers[client.getId()]) {
                const data = JSON.parse(message.payload);
                peers[client.getId()].countryCode = data.countryCode || '';
                peers[client.getId()].purpose = data.purpose || 'discussion';
            }
            const remotePeerId = getNextPeerId(client.getId());
            client.send({
                type: 'NEW_REMOTE_PEER',
                peerId: remotePeerId,
                countryCode: getPeerData(remotePeerId, 'countryCodeDetected')
            });
            break;
        case 'COUNTRY_SET':
            if (peers[client.getId()]) {
                peers[client.getId()].countryCode = message;
            }
            break;
        case 'PURPOSE_SET':
            if (peers[client.getId()]) {
                peers[client.getId()].purpose = message;
            }
            break;
    }
});

peerServer.on('error', (error) => {
    console.log('error', error);
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
    const myData = peers[myPeerId];
    const countryCode = myData.countryCode || 'all';
    const purpose = myData.purpose || 'all';
    if (!peerWaiting[countryCode]) {
        peerWaiting[countryCode] = {};
    }
    if (!peerWaiting[countryCode][purpose]) {
        peerWaiting[countryCode][purpose] = '';
    }
    return peerWaiting[countryCode][purpose];
};

const setPeerWaitingValue = (myPeerId, value) => {
    const myData = peers[myPeerId];
    const countryCode = myData.countryCode || 'all';
    const purpose = myData.purpose || 'all';
    if (!peerWaiting[countryCode]) {
        peerWaiting[countryCode] = {};
    }
    if (!peerWaiting[countryCode][purpose]) {
        peerWaiting[countryCode][purpose] = '';
    }
    peerWaiting[countryCode][purpose] = typeof value !== 'undefined' ? value : myPeerId;
};

const getPeerData = (peerId, key) => {
    if (!peerId) {
        return '';
    }
    const peerData = peers[peerId];
    return peerData ? (peerData[key] || '') : '';
}

app.get('/', (req, res) => {
    res.sendFile('/en/index.html', {
        root: app.get('views')
    });
});

app.get('/:lang', (req, res) => {
    // console.log(req.params);
    res.redirect(301, '/en/');
});
