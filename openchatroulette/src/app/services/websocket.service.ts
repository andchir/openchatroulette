import {Inject, Injectable, OnDestroy} from '@angular/core';

import {Subject} from 'rxjs';
import {WebSocketSubject, WebSocketSubjectConfig} from 'rxjs/webSocket';
import {IWsMessage, WebSocketConfig} from '../models/websocket.interface';

import {config} from '../models/websocket.config';

@Injectable({
    providedIn: 'root'
})
export class WebsocketService implements OnDestroy {

    private config: WebSocketSubjectConfig<IWsMessage<any>>;
    private websocket$: WebSocketSubject<IWsMessage<any>>;
    private wsMessages$: Subject<IWsMessage<any>>;

    private reconnectInterval: number;
    private reconnectAttempts: number;
    private isConnected: boolean;

    constructor(@Inject(config) private wsConfig: WebSocketConfig) {
        this.reconnectInterval = wsConfig.reconnectInterval || 5000;
        this.reconnectAttempts = wsConfig.reconnectAttempts || 10;
    }

    private connect(): void {
        console.log('ws connect');
        this.websocket$ = new WebSocketSubject(this.config);

        this.websocket$.subscribe({
            next: (message) => {
                this.wsMessages$.next(message);
            },
            error: () => {
                if (!this.websocket$) {
                    this.reconnect();
                }
            }
        });
    }


    private reconnect(): void {
        console.log('ws reconnect');
    }

    ngOnDestroy() {

    }
}
