const express = require('express');
const http = require('http');
const path = require('path');
const {ExpressPeerServer, PeerServer} = require('peer');

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 8000;

app.get('/', (req, res) => res.send('Welcome to OpenChatRoulette!'));

const peerServer = ExpressPeerServer(server, {
    proxied: true,
    debug: true,
    // allow_discovery: true,//Allow to use GET /:key/peers
    path: '/openchatroulette',
    secure: false,
    key: 'peerjs',
    ssl: {
        // key: fs.readFileSync('/path/to/your/ssl/key/here.key'),
        // cert: fs.readFileSync('/path/to/your/ssl/certificate/here.crt')
    }
});

app.use(peerServer);
server.listen(port);

console.log('PeerServer initialized.');
console.log(`Listening on: ${port}`);

const peers = {};
let peerWaiting = '';// TODO: create object with countries and purpose

peerServer.on('connection', (client) => {
    console.log('connection', client.getId());
    peers[client.getId()] = {
        country: '',
        purpose: ''
    };
    console.log(peers);
});

peerServer.on('disconnect', (client) => {
    console.log('disconnect', client.getId());
    if (peers[client.getId()]) {
        if (peerWaiting === client.getId()) {
            peerWaiting = '';
        }
        delete peers[client.getId()];
    }
    console.log(peers);
});

peerServer.on('message', (client, message) => {
    console.log('message', client.getId(), message);
    if (message.type === 'NEW_PEER_REQUEST') {
        client.send({
            peerId: getNextPeerId(client.getId())
        });
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
