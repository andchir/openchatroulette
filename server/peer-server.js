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
        delete peers[client.getId()];
    }
    console.log(peers);
});

peerServer.on('message', (client, message) => {
    console.log('message', client.getId(), message);
});

peerServer.on('error', (error) => {
    console.log('error', error);
});

app.get('/openchatroulette/random_peer/:id', (req, res) => {

    if (peerWaiting && peerWaiting !== req.params.id) {
        const output = {peerId: peerWaiting};
        peerWaiting = '';
        return res.json(output);
    } else {
        const myPeerId = peers[req.params.id] ? req.params.id : '';
        if (myPeerId && !peerWaiting) {
            peerWaiting = myPeerId;
        }
        return res.json({peerId: ''});
    }

    // const myPeerId = req.params.id;
    // const clientsIds = Object.keys(peers);
    // const myIndex = clientsIds.findIndex((id) => {
    //     return id === myPeerId;
    // });
    // if (myIndex > -1) {
    //     clientsIds.splice(myIndex, 1);
    // }
    // const randomPeerId = clientsIds.length > 0
    //     ? clientsIds[Math.floor(Math.random() * clientsIds.length)]
    //     : '';
    //
    // console.log('/random_peer/:id', myPeerId, myIndex, clientsIds.length, randomPeerId);

    // if (!randomPeerId) {
    //     return res.status(422).send('No peer found.');
    // }
    // return res.json({
    //     peerId: nextPeerId
    // });
});
