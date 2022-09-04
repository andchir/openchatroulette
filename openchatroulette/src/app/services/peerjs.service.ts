import {HttpClient, HttpErrorResponse, HttpHeaders} from '@angular/common/http';
import {Injectable} from '@angular/core';

import {catchError, Observable, Subject, throwError} from 'rxjs';
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
    disconnected$ = new Subject<string>();
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
                this.onConnected();
                resolve(id);
            });
            this.peer.on('error', (error) => {
                reject(error);
            });
        });
    }

    onConnected(): void {
        this.peer.on('close', () => {
            console.log('close');
        });
        this.peer.on('disconnected', (currentId: string) => {
            console.log('disconnected', currentId);
            this.disconnected$.next(currentId);
            if (this.dataConnection) {
                this.dataConnection.close();
            }
            this.dataConnection = null;
        });
        this.peer.on('connection', (dataConnection) => {
            this.dataConnection = dataConnection;
            console.log('incoming peer connection!');
            dataConnection.on('data', (data) => {
                console.log(`received: ${data}`);
                this.messageStream$.next(String(data));
            });
            dataConnection.on('open', () => {
                console.log('dataConnection open');
                dataConnection.send('hello!');
            });
        });
        this.peer.on('call', (mediaConnection: MediaConnection) => {
            this.mediaConnection = mediaConnection;
            console.log('on call');
            navigator.mediaDevices.getUserMedia({video: true, audio: true})
                .then((stream) => {
                    mediaConnection.answer(stream);
                    mediaConnection.on('stream', (remoteStream) => {
                        console.log('GOT REMOTE STREAM', remoteStream);
                    });
                })
                .catch((err) => {
                    console.error('Failed to get local stream', err);
                });
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

    connectToPeer(peerId: string): Promise<any> {
        this.dataConnection = this.peer.connect(peerId);
        this.dataConnection.on('data', (data) => {
            this.messageStream$.next(String(data));
        });
        this.dataConnection.on('open', () => {
            console.log('dataConnection open');
            if (this.dataConnection) {
                this.dataConnection.send('hi!');
            }
        });
        return new Promise((resolve, reject) => {
            navigator.mediaDevices.getUserMedia({video: true, audio: true})
                .then((stream) => {
                    this.mediaConnection = this.peer.call(peerId, stream);
                    this.mediaConnection.on('stream', (remoteStream) => {
                        resolve(remoteStream);
                    });
                })
                .catch((err) => {
                    console.log('Failed to get local stream', err);
                    reject();
                });
        });
    }

    handleError<T>(error: HttpErrorResponse) {
        return throwError(error.error);
    }
}
