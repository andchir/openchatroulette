import {Injectable} from '@angular/core';

import {BehaviorSubject, Subject} from 'rxjs';
import {DataConnection, MediaConnection, Peer} from 'peerjs';
import {v4 as uuidv4} from 'uuid';

import {environment} from '../../environments/environment';

/**
 * Server message types for WebSocket communication
 */
export enum ServerMessageType {
    NewRemotePeer = 'NEW_REMOTE_PEER',
    CountryDetected = 'COUNTRY_DETECTED',
    CountrySet = 'COUNTRY_SET',
    RemoteCountrySet = 'REMOTE_COUNTRY_SET',
    PurposeSet = 'PURPOSE_SET'
}

/** Delay in milliseconds before emitting remote peer connected status */
const STREAM_STATUS_DELAY_MS = 1;

/** Delay in milliseconds to wait for data connection before answering call */
const CALL_ANSWER_DELAY_MS = 100;

/**
 * Service for managing PeerJS connections and WebRTC communication.
 * Handles peer-to-peer data and media connections for video chat.
 */
@Injectable({
    providedIn: 'root'
})
export class PeerjsService {

    private peer!: Peer;
    private delayReconnect = false;
    private streamStatusTimer: ReturnType<typeof setTimeout> | null = null;

    dataConnection: DataConnection | null = null;
    mediaConnection: MediaConnection | null = null;
    connected$: Subject<boolean> = new Subject<boolean>();
    messageStream$ = new Subject<string>();
    remotePeerConnected$ = new BehaviorSubject<string>('');
    dataConnectionCreated$ = new BehaviorSubject<boolean>(false);
    mediaConnectionCreated$ = new BehaviorSubject<boolean>(false);
    countryDetected$ = new BehaviorSubject<string>('');
    remoteCountryCode$ = new BehaviorSubject<string>('');
    localStream: MediaStream | undefined;

    constructor() {}

    /**
     * Establishes connection to the PeerJS signaling server.
     * Creates a new Peer instance with unique ID and configures ICE servers.
     * @returns Promise that resolves with the assigned peer ID
     */
    connect(): Promise<string> {
        this.connected$ = new Subject<boolean>();
        return new Promise((resolve, reject) => {
            const peerId = uuidv4();
            this.peer = new Peer(peerId, {
                port: environment.peerServerPort || 9000,
                host: environment.peerServerHost || '/',
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
                console.error('Peer connection error:', error);
                reject(error);
            });
        });
    }

    /**
     * Checks if the peer is currently connected to the signaling server.
     * @returns true if connected, false otherwise
     */
    getIsConnected(): boolean {
        return this.peer ? !this.peer.disconnected : false;
    }

    /**
     * Sets up event handlers after successfully connecting to the signaling server.
     * Handles incoming messages, disconnection, and incoming peer connections.
     */
    private onConnected(): void {
        this.peer.socket.on('message', (data: { type: string; peerId?: string; countryCode?: string }) => {
            switch (data.type) {
                case ServerMessageType.NewRemotePeer:
                    if (data.peerId) {
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
            // Sometimes the 'call' event occurs before the 'connection' event,
            // so a delay is needed to ensure data connection is established first
            setTimeout(() => {
                if (!this.remotePeerConnected$.getValue() && this.dataConnection) {
                    this.callAnswer();
                }
            }, CALL_ANSWER_DELAY_MS);
        });
    }

    /**
     * Sets up event handlers for the data connection channel.
     * Handles incoming messages, connection state changes, and errors.
     */
    private onDataConnectionCreated(): void {
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

        this.dataConnection.on('error', (error) => {
            console.error('DataConnection error:', error);
            this.dataConnectionCreated$.next(false);
        });
    }

    /**
     * Sets up event handlers for the media connection (video/audio stream).
     * Handles stream events, connection closure, and errors.
     */
    private onMediaConnectionCreated(): void {
        if (!this.mediaConnection) {
            return;
        }

        this.mediaConnection.on('stream', () => {
            if (this.streamStatusTimer) {
                clearTimeout(this.streamStatusTimer);
            }
            // Use minimal delay to ensure stream is fully established
            this.streamStatusTimer = setTimeout(() => {
                this.remotePeerConnected$.next(this.dataConnection?.peer || '');
            }, STREAM_STATUS_DELAY_MS);
        });

        this.mediaConnection.on('close', () => {
            if (this.remotePeerConnected$.getValue()) {
                this.remotePeerConnected$.next('');
            }
            this.mediaConnectionCreated$.next(false);
            this.remoteCountryCode$.next('');
            this.mediaConnection = null;
        });

        this.mediaConnection.on('error', (error) => {
            console.error('MediaConnection error:', error);
        });
    }

    /**
     * Constructs the URL for making HTTP requests to the peer server.
     * @param method - The API method/endpoint to call
     * @returns Fully qualified URL string
     */
    getRequestUrl(method: string): string {
        const protocol = this.peer.options.secure ? 'https' : 'http';
        const { host, port, path } = this.peer.options;
        return `${protocol}://${host}:${port}${path}${method}`;
    }

    /**
     * Requests a new peer to connect with from the signaling server.
     * Optionally filters by country code or purpose.
     * @param countryCode - Optional country code filter
     * @param purpose - Optional purpose filter (e.g., 'discussion', 'dating')
     */
    requestNextPeer(countryCode?: string, purpose?: string): void {
        if (countryCode || purpose) {
            this.sendMessageToServer('NEW_REMOTE_PEER_REQUEST', JSON.stringify({
                countryCode,
                purpose
            }));
            return;
        }
        this.sendMessageToServer('NEW_REMOTE_PEER_REQUEST');
    }

    /**
     * Initiates connection to a specific remote peer.
     * Creates both data and media connections.
     * @param remotePeerId - The ID of the peer to connect to
     * @param remotePeerCountryCode - The country code of the remote peer
     */
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

    /**
     * Answers an incoming media call from a remote peer.
     * Sets up the media connection and provides the local stream.
     */
    callAnswer(): void {
        if (!this.mediaConnection) {
            return;
        }
        this.onMediaConnectionCreated();
        this.mediaConnectionCreated$.next(true);
        this.mediaConnection.answer(this.localStream);
    }

    /**
     * Sends a text message to the connected remote peer.
     * @param message - The message content to send
     */
    sendMessage(message: string): void {
        if (!this.dataConnection) {
            return;
        }
        this.dataConnection.send(message);
    }

    /**
     * Sends a message directly to the signaling server via WebSocket.
     * Used for server-side operations like requesting new peers.
     * @param type - The message type identifier
     * @param message - Optional message payload
     */
    sendMessageToServer(type: string, message = ''): void {
        try {
            // Access internal socket API for direct server communication
            const socket = this.peer?.socket as { _socket?: WebSocket } | undefined;
            if (socket?._socket) {
                socket._socket.send(JSON.stringify({
                    type,
                    payload: message
                }));
            }
        } catch (error) {
            console.error('Failed to send message to server:', error);
        }
    }

    /**
     * Disconnects from the current peer or completely disconnects from the server.
     * @param all - If true, disconnects from the signaling server entirely
     */
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

    /**
     * Sets whether to delay before attempting to reconnect.
     * @param delayReconnect - True to enable delay, false to disable
     */
    setReconnectionDelay(delayReconnect: boolean): void {
        this.delayReconnect = delayReconnect;
    }

    /**
     * Gets the current reconnection delay in milliseconds.
     * @returns Delay value: 2000ms if delay is enabled, 1ms otherwise
     */
    getReconnectionDelay(): number {
        return this.delayReconnect ? 2000 : 1;
    }
}
