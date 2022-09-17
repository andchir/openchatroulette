import {AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild} from '@angular/core';

import {BehaviorSubject, Observable, skip, Subject, takeUntil} from 'rxjs';
import {Store, Select} from '@ngxs/store';

import {TextMessageInterface, TextMessageType} from './models/textmessage.interface';
import {AnimationService} from './services/animation.service';
import {AppState} from './store/states/app.state';
import {UserMediaState} from './store/states/user-media.state';
import {AppAction} from './store/actions/app.actions';
import {UserMediaAction} from './store/actions/user-media.actions';
import {Country, countries} from './models/countries';

declare const window: Window;

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {

    @Select(AppState.connected) connectedState$: Observable<boolean>;
    @Select(AppState.readyToConnect) readyToConnectState$: Observable<boolean>;
    @Select(AppState.remotePeerConnected) remotePeerConnectedState$: Observable<boolean>;
    @Select(AppState.messages) messages$: Observable<TextMessageInterface[]>;
    @Select(AppState.remoteStream) remoteStream$: Observable<MediaStream|null>;
    @Select(AppState.countryCode) countryCode$: Observable<string>;
    @Select(AppState.purpose) purpose$: Observable<string>;

    @Select(UserMediaState.localStream) localStream$: Observable<MediaStream|null>;
    @Select(UserMediaState.devices) devices$: Observable<InputDeviceInfo[]>;
    @Select(UserMediaState.audioInputDeviceCurrent) audioInputDeviceCurrent$: Observable<string>;
    @Select(UserMediaState.videoInputDeviceCurrent) videoInputDeviceCurrent$: Observable<string>;

    @ViewChild('myVideo') myVideo: ElementRef<HTMLVideoElement>;
    @ViewChild('remoteVideo') remoteVideo: ElementRef<HTMLVideoElement>;
    @ViewChild('canvas') canvas: ElementRef<HTMLCanvasElement>;

    isReadyToConnect$ = new BehaviorSubject(false);
    isRemotePeerConnected$ = new BehaviorSubject(false);
    isConnected$ = new BehaviorSubject(false);
    devicesList$ = new BehaviorSubject<InputDeviceInfo[]>([]);

    countries: Country[];
    optionsPanelOpened = '';
    videoWidth = 400;
    videoHeight = 400;
    isStarted = false;
    messages: TextMessageInterface[] = [];
    destroyed$ = new Subject<void>();

    constructor(
        private store: Store,
        private animationService: AnimationService
    ) {
        this.countries = countries;
    }

    @HostListener('window:resize', ['$event.target'])
    onResize(window: Window): void {
        const footerHeight = 250;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        if (windowWidth < 992) {
            this.videoWidth = windowWidth;
            this.videoHeight = 300;
        } else {
            this.videoWidth = windowWidth / 2;
            this.videoHeight = Math.floor(windowHeight - footerHeight);
        }
        if (this.canvas) {
            this.canvas.nativeElement.width = this.videoWidth;
            this.canvas.nativeElement.height = this.videoHeight;
            this.canvas.nativeElement.style.width = this.videoWidth + 'px';
            this.canvas.nativeElement.style.height = this.videoHeight + 'px';
            this.animationService.canvasSizeUpdate(this.canvas.nativeElement);
        }
    }

    ngOnInit(): void {
        this.connectedState$.subscribe(this.isConnected$);
        this.readyToConnectState$.subscribe(this.isReadyToConnect$);
        this.devices$.subscribe(this.devicesList$);
        this.connectionInit();
    }

    ngAfterViewInit(): void {
        setTimeout(() => {
            this.onResize(window);
            this.animationService.init(this.canvas.nativeElement);
        }, 0);
    }

    connectionInit(): void {
        this.store.dispatch(new UserMediaAction.GetLocalStream({
            audio: true,
            video: true
        }));

        this.localStream$
            .pipe(skip(1), takeUntil(this.destroyed$))
            .subscribe({
                next: (stream) => {
                    if (stream) {
                        if (this.devicesList$.getValue().length === 0) {
                            this.store.dispatch(new UserMediaAction.EnumerateDevices());
                        }
                        if (this.myVideo) {
                            this.myVideo.nativeElement.srcObject = stream;
                            this.myVideo.nativeElement.autoplay = true;
                        }
                        this.store.dispatch(new AppAction.SetReadyToConnect(true));
                    } else {
                        this.store.dispatch(new AppAction.SetReadyToConnect(false));
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

        this.connectedState$
            .pipe(takeUntil(this.destroyed$))
            .subscribe({
                next: (connected) => {
                    if (!connected || this.isRemotePeerConnected$.getValue()) {
                        this.animationService.particlesStop();
                        return;
                    }
                    if (!this.isRemotePeerConnected$.getValue()) {
                        this.animationService.particlesStart();
                    }
                }
            });

        this.remotePeerConnectedState$
            .pipe(takeUntil(this.destroyed$))
            .subscribe({
                next: (remotePeerConnectedState) => {
                    if (!this.isConnected$.getValue() || remotePeerConnectedState) {
                        this.animationService.particlesStop();
                        return;
                    }
                    if (!remotePeerConnectedState) {
                        this.animationService.particlesStart();
                    }
                }
            });
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
        this.animationService.particlesStart();
    }

    rouletteStop(): void {
        this.isStarted = false;
        this.store.dispatch(new AppAction.SetConnected(false));
    }

    sendMessageAction(from: string, message: string) {
        this.store.dispatch(new AppAction.MessageSend({
            type: TextMessageType.Answer,
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

    onDeviceChange(kind: string, event: Event): void {
        if (this.isConnected$.getValue() || this.isRemotePeerConnected$.getValue()) {
            this.rouletteStop();
        }
        setTimeout(() => {
            this.store.dispatch(new UserMediaAction.SwitchMediaInput({
                kind,
                deviceId: (event.target as HTMLInputElement).value
            }));
        }, 1);
    }

    optionsPanelToggle(type: string): void {
        if (this.optionsPanelOpened === type) {
            this.optionsPanelOpened = '';
            return;
        }
        this.optionsPanelOpened = type;
    }

    ngOnDestroy(): void {
        this.destroyed$.next();
        this.destroyed$.complete();
    }
}
