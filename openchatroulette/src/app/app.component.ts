import {
    AfterViewInit,
    Component,
    ElementRef,
    HostListener,
    Inject,
    LOCALE_ID,
    OnDestroy,
    OnInit,
    ViewChild
} from '@angular/core';

import {BehaviorSubject, Observable, skip, Subject, takeUntil} from 'rxjs';
import {Select, Store} from '@ngxs/store';

import {TextMessageInterface, TextMessageType} from './models/textmessage.interface';
import {AnimationService} from './services/animation.service';
import {AppState} from './store/states/app.state';
import {UserMediaState} from './store/states/user-media.state';
import {AppAction} from './store/actions/app.actions';
import {UserMediaAction} from './store/actions/user-media.actions';
import {countries, Country} from './models/countries';
import {Purpose} from './models/purpose.enum';

declare const window: Window;

/** Layout constants for responsive video sizing */
const LAYOUT = {
    FOOTER_HEIGHT: 250,
    MOBILE_BREAKPOINT: 992,
    MIN_VIDEO_HEIGHT_MOBILE: 210,
    MIN_VIDEO_HEIGHT_DESKTOP: 300,
    MOBILE_HEIGHT_OFFSET: 50
} as const;

/** Delay constants in milliseconds */
const DELAYS = {
    /** Delay for device switch to prevent race conditions */
    DEVICE_SWITCH_MS: 1,
    /** Delay for debouncing option changes */
    OPTIONS_DEBOUNCE_MS: 400,
    /** Delay before auto-restarting roulette after option change */
    ROULETTE_RESTART_MS: 500
} as const;

/**
 * Main application component for the video chat roulette.
 * Manages peer connections, video streams, and user interface state.
 */
@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {

    // State selectors from NGXS store
    @Select(AppState.connected) connectedState$!: Observable<boolean>;
    @Select(AppState.readyToConnect) readyToConnectState$!: Observable<boolean>;
    @Select(AppState.remotePeerConnected) remotePeerConnectedState$!: Observable<boolean>;
    @Select(AppState.messages) messages$!: Observable<TextMessageInterface[]>;
    @Select(AppState.remoteStream) remoteStream$!: Observable<MediaStream | null>;
    @Select(AppState.remoteCountryCode) remoteCountryCode$!: Observable<string>;
    @Select(AppState.countryCode) countryCode$!: Observable<string>;
    @Select(AppState.countryCodeDetected) countryCodeDetected$!: Observable<string>;
    @Select(AppState.purpose) purpose$!: Observable<string>;

    @Select(UserMediaState.localStream) localStream$!: Observable<MediaStream | null>;
    @Select(UserMediaState.devices) devices$!: Observable<InputDeviceInfo[]>;
    @Select(UserMediaState.audioInputDeviceCurrent) audioInputDeviceCurrent$!: Observable<string>;
    @Select(UserMediaState.videoInputDeviceCurrent) videoInputDeviceCurrent$!: Observable<string>;

    // View references
    @ViewChild('myVideo') myVideo!: ElementRef<HTMLVideoElement>;
    @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;
    @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLElement>;

    // Local state subjects
    isReadyToConnect$ = new BehaviorSubject<boolean>(false);
    isRemotePeerConnected$ = new BehaviorSubject<boolean>(false);
    isConnected$ = new BehaviorSubject<boolean>(false);
    devicesList$ = new BehaviorSubject<InputDeviceInfo[]>([]);
    videoInputDevice$ = new BehaviorSubject<string>('');

    countries: Country[];
    purposeList = [
        {name: Purpose.Dating, title: $localize `Dating < 18`},
        {name: Purpose.Dating18, title: $localize `Dating 18+`},
        {name: Purpose.Discussion, title: $localize `Discussion`},
        {name: Purpose.Broadcast, title: $localize `Broadcast`}
    ];
    currentPurposeName = '';
    currentCountryName = '';
    countrySearchTerm = '';
    optionsPanelOpened = '';
    videoWidth = 400;
    videoHeight = 400;
    isStarted = false;
    messages: TextMessageInterface[] = [];
    private optionsDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    private destroyed$ = new Subject<void>();

    constructor(
        @Inject(LOCALE_ID) public locale: string,
        private store: Store,
        private animationService: AnimationService
    ) {
        this.countries = countries;
    }

    /**
     * Handles window resize events to adjust video dimensions responsively.
     * @param resizedWindow - The window object after resize
     */
    @HostListener('window:resize', ['$event.target'])
    onResize(resizedWindow: Window): void {
        const windowWidth = resizedWindow.innerWidth;
        const windowHeight = resizedWindow.innerHeight;

        if (windowWidth < LAYOUT.MOBILE_BREAKPOINT) {
            this.videoWidth = windowWidth;
            this.videoHeight = Math.max(
                LAYOUT.MIN_VIDEO_HEIGHT_MOBILE,
                Math.floor(windowHeight / 2 - LAYOUT.MOBILE_HEIGHT_OFFSET)
            );
        } else {
            this.videoWidth = windowWidth / 2;
            this.videoHeight = Math.max(
                LAYOUT.MIN_VIDEO_HEIGHT_DESKTOP,
                Math.floor(windowHeight - LAYOUT.FOOTER_HEIGHT)
            );
        }

        if (this.canvas) {
            this.canvas.nativeElement.width = this.videoWidth;
            this.canvas.nativeElement.height = this.videoHeight;
            this.canvas.nativeElement.style.width = this.videoWidth + 'px';
            this.canvas.nativeElement.style.height = this.videoHeight + 'px';
            this.animationService.canvasSizeUpdate(this.canvas.nativeElement);
        }
    }

    /**
     * Pauses particle animation when window loses focus to save resources.
     */
    @HostListener('window:blur', ['$event.target'])
    onWindowBlur(): void {
        this.animationService.particlesOnWindowBlur();
    }

    /**
     * Resumes particle animation when window gains focus.
     */
    @HostListener('window:focus', ['$event.target'])
    onWindowFocus(): void {
        this.animationService.particlesOnWindowFocus();
    }

    ngOnInit(): void {
        // Normalize locale to base language code
        if (this.locale.includes('-')) {
            this.locale = this.locale.split('-')[0];
        }

        // Subscribe to store state changes with automatic cleanup
        this.connectedState$
            .pipe(takeUntil(this.destroyed$))
            .subscribe(this.isConnected$);
        this.remotePeerConnectedState$
            .pipe(takeUntil(this.destroyed$))
            .subscribe(this.isRemotePeerConnected$);
        this.readyToConnectState$
            .pipe(takeUntil(this.destroyed$))
            .subscribe(this.isReadyToConnect$);
        this.devices$
            .pipe(takeUntil(this.destroyed$))
            .subscribe(this.devicesList$);
        this.videoInputDeviceCurrent$
            .pipe(takeUntil(this.destroyed$))
            .subscribe(this.videoInputDevice$);

        this.connectionInit();
    }

    ngAfterViewInit(): void {
        // Use setTimeout to ensure view is fully initialized
        setTimeout(() => {
            this.onResize(window);
            this.animationService.init(this.canvas.nativeElement);
        }, 0);
    }

    /**
     * Initializes connection-related subscriptions and requests local media stream.
     * Sets up listeners for country code, purpose, streams, and messages.
     */
    private connectionInit(): void {
        this.store.dispatch(new UserMediaAction.GetLocalStream({
            audio: true,
            video: true
        }));

        this.countryCode$
            .pipe(takeUntil(this.destroyed$))
            .subscribe((countryCode) => {
                if (countryCode) {
                    const country = this.countries.find((c) => c.code === countryCode);
                    this.currentCountryName = country?.name || $localize `All`;
                } else {
                    this.currentCountryName = $localize `All`;
                }
            });

        this.purpose$
            .pipe(takeUntil(this.destroyed$))
            .subscribe((purpose) => {
                if (purpose) {
                    const purposeItem = this.purposeList.find((p) => p.name === purpose);
                    this.currentPurposeName = purposeItem?.title || this.purposeList[2].title;
                } else {
                    this.currentPurposeName = this.purposeList[2].title;
                }
            });

        this.localStream$
            .pipe(skip(1), takeUntil(this.destroyed$))
            .subscribe((stream) => {
                if (stream) {
                    if (this.devicesList$.getValue().length === 0) {
                        this.store.dispatch(new UserMediaAction.EnumerateDevices());
                    }
                    if (this.myVideo) {
                        this.myVideo.nativeElement.srcObject = stream;
                        this.myVideo.nativeElement.autoplay = true;
                        this.myVideo.nativeElement.muted = true;
                    }
                    this.store.dispatch(new AppAction.SetReadyToConnect(true));
                } else {
                    this.store.dispatch(new AppAction.SetReadyToConnect(false));
                }
            });

        this.remoteStream$
            .pipe(skip(1), takeUntil(this.destroyed$))
            .subscribe((stream) => {
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
            });

        this.connectedState$
            .pipe(takeUntil(this.destroyed$))
            .subscribe((connected) => {
                if (!connected || this.isRemotePeerConnected$.getValue()) {
                    this.animationService.particlesStop();
                    return;
                }
                if (!this.isRemotePeerConnected$.getValue()) {
                    this.animationService.particlesStart();
                }
            });

        this.remotePeerConnectedState$
            .pipe(takeUntil(this.destroyed$))
            .subscribe((remotePeerConnectedState) => {
                if (!this.isConnected$.getValue() || remotePeerConnectedState) {
                    this.animationService.particlesStop();
                    return;
                }
                if (!remotePeerConnectedState) {
                    this.animationService.particlesStart();
                }
            });

        this.messages$
            .pipe(takeUntil(this.destroyed$))
            .subscribe(() => {
                // Auto-scroll to latest message after DOM update
                setTimeout(() => {
                    if (this.messagesContainer) {
                        this.messagesContainer.nativeElement.scrollTop =
                            this.messagesContainer.nativeElement.scrollHeight;
                    }
                }, 0);
            });
    }

    /**
     * Starts the video chat roulette - connects to server or requests next peer.
     */
    rouletteStart(): void {
        if (!this.isReadyToConnect$.getValue()) {
            return;
        }
        this.isStarted = true;
        if (this.isConnected$.getValue()) {
            this.store.dispatch(new AppAction.NextPeer(true));
        } else {
            this.store.dispatch(new AppAction.SetConnected(true));
        }
    }

    /**
     * Stops the video chat roulette and disconnects from server.
     */
    rouletteStop(): void {
        this.isStarted = false;
        this.store.dispatch(new AppAction.SetConnected(false));
    }

    /**
     * Dispatches a message send action to the store.
     * @param _from - Sender identifier (unused, kept for API compatibility)
     * @param message - The message content to send
     */
    sendMessageAction(_from: string, message: string): void {
        this.store.dispatch(new AppAction.MessageSend({
            type: TextMessageType.Answer,
            message
        }));
    }

    /**
     * Sends a message from the input field and clears it.
     * @param fieldEl - The input element containing the message
     */
    sendMessage(fieldEl: HTMLInputElement): void {
        if (!fieldEl.value) {
            return;
        }
        const message = fieldEl.value;
        fieldEl.value = '';
        this.sendMessageAction('me', message);
    }

    /**
     * Handles keyboard events on the message input field.
     * Sends message when Enter key is pressed.
     * @param event - The keyboard event
     */
    onMessageFieldKeyUp(event: KeyboardEvent): void {
        if ((event.key || event.code) === 'Enter') {
            this.sendMessage(event.target as HTMLInputElement);
        }
    }

    /**
     * Handles media input device changes (camera/microphone).
     * Stops current session before switching devices.
     * @param kind - The device type ('videoinput' or 'audioinput')
     * @param device - The device info to switch to
     */
    onDeviceChange(kind: string, device: InputDeviceInfo): void {
        if (this.videoInputDevice$.getValue() === device.deviceId) {
            return;
        }
        if (this.isConnected$.getValue() || this.isRemotePeerConnected$.getValue()) {
            this.rouletteStop();
        }
        // Small delay to prevent race conditions during device switch
        setTimeout(() => {
            this.store.dispatch(new UserMediaAction.SwitchMediaInput({
                kind,
                deviceId: device.deviceId
            }));
        }, DELAYS.DEVICE_SWITCH_MS);
    }

    /**
     * Toggles the visibility of an options panel.
     * @param type - The panel type to toggle ('country', 'purpose', etc.)
     */
    optionsPanelToggle(type: string): void {
        if (this.optionsPanelOpened === type) {
            this.optionsPanelOpened = '';
            return;
        }
        this.optionsPanelOpened = type;
    }

    /**
     * Sets an option value with debouncing to prevent rapid changes.
     * Automatically restarts roulette if connected but not in a call.
     * @param optionName - The option to update ('country' or 'purpose')
     * @param value - The new value to set
     */
    setOptions(optionName: string, value: string): void {
        if (this.optionsDebounceTimer) {
            clearTimeout(this.optionsDebounceTimer);
        }
        this.optionsDebounceTimer = setTimeout(() => {
            switch (optionName) {
                case 'country':
                    this.store.dispatch(new AppAction.UpdateCountryCode(value));
                    break;
                case 'purpose':
                    this.store.dispatch(new AppAction.UpdatePurpose(value));
                    break;
            }
            this.countrySearchTerm = '';
            this.optionsPanelToggle('');
            if (this.isConnected$.getValue() && !this.isRemotePeerConnected$.getValue()) {
                setTimeout(this.rouletteStart.bind(this), DELAYS.ROULETTE_RESTART_MS);
            }
        }, DELAYS.OPTIONS_DEBOUNCE_MS);
    }

    ngOnDestroy(): void {
        if (this.optionsDebounceTimer) {
            clearTimeout(this.optionsDebounceTimer);
        }
        this.destroyed$.next();
        this.destroyed$.complete();
    }
}
