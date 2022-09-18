'use strict';

const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const ip = require('ip');
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

app.use(express.static(path.join(path.dirname(__dirname), 'openchatroulette/dist/openchatroulette')));
app.use(peerServer);
server.listen(port);

console.log('PeerServer initialized.');
console.log(`Listening on: ${port}`);

const peers = {};
let peerWaiting = '';// TODO: create object with countries and purpose

peerServer.on('connection', (client) => {
    logging('connection', client.getId(), ip.address());
    Reader.open('geoip/GeoLite2-Country.mmdb').then(reader => {
        let countryCode, countryName;
        try {
            const response = reader.country(ip.address());
            countryCode = response.country.isoCode;
            countryName = response.country.names.en;
        } catch (e) {
            // logging('ERROR', e);
            countryCode = '';
            countryName = 'Unknown';
        }
        peers[client.getId()] = {
            countryCode,
            countryName,
            purpose: ''
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
        if (peerWaiting === client.getId()) {
            peerWaiting = '';
        }
        delete peers[client.getId()];
    }
    logging(peers);
});

peerServer.on('message', (client, message) => {
    logging('message', client.getId(), message);
    switch (message.type) {
        case 'NEW_REMOTE_PEER_REQUEST':
            if (message.payload && peers[client.getId()]) {
                const data = JSON.parse(message.payload);
                peers[client.getId()].countryCode = data.countryCode || '';
                peers[client.getId()].purpose = data.purpose || 'discussion';
            }
            client.send({
                type: 'NEW_REMOTE_PEER',
                peerId: getNextPeerId(client.getId())
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

app.get('/openchatroulette/random_peer/:id', (req, res) => {
    return res.json({
        peerId: getNextPeerId(req.params.id)
    });
});

const logging = (...args) => {
    if (environment === 'dev') {
        console.log(...args);
    }
};

const getNextPeerId = (myPeerId) => {
    let output = '';
    if (peerWaiting && peerWaiting !== myPeerId) {
        output = peerWaiting;
        peerWaiting = '';
    } else {
        if (myPeerId && !peerWaiting) {
            peerWaiting = myPeerId;
        }
        output = '';
    }
    return output;
};

app.get('/', (req, res) => {
    Reader.open('geoip/GeoLite2-Country.mmdb').then(reader => {
        let countryCode;
        try {
            const response = reader.country(ip.address());
            countryCode = response.country.isoCode;
        } catch (e) {
            // console.log('ERROR', e);
            countryCode = 'en';
        }
        res.redirect(301, `/${countryCode.toLowerCase()}/`);
    });
});

app.get('/:lang', (req, res) => {
    // console.log(req.params);
    res.redirect(301, '/en/');
});
