import {Component, HostListener, OnDestroy, OnInit} from '@angular/core';

import {DataConnection} from 'peerjs';
import {Store} from '@ngxs/store';
import {ConnectWebSocket, DisconnectWebSocket, SendWebSocketMessage} from '@ngxs/websocket-plugin';

import {PeerjsService} from './services/peerjs.service';
import {TextMessageInterface, TextMessageType} from './models/textmessage.interface';

declare const window: Window;

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {

    readonly peerId: string;
    strangerPeerId: string;
    peerConnection: DataConnection;
    videoHeight = 400;
    isStarted = false;
    messages: TextMessageInterface[] = [
        {type: TextMessageType.Question, message: 'Hi, friend!'},
        {type: TextMessageType.Answer, message: 'Hi! What city are you from?'},
        {type: TextMessageType.Question, message: 'I\'m from London.'}
    ];

    constructor(
        private store: Store,
        private peerjsService: PeerjsService
    ) {
        // this.peerId = this.peerjsService.peerInit();
    }

    @HostListener('window:resize', ['$event.target'])
    onResize(window: Window): void {
        const footerHeight = 250;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        if (windowWidth < 992) {
            this.videoHeight = 300;
        } else {
            this.videoHeight = Math.floor(windowHeight - footerHeight);
        }
    }

    ngOnInit(): void {
        this.store.dispatch(new ConnectWebSocket());
        this.onResize(window);
        this.messagesInit();
    }

    rouletteStart(): void {
        this.isStarted = true;
    }

    rouletteStop(): void {
        this.isStarted = false;
    }

    sendMessageAction(from: string, message: string) {
        const event = new SendWebSocketMessage({
            type: 'message',
            from,
            message
        });
        this.store.dispatch(event);
    }

    sendMessage(fieldEl: HTMLInputElement): void {
        if (!fieldEl.value) {
            return;
        }
        const message = fieldEl.value;
        fieldEl.value = '';
        // if (!this.strangerPeerId && this.peerjsService.peerConnection) {
        //     this.strangerPeerId = this.peerjsService.peerConnection.peer;
        //     this.peerConnection = this.peerjsService.peerConnection;
        // }
        // if (!this.strangerPeerId) {
        //     this.strangerPeerId = message;
        //     this.peerConnection = this.peerjsService.connectToPeer(this.strangerPeerId);
        //     return;
        // }
        // this.messages.push({message, type: 'question'});
        // this.peerConnection.send(message);
        this.sendMessageAction('me', message);
    }

    onMessageFieldKeyUp(event: KeyboardEvent): void {
        if ((event.key || event.code) === 'Enter') {
            this.sendMessage(event.target as HTMLInputElement);
        }
    }

    messagesInit(): void {
        this.peerjsService.messageStream$.subscribe({
            next: (message) => {
                console.log('New message received:', message);
                this.messages.push({message, type: 'answer'});
            }
        });
    }

    ngOnDestroy(): void {
        // this.peerjsService.messageStream$.unsubscribe();
        this.store.dispatch(new DisconnectWebSocket());
    }
}
