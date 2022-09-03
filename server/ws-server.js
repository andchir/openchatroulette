const {Server} = require('ws');
const {createServer} = require('http');

const app = require('express')();

const server = createServer(app);
const ws = new Server({server});

server.listen(6759);

console.log('WebSocket initialized.');

ws.on('connection', socket => {
    console.log('WebSocket connection.');

    socket.on('message', data => {
        const {type, from, message} = JSON.parse(data);
        console.log('Message received', type, from, message);

        if (type === 'message') {
            const event = JSON.stringify({
                type: '[Chat] Add message',
                from,
                message
            });

            // That's the same as `broadcast`
            // we want to send message to all connected
            // to the chat clients
            ws.clients.forEach(client => {
                client.send(event);
            });
        }
    });
});
