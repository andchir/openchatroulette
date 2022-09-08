import {Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild} from '@angular/core';

import {DataConnection} from 'peerjs';
import {Store, Select, Actions} from '@ngxs/store';

import {TextMessageInterface, TextMessageType} from './models/textmessage.interface';
import {AppAction} from "./store/actions/app.actions";
import {Observable, skip, Subject, take, takeUntil} from "rxjs";
import {AppState} from "./store/states/app.state";

declare const window: Window;

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {

    @Select(AppState.connected) connectedState$: Observable<boolean>;
    @Select(AppState.readyToConnect) readyToConnectState$: Observable<boolean>;
    @Select(AppState.localStream) localStream$: Observable<MediaStream|null>;
    @Select(AppState.remoteStream) remoteStream$: Observable<MediaStream|null>;

    @ViewChild('myVideo') myVideo: ElementRef<HTMLVideoElement>;
    @ViewChild('remoteVideo') remoteVideo: ElementRef<HTMLVideoElement>;

    strangerPeerId: string;
    peerConnection: DataConnection;
    videoHeight = 400;
    isLocalStreamReady = false;
    isStarted = false;
    messages: TextMessageInterface[] = [
        {type: TextMessageType.Question, message: 'Hi, friend!'},
        {type: TextMessageType.Answer, message: 'Hi! What city are you from?'},
        {type: TextMessageType.Question, message: 'I\'m from London.'}
    ];
    destroyed$ = new Subject<void>();

    constructor(
        private store: Store
    ) {

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
        this.onResize(window);
        this.connectionInit();
    }

    connectionInit(): void {
        // this.connectedState$
        //     .pipe(skip(1), take(1))
        //     .subscribe({
        //         next: (connected) => {
        //             console.log('connectionInit', connected);
        //             if (connected) {
        //                 this.getNextPeer();
        //             }
        //         }
        //     });

        this.store.dispatch(new AppAction.GetLocalStream());

        this.localStream$
            .subscribe({
                next: (stream) => {
                    if (stream && this.myVideo) {
                        this.isLocalStreamReady = true;
                        this.myVideo.nativeElement.srcObject = stream;
                        this.myVideo.nativeElement.autoplay = true;
                    } else {
                        this.isLocalStreamReady = false;
                    }
                }
            });

        this.remoteStream$
            .subscribe({
                next: (stream) => {
                    console.log('this.remoteStream$', !!stream);
                    if (!this.remoteVideo) {
                        return;
                    }
                    this.remoteVideo.nativeElement.srcObject = stream;
                    if (stream) {
                        this.remoteVideo.nativeElement.autoplay = true;
                    } else {
                        this.remoteVideo.nativeElement.pause();
                        this.remoteVideo.nativeElement.load();
                    }
                }
            });
    }

    rouletteStart(): void {
        if (!this.isLocalStreamReady) {
            return;
        }
        this.isStarted = true;
        if (this.store.snapshot().connected) {
            this.store.dispatch(new AppAction.NextPeer());
        } else {
            this.store.dispatch(new AppAction.SetConnected(true));
        }
    }

    rouletteStop(): void {
        this.isStarted = false;
        this.store.dispatch(new AppAction.SetConnected(false));
    }

    sendMessageAction(from: string, message: string) {
        // const event = new SendWebSocketMessage({
        //     type: 'message',
        //     from,
        //     message
        // });
        // this.store.dispatch(event);
        console.log('sendMessageAction', from, message);
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
        // this.peerjsService.messageStream$.subscribe({
        //     next: (message) => {
        //         console.log('New message received:', message);
        //         this.messages.push({message, type: 'answer'});
        //     }
        // });
    }

    ngOnDestroy(): void {
        // this.peerjsService.messageStream$.unsubscribe();
        this.destroyed$.next();
        this.destroyed$.complete();
    }
}
