const WebSocketServer = require('ws').Server;
const wss = new WebSocketServer({
    port: 6759
});

const peers = [

];

console.log('WebSocket initialized.');

wss.on('connection', (ws) => {
    console.log('WebSocket connection.');

    ws.on('message', (event) => {
        const data = JSON.parse(event);
        const res = JSON.parse(data);

        switch (res.event) {
            case 'peer-add':
                peers.unshift(res.data);
                break;
            case 'peer-remove':
                peers.splice(res.data, 1);
                break;
        }

        console.log(peers);

        // ws.send(JSON.stringify({
        //     event: 'update-texts',
        //     data: texts
        // }));
        //
        // console.log('message', data);
    });

    // ws.send(JSON.stringify({
    //     event: 'messages',
    //     data: messages
    // }));
    //
    // ws.send(JSON.stringify({
    //     event: 'update-texts',
    //     data: texts
    // }));

    ws.on('close', () => {
        console.log('disconnected');
    });
});
