import {Injectable} from '@angular/core';

import {BehaviorSubject, catchError, Observable, Subject, throwError} from 'rxjs';
import {DataConnection, MediaConnection, Peer} from 'peerjs';
import {v4 as uuidv4} from 'uuid';

import {environment} from '../../environments/environment';

export enum ServerMessageType {
    NewRemotePear = 'NEW_REMOTE_PEER',
    CountryDetected = 'COUNTRY_DETECTED',
    CountrySet = 'COUNTRY_SET',
    RemoteCountrySet = 'REMOTE_COUNTRY_SET',
    PurposeSet = 'PURPOSE_SET'
}

@Injectable({
    providedIn: 'root'
})
export class PeerjsService {

    private peer: Peer;
    private delayReconnect = false;
    private timer: any;
    dataConnection: DataConnection|null;
    mediaConnection: MediaConnection|null;
    connected$: Subject<boolean>;
    messageStream$ = new Subject<string>();
    remotePeerConnected$ = new BehaviorSubject<string>('');
    dataConnectionCreated$ = new BehaviorSubject<boolean>(false);
    mediaConnectionCreated$ = new BehaviorSubject<boolean>(false);
    countryDetected$ = new BehaviorSubject<string>('');
    remoteCountryCode$ = new BehaviorSubject<string>('');
    localStream: MediaStream|undefined;

    constructor() {}

    connect(): Promise<string> {
        this.connected$ = new Subject<boolean>();
        return new Promise((resolve, reject) => {
            const peerId = uuidv4();
            // const peerId = Math.floor(Math.random() * 2 ** 18).toString(36).padStart(4, '0');
            this.peer = new Peer(peerId, {
                port: environment.port || 9000,
                host: '/',
                path: environment.peerServerPath || '/openchatroulette',
                secure: environment.secure || false,
                config: {
                    iceServers: [
                        { urls: environment.stun_urls },
                        {
                            urls: environment.turn_urls,
                            username: environment.turn_username,
                            credential: environment.turn_credential,
                        },
                    ],
                    sdpSemantics: 'unified-plan'
                }
            });
            this.peer.on('open', (id) => {
                this.connected$.next(true);
                this.onConnected();
                resolve(id);
            });
            this.peer.on('error', (error) => {
                reject(error);
            });
        });
    }

    getIsConnected(): boolean {
        return this.peer ? !this.peer.disconnected : false;
    }

    onConnected(): void {
        this.peer.socket.on('message', (data) => {
            // console.log('MESSAGE', data);
            switch (data.type) {
                case ServerMessageType.NewRemotePear:
                    if (data.peerId) {// Auto connect to peer
                        this.connectToPeer(data.peerId, data.countryCode || '');
                    }
                    break;
                case ServerMessageType.CountryDetected:
                    this.countryDetected$.next(data.countryCode || '');
                    break;
                case ServerMessageType.RemoteCountrySet:
                    this.remoteCountryCode$.next(data.countryCode || '');
                    break;
            }
        });

        this.peer.on('disconnected', () => {
            if (this.mediaConnection) {
                this.mediaConnection.close();
            }
            if (this.dataConnection) {
                this.dataConnection.close();
            }
            this.connected$.next(false);
            this.connected$.complete();
        });
        this.peer.on('connection', (dataConnection) => {
            this.dataConnection = dataConnection;
            this.onDataConnectionCreated();
        });
        this.peer.on('call', (mediaConnection: MediaConnection) => {
            this.mediaConnection = mediaConnection;
            setTimeout(() => {
                if (!this.remotePeerConnected$.getValue() && this.dataConnection) {
                    this.callAnswer(this.dataConnection?.peer);
                }
            }, 100);// Sometimes the "call" event occurs before the "connect" event, so a delay is needed
        });
    }

    onDataConnectionCreated(): void {
        if (!this.dataConnection) {
            return;
        }
        this.delayReconnect = false;
        this.dataConnection.on('data', (data) => {
            this.messageStream$.next(String(data));
        });
        this.dataConnection.on('open', () => {
            this.dataConnectionCreated$.next(true);
        });
        this.dataConnection.on('close', () => {
            if (this.remotePeerConnected$.getValue()) {
                this.remotePeerConnected$.next('');
            }
            this.dataConnectionCreated$.next(false);
            if (this.mediaConnection) {
                this.mediaConnection.close();
            }
            this.remoteCountryCode$.next('');
            this.dataConnection = null;
        });
        this.dataConnection.on('error', (e) => {
            console.log('DataConnection ERROR', e);
            this.dataConnectionCreated$.next(false);
        });
    }

    onMediaConnectionCreated(): void {
        if (!this.mediaConnection) {
            return;
        }
        this.mediaConnection?.on('stream', () => {
            clearTimeout(this.timer);
            this.timer = setTimeout(() => {
                this.remotePeerConnected$.next(this.dataConnection?.peer || '');
            }, 1);
        });
        this.mediaConnection.on('close', () => {
            if (this.remotePeerConnected$.getValue()) {
                this.remotePeerConnected$.next('');
            }
            this.mediaConnectionCreated$.next(false);
            this.remoteCountryCode$.next('');
            this.mediaConnection = null;
        });
        this.mediaConnection.on('error', (e) => {
            console.log('MediaConnection ERROR', e);
        });
    }

    getRequestUrl(method: string): string {
        const protocol = this.peer.options.secure ? 'https' : 'http';
        const { host, port, path } = this.peer.options;
        return `${protocol}://${host}:${port}${path}${method}`;
    }

    requestNextPear(countryCode?: string, purpose?: string): void {
        if (countryCode || purpose) {
            this.sendMessageToServer('NEW_REMOTE_PEER_REQUEST', JSON.stringify({
                countryCode,
                purpose
            }));
            return;
        }
        this.sendMessageToServer('NEW_REMOTE_PEER_REQUEST');
    }

    connectToPeer(remotePeerId: string, remotePeerCountryCode = ''): void {
        if (this.peer.disconnected) {
            return;
        }
        this.remoteCountryCode$.next(remotePeerCountryCode);
        this.dataConnection = this.peer.connect(remotePeerId);
        if (!this.dataConnection) {
            return;
        }
        this.onDataConnectionCreated();
        if (this.localStream) {
            this.mediaConnection = this.peer.call(remotePeerId, this.localStream);
            this.onMediaConnectionCreated();
        }
    }

    callAnswer(remotePeerId?: string): void {
        if (!this.mediaConnection) {
            return;
        }
        this.onMediaConnectionCreated();
        this.mediaConnectionCreated$.next(true);
        this.mediaConnection.answer(this.localStream);
    }

    sendMessage(message: string): void {
        if (!this.dataConnection) {
            return;
        }
        this.dataConnection.send(message);
    }

    sendMessageToServer(type: string, message = ''): void {
        if (this.peer && this.peer.socket && (this.peer.socket as any)._socket) {
            (this.peer.socket as any)._socket.send(JSON.stringify({
                type,
                payload: message
            }));
        }
    }

    disconnect(all = false): void {
        if (this.peer.disconnected) {
            return;
        }
        if (this.mediaConnection) {
            this.mediaConnection.close();
        }
        if (this.dataConnection) {
            this.dataConnection.close();
        }
        if (all) {
            this.peer.disconnect();
        }
    }

    setReconnectionDelay(delayReconnect: boolean): void {
        this.delayReconnect = delayReconnect;
    }

    getReconnectionDelay(): number {
        return this.delayReconnect ? 2000 : 1;
    }
}
