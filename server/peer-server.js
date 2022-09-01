
const {PeerServer} = require('peer');

const peerServer = PeerServer({
    port: 9000,
    path: '/openchatroulette',
    key: 'peerjs'
});

console.log('PeerServer initialized.');

peerServer.on('connection', (client) => {
    console.log('connection', client.id);
});

peerServer.on('disconnect', (client) => {
    console.log('disconnect', client.id);
});

peerServer.on('message', (client, message) => {
    console.log('disconnect', client.id, message);
});

peerServer.on('error', (error) => {
    console.log('error', error);
});
