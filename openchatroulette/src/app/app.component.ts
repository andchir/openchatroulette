import {Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild} from '@angular/core';

import {BehaviorSubject, distinct, Observable, skip, Subject, takeUntil} from 'rxjs';
import {DataConnection} from 'peerjs';
import {Store, Select} from '@ngxs/store';

import {TextMessageInterface, TextMessageType} from './models/textmessage.interface';
import {AppAction} from './store/actions/app.actions';
import {AppState} from './store/states/app.state';

declare const window: Window;

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {

    @Select(AppState.connected) connectedState$: Observable<boolean>;
    @Select(AppState.readyToConnect) readyToConnectState$: Observable<boolean>;
    @Select(AppState.remotePeerConnected) remotePeerConnectedState$: Observable<boolean>;
    @Select(AppState.messages) messages$: Observable<TextMessageInterface[]>;
    @Select(AppState.localStream) localStream$: Observable<MediaStream|null>;
    @Select(AppState.remoteStream) remoteStream$: Observable<MediaStream|null>;

    @ViewChild('myVideo') myVideo: ElementRef<HTMLVideoElement>;
    @ViewChild('remoteVideo') remoteVideo: ElementRef<HTMLVideoElement>;

    isReadyToConnect$ = new BehaviorSubject(false);
    isConnected$ = new BehaviorSubject(false);
    isRemotePeerConnected$ = new BehaviorSubject(false);

    strangerPeerId: string;
    peerConnection: DataConnection;
    videoHeight = 400;
    isStarted = false;
    messages: TextMessageInterface[] = [
        {type: TextMessageType.Question, message: 'Hi, friend!'},
        {type: TextMessageType.Answer, message: 'Hi! What city are you from?'},
        {type: TextMessageType.Question, message: 'I\'m from London.'}
    ];
    destroyed$ = new Subject<void>();

    constructor(
        private store: Store
    ) {}

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
        this.connectedState$.subscribe(this.isConnected$);
        this.readyToConnectState$.subscribe(this.isReadyToConnect$);
        this.remotePeerConnectedState$.subscribe(this.isRemotePeerConnected$);

        this.onResize(window);
        this.connectionInit();
    }

    connectionInit(): void {
        this.store.dispatch(new AppAction.GetLocalStream());

        this.localStream$
            .pipe(skip(1), takeUntil(this.destroyed$))
            .subscribe({
                next: (stream) => {
                    if (stream) {
                        if (this.myVideo) {
                            this.myVideo.nativeElement.srcObject = stream;
                            this.myVideo.nativeElement.autoplay = true;
                        }
                    }
                }
            });

        this.remoteStream$
            .pipe(skip(1), takeUntil(this.destroyed$))
            .subscribe({
                next: (stream) => {
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

        this.remotePeerConnectedState$
            .pipe(skip(1), takeUntil(this.destroyed$))
            .subscribe({
                next: (remotePeerConnectedState) => {
                    console.log('remotePeerConnectedState', remotePeerConnectedState);
                }
            })
    }

    rouletteStart(): void {
        if (!this.isReadyToConnect$.getValue()) {
            return;
        }
        this.isStarted = true;
        if (this.isConnected$.getValue()) {
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
        this.store.dispatch(new AppAction.MessageSend({
            type: 'answer',
            message
        }));
    }

    sendMessage(fieldEl: HTMLInputElement): void {
        if (!fieldEl.value) {
            return;
        }
        const message = fieldEl.value;
        fieldEl.value = '';
        this.sendMessageAction('me', message);
    }

    onMessageFieldKeyUp(event: KeyboardEvent): void {
        if ((event.key || event.code) === 'Enter') {
            this.sendMessage(event.target as HTMLInputElement);
        }
    }

    ngOnDestroy(): void {
        this.destroyed$.next();
        this.destroyed$.complete();
    }
}
