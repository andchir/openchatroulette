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
    connected$ = new BehaviorSubject<boolean>(false);
    remotePeerConnected$ = new BehaviorSubject<boolean>(false);
    timer: any;
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
            this.onDataConnectionCreated();
        });
        this.peer.on('call', (mediaConnection: MediaConnection) => {
            this.mediaConnection = mediaConnection;
            if (!this.remotePeerConnected$.getValue() && this.dataConnection) {
                this.callAnswer(this.dataConnection?.peer);
            }
        });
    }

    onDataConnectionCreated(): void {
        if (!this.dataConnection) {
            return;
        }
        this.dataConnection.on('data', (data) => {
            console.log(`received: ${data}`);
            this.messageStream$.next(String(data));
        });
        this.dataConnection.on('open', () => {
            // this.dataConnection.send('hello!');
        });
        this.dataConnection.on('close', () => {
            if (this.remotePeerConnected$.getValue()) {
                this.remotePeerConnected$.next(false);
            }
        });
        this.dataConnection.on('error', (e) => {
            console.log('DataConnection ERROR', e);
        });
    }

    onMediaConnectionCreated(): void {
        if (!this.mediaConnection) {
            return;
        }
        this.mediaConnection?.on('stream', (remoteStream) => {
            clearTimeout(this.timer);
            this.timer = setTimeout(() => {
                this.remotePeerConnected$.next(true);
            }, 1);
        });
        this.mediaConnection.on('close', () => {
            if (this.remotePeerConnected$.getValue()) {
                this.remotePeerConnected$.next(false);
            }
        });
        this.mediaConnection.on('error', (e) => {
            console.log('MediaConnection ERROR', e);
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
        this.onDataConnectionCreated();
        return new Promise((resolve, reject) => {
            navigator.mediaDevices.getUserMedia({video: true, audio: true})
                .then((stream) => {
                    this.mediaConnection = this.peer.call(remotePeerId, stream);
                    this.mediaConnection.on('stream', (remoteStream) => {
                        resolve(remoteStream);
                    });
                    this.onMediaConnectionCreated();
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
                this.onMediaConnectionCreated();
            })
            .catch((err) => {
                console.error('Failed to get local stream', err);
            });
    }

    disconnect(all = false): void {
        if (this.peer.disconnected) {
            return;
        }
        if (this.mediaConnection) {
            this.mediaConnection.close();
            this.mediaConnection = null;
        }
        if (this.dataConnection) {
            this.dataConnection.close();
            this.dataConnection = null;
        }
        if (all) {
            this.peer.disconnect();
        }
    }

    handleError<T>(error: HttpErrorResponse) {
        return throwError(error.error);
    }
}
