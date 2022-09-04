import {Injectable} from '@angular/core';

import {DataConnection, Peer} from 'peerjs';
import {v4 as uuidv4} from 'uuid';
import {Subject} from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class PeerjsService {

    private peer: Peer;
    peerConnection: DataConnection;
    messageStream$ = new Subject<string>();

    constructor() {

    }

    connect(): Promise<string> {
        return new Promise((resolve, reject) => {
            const peerId = uuidv4();
            this.peer = new Peer(peerId, {
                host: '/',
                path: '/openchatroulette',
                port: 9000
            });
            this.peer.on('open', (id) => {
                this.onConnected();
                resolve(id);
            });
            this.peer.on('error', (error) => {
                reject(error);
            });
        });
    }

    onConnected(): void {
        console.log('onConnected');
        this.peer.on('connection', (conn) => {
            this.peerConnection = conn;
            console.log('incoming peer connection!');
            conn.on('data', (data) => {
                console.log(`received: ${data}`);
                this.messageStream$.next(String(data));
            });
            conn.on('open', () => {
                conn.send('hello!');
            });
        });
        this.peer.on('call', (call) => {
            navigator.mediaDevices.getUserMedia({video: true, audio: true})
                .then((stream) => {
                    call.answer(stream);
                    // call.on('stream', renderVideo);
                })
                .catch((err) => {
                    console.error('Failed to get local stream', err);
                });
        });
    }

    connectToPeer(peerId: string): DataConnection {
        let conn = this.peer.connect(peerId);
        conn.on('data', (data) => {
            this.messageStream$.next(String(data));
        });
        conn.on('open', () => {
            conn.send('hi!');
        });
        navigator.mediaDevices.getUserMedia({video: true, audio: true})
            .then((stream) => {
                // let call = this.peer.call(peerId, stream);
                // call.on('stream', renderVideo);
            })
            .catch((err) => {
                console.log('Failed to get local stream', err);
            });
        return conn;
    }
}
