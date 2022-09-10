import {HttpClient, HttpErrorResponse, HttpHeaders} from '@angular/common/http';
import {Injectable} from '@angular/core';

import {BehaviorSubject, catchError, Observable, Subject, throwError} from 'rxjs';
import {DataConnection, MediaConnection, Peer} from 'peerjs';
import {v4 as uuidv4} from 'uuid';

@Injectable({
    providedIn: 'root'
})
export class PeerjsService {

    private peer: Peer;
    dataConnection: DataConnection|null;
    mediaConnection: MediaConnection|null;
    messageStream$ = new Subject<string>();
    connected$ = new Subject<boolean>();
    remotePeerConnected$ = new BehaviorSubject<string|null|undefined>(null);
    public headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    });

    constructor(
        private http: HttpClient
    ) {}

    connect(): Promise<string> {
        return new Promise((resolve, reject) => {
            // const peerId = uuidv4();
            const peerId = Math.floor(Math.random() * 2 ** 18).toString(36).padStart(4, '0');
            this.peer = new Peer(peerId, {
                port: 8000,
                host: '/',
                path: '/openchatroulette'
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
        this.peer.on('disconnected', (currentId: string) => {
            console.log('disconnected', currentId);
            if (this.mediaConnection) {
                this.mediaConnection.close();
                this.mediaConnection = null;
            }
            if (this.dataConnection) {
                this.dataConnection.close();
                this.dataConnection = null;
            }
            this.connected$.next(false);
        });
        this.peer.on('connection', (dataConnection) => {
            this.dataConnection = dataConnection;
            console.log('incoming peer connection!', dataConnection.peer);
            this.dataConnection.on('data', (data) => {
                console.log(`received: ${data}`);
                //this.messageStream$.next(String(data));
            });
            this.dataConnection.on('open', () => {
                console.log('dataConnection open');
                dataConnection.send('hello!');
            });
            this.dataConnection.on('close', () => {
                this.remotePeerConnected$.next(null);
            });
            this.dataConnection.on('error', (e) => {
                console.log('DataConnection ERROR', e);
            });
        });
        this.peer.on('call', (mediaConnection: MediaConnection) => {
            this.mediaConnection = mediaConnection;
            if (!this.remotePeerConnected$.getValue() && this.dataConnection) {
                console.log('CALL FROM', this.dataConnection.peer);
                this.callAnswer(this.dataConnection?.peer);
            }
        });
    }

    getUserMedia(): Promise<MediaStream> {
        return navigator.mediaDevices.getUserMedia({video: true, audio: true});
    }

    getRequestUrl(method: string): string {
        const protocol = this.peer.options.secure ? 'https' : 'http';
        const { host, port, path, key } = this.peer.options;
        return `${protocol}://${host}:${port}${path}${method}`;
    }

    nextPeer(): Observable<{"peerId": string}> {
        const url = this.getRequestUrl(`random_peer/${this.peer.id}`);
        return this.http.get<{"peerId": string}>(url, {headers: this.headers})
            .pipe(
                catchError(this.handleError)
            );
    }

    connectToPeer(remotePeerId: string): Promise<any> {
        if (this.peer.disconnected) {
            return Promise.reject(null);
        }
        this.dataConnection = this.peer.connect(remotePeerId);
        if (!this.dataConnection) {
            return Promise.reject(null);
        }
        this.dataConnection.on('data', (data) => {
            this.messageStream$.next(String(data));
        });
        this.dataConnection.on('open', () => {
            if (this.dataConnection) {
                this.dataConnection.send('hi!');
            }
        });
        this.dataConnection.on('close', () => {
            this.remotePeerConnected$.next(null);
        });
        this.dataConnection.on('error', (e) => {
            console.log('DataConnection ERROR', e);
        });
        return new Promise((resolve, reject) => {
            navigator.mediaDevices.getUserMedia({video: true, audio: true})
                .then((stream) => {
                    this.mediaConnection = this.peer.call(remotePeerId, stream);
                    this.mediaConnection.on('stream', (remoteStream) => {
                        this.remotePeerConnected$.next(remotePeerId);
                        resolve(remoteStream);
                    });
                    this.mediaConnection?.on('close', () => {
                        this.remotePeerConnected$.next(null);
                    });
                    this.mediaConnection?.on('error', (e) => {
                        this.remotePeerConnected$.next(null);
                        console.log('MediaConnection ERROR', e);
                    });
                })
                .catch((err) => {
                    console.log('Failed to get local stream', err);
                    reject(null);
                });
        });
    }

    callAnswer(remotePeerId: string): void {
        if (!this.mediaConnection) {
            return;
        }
        navigator.mediaDevices.getUserMedia({video: true, audio: true})
            .then((stream) => {
                this.mediaConnection?.answer(stream);
                this.mediaConnection?.on('stream', (remoteStream) => {
                    this.remotePeerConnected$.next(remotePeerId);
                });
                this.mediaConnection?.on('close', () => {
                    this.remotePeerConnected$.next(null);
                });
                this.mediaConnection?.on('error', (e) => {
                    this.remotePeerConnected$.next(null);
                    console.log('MediaConnection ERROR', e);
                });
            })
            .catch((err) => {
                this.remotePeerConnected$.next(null);
                console.error('Failed to get local stream', err);
            });
    }

    disconnect(): void {
        if (this.peer.disconnected) {
            return;
        }
        this.peer.disconnect();
    }

    handleError<T>(error: HttpErrorResponse) {
        return throwError(error.error);
    }
}
