import {Injectable} from '@angular/core';

import {State, Action, Selector, StateContext, Store} from '@ngxs/store';
import {skip, takeUntil} from 'rxjs';

import {AppAction} from '../actions/app.actions';
import {TextMessageInterface, TextMessageType} from '../../models/textmessage.interface';
import {PeerjsService, ServerMessageType} from '../../services/peerjs.service';
import {Purpose} from '../../models/purpose.enum';

export class AppStateModel {
    public connected: boolean;
    public remotePeerConnected: boolean;
    public readyToConnect: boolean;
    public localPeerId: string;
    public remotePeerId: string;
    public remoteStream: MediaStream|null;
    public remoteCountryCode: string;
    public messages: TextMessageInterface[];
    public countryCode: string;
    public countryCodeDetected: string;
    public purpose: string;
}

const defaults = {
    connected: false,
    remotePeerConnected: false,
    readyToConnect: false,
    localPeerId: '',
    remotePeerId: '',
    remoteStream: null,
    remoteCountryCode: '',
    messages: [],
    countryCode: '',
    countryCodeDetected: '',
    purpose: Purpose.Discussion
};

@State<AppStateModel>({
    name: 'app',
    defaults
})
@Injectable()
export class AppState {

    constructor(
        private store: Store,
        private peerjsService: PeerjsService
    ) {}

    @Selector()
    static connected(state: AppStateModel) {
        return state.connected;
    }

    @Selector()
    static readyToConnect(state: AppStateModel) {
        return state.readyToConnect;
    }

    @Selector()
    static remotePeerConnected(state: AppStateModel) {
        return state.remotePeerConnected;
    }

    @Selector()
    static remoteStream(state: AppStateModel) {
        return state.remoteStream;
    }

    @Selector()
    static remoteCountryCode(state: AppStateModel) {
        return state.remoteCountryCode;
    }

    @Selector()
    static messages(state: AppStateModel) {
        return state.messages;
    }

    @Selector()
    static countryCode(state: AppStateModel) {
        return state.countryCode;
    }

    @Selector()
    static countryCodeDetected(state: AppStateModel) {
        return state.countryCodeDetected;
    }

    @Selector()
    static purpose(state: AppStateModel) {
        return state.purpose;
    }

    @Action(AppAction.SetConnected)
    setConnected(ctx: StateContext<AppStateModel>, action: AppAction.SetConnected): Promise<any> {
        if (action.payload && ctx.getState().readyToConnect) {
            if (this.peerjsService.getIsConnected()) {
                ctx.dispatch(new AppAction.NextPeer());
                return Promise.resolve(true);
            }
            return this.peerjsService.connect()
                .then((peerId) => {

                    const {user_media} = this.store.snapshot();
                    this.peerjsService.localStream = user_media?.localStream;

                    ctx.patchState({connected: true});
                    ctx.dispatch([new AppAction.SetPeerId(peerId), new AppAction.NextPeer()]);

                    this.peerjsService.remotePeerConnected$
                        .pipe(skip(1), takeUntil(this.peerjsService.connected$))
                        .subscribe({
                            next: (remotePeerId) => {
                                if (remotePeerId) {
                                    if (this.peerjsService.dataConnection?.peer) {
                                        ctx.dispatch(new AppAction.SetRemotePeerId(this.peerjsService.dataConnection.peer));
                                    }
                                    if (this.peerjsService.mediaConnection?.remoteStream) {
                                        ctx.dispatch(new AppAction.SetRemoteStream(this.peerjsService.mediaConnection.remoteStream));
                                    }
                                } else {
                                    if (ctx.getState().remotePeerId) {
                                        ctx.dispatch([
                                            new AppAction.SetRemotePeerId(''),
                                            new AppAction.SetRemoteStream(null)
                                        ]);
                                    }
                                    setTimeout(() => {
                                        if (this.peerjsService.getIsConnected()) {
                                            ctx.dispatch(new AppAction.NextPeer());
                                        }
                                    }, this.peerjsService.getReconnectionDelay());
                                }
                                ctx.dispatch([
                                    new AppAction.SetRemotePeerConnected(!!remotePeerId),
                                    new AppAction.MessagesClear()
                                ]);
                            }
                        });

                    this.peerjsService.countryDetected$
                        .pipe(takeUntil(this.peerjsService.connected$))
                        .subscribe({
                            next: (countryCode) => {
                                ctx.dispatch(new AppAction.SetCountryCodeDetected(countryCode.toLowerCase()));
                            }
                        });

                    this.peerjsService.remoteCountryCode$
                        .pipe(takeUntil(this.peerjsService.connected$))
                        .subscribe({
                            next: (countryCode) => {
                                ctx.dispatch(new AppAction.SetRemoteCountryCode(countryCode.toLowerCase()));
                            }
                        });

                    this.peerjsService.messageStream$
                        .pipe(takeUntil(this.peerjsService.connected$))
                        .subscribe({
                            next: (message) => {
                                ctx.dispatch(new AppAction.MessageAdd({
                                    type: TextMessageType.Question,
                                    message
                                }));
                            }
                        });

                })
                .catch((error) => {
                    console.log(error);
                })
        } else {
            this.peerjsService.localStream = undefined;
            this.peerjsService.disconnect(true);
            ctx.dispatch(new AppAction.SetPeerId(''));
            ctx.patchState({connected: false});
            return Promise.resolve(false);
        }
    }

    @Action(AppAction.SetReadyToConnect)
    setReadyToConnect(ctx: StateContext<AppStateModel>, action: AppAction.SetReadyToConnect) {
        ctx.patchState({
            readyToConnect: action.payload
        });
    }

    @Action(AppAction.SetPeerId)
    setPeerId(ctx: StateContext<AppStateModel>, action: AppAction.SetPeerId) {
        ctx.patchState({
            localPeerId: action.payload
        });
    }

    @Action(AppAction.NextPeer)
    nextPeer(ctx: StateContext<AppStateModel>, action: AppAction.NextPeer) {
        this.peerjsService.setReconnectionDelay(action.payload);
        if (ctx.getState().remotePeerId) {
            this.peerjsService.disconnect();
        } else {
            const {countryCode, purpose} = ctx.getState();
            this.peerjsService.requestNextPeer(countryCode, purpose);
        }
    }

    @Action(AppAction.SetRemotePeerId)
    setRemotePeerId(ctx: StateContext<AppStateModel>, action: AppAction.SetRemotePeerId) {
        ctx.patchState({
            remotePeerId: action.payload
        });
    }

    @Action(AppAction.GetRemoteStream)
    getRemoteStream(ctx: StateContext<AppStateModel>, action: AppAction.GetRemoteStream) {
        this.peerjsService.connectToPeer(action.payload);
    }

    @Action(AppAction.SetRemoteStream)
    setRemoteStream(ctx: StateContext<AppStateModel>, action: AppAction.SetRemoteStream) {
        ctx.patchState({
            remoteStream: action.payload
        });
    }

    @Action(AppAction.SetRemotePeerConnected)
    setRemotePeerConnected(ctx: StateContext<AppStateModel>, action: AppAction.SetRemotePeerConnected) {
        ctx.patchState({
            remotePeerConnected: action.payload
        });
    }

    @Action(AppAction.SetRemoteCountryCode)
    setRemoteCountryCode(ctx: StateContext<AppStateModel>, action: AppAction.SetRemoteCountryCode) {
        ctx.patchState({
            remoteCountryCode: action.payload
        });
    }

    @Action(AppAction.MessageSend)
    messageSend(ctx: StateContext<AppStateModel>, action: AppAction.MessageSend) {
        if (!this.peerjsService.dataConnection) {
            return;
        }
        this.peerjsService.sendMessage(action.payload.message);
        ctx.dispatch(new AppAction.MessageAdd(action.payload));
    }

    @Action(AppAction.MessageAdd)
    messageAdd(ctx: StateContext<AppStateModel>, action: AppAction.MessageAdd) {
        const state = ctx.getState();
        ctx.patchState({
            messages: [
                ...state.messages,
                action.payload
            ]
        });
    }

    @Action(AppAction.MessagesClear)
    messagesClear(ctx: StateContext<AppStateModel>, action: AppAction.MessagesClear) {
        ctx.patchState({
            messages: []
        });
    }

    @Action(AppAction.SetCountryCode)
    setCountryCode(ctx: StateContext<AppStateModel>, action: AppAction.SetCountryCode) {
        ctx.patchState({
            countryCode: action.payload
        });
    }

    @Action(AppAction.SetCountryCodeDetected)
    setCountryCodeDetected(ctx: StateContext<AppStateModel>, action: AppAction.SetCountryCodeDetected) {
        ctx.patchState({
            countryCodeDetected: action.payload
        });
    }

    @Action(AppAction.SetPurpose)
    setPurpose(ctx: StateContext<AppStateModel>, action: AppAction.SetPurpose) {
        ctx.patchState({
            purpose: action.payload
        });
    }

    @Action(AppAction.UpdateCountryCode)
    updateCountryCode(ctx: StateContext<AppStateModel>, action: AppAction.UpdateCountryCode) {
        this.peerjsService.sendMessageToServer(ServerMessageType.CountrySet, action.payload);
        ctx.dispatch(new AppAction.SetCountryCode(action.payload));
    }

    @Action(AppAction.UpdatePurpose)
    updatePurpose(ctx: StateContext<AppStateModel>, action: AppAction.UpdatePurpose) {
        this.peerjsService.sendMessageToServer(ServerMessageType.PurposeSet, action.payload);
        ctx.dispatch(new AppAction.SetPurpose(action.payload));
    }
}
