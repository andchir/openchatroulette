import {Injectable} from '@angular/core';

import {Peer} from 'peerjs';
import {v4 as uuidv4} from 'uuid';

@Injectable({
    providedIn: 'root'
})
export class PeerjsService {

    private peer: Peer;

    constructor() {

    }

    peerInit(): string {
        const peerId = uuidv4();
        this.peer = new Peer(peerId, {
            host: '/',
            path: '/openchatroulette',
            port: 9000
        });
        this.peer.on('open', (id) => {
            console.log('My peer ID: ' + id);
        });
        this.peer.on('error', (error) => {
            console.error(error);
        });
        return peerId;
    }
}
