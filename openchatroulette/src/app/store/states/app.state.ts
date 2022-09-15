import {Injectable} from '@angular/core';

import {State, Action, Selector, StateContext} from '@ngxs/store';
import {skip, takeUntil} from 'rxjs';

import {AppAction} from '../actions/app.actions';
import {TextMessageInterface, TextMessageType} from '../../models/textmessage.interface';
import {PeerjsService} from '../../services/peerjs.service';

export class AppStateModel {
    public connected: boolean;
    public remotePeerConnected: boolean;
    public readyToConnect: boolean;
    public localPeerId: string;
    public remotePeerId: string;
    public remoteStream: MediaStream|null;
    public messages: TextMessageInterface[];
}

const defaults = {
    connected: false,
    remotePeerConnected: false,
    readyToConnect: false,
    localPeerId: '',
    remotePeerId: '',
    remoteStream: null,
    messages: []
};

@State<AppStateModel>({
    name: 'app',
    defaults
})
@Injectable()
export class AppState {

    constructor(private peerjsService: PeerjsService) {}

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
    static messages(state: AppStateModel) {
        return state.messages;
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

                    ctx.patchState({connected: true});
                    ctx.dispatch([new AppAction.SetPeerId(peerId), new AppAction.NextPeer()]);

                    this.peerjsService.dataConnectionCreated$
                        .pipe(skip(1), takeUntil(this.peerjsService.connected$))
                        .subscribe({
                            next: (v) => {
                                console.log('dataConnectionCreated', v);
                            }
                        });

                    this.peerjsService.mediaConnectionCreated$
                        .pipe(skip(1), takeUntil(this.peerjsService.connected$))
                        .subscribe({
                            next: (v) => {
                                console.log('mediaConnectionCreated', v);
                                ctx.dispatch(new AppAction.SetRemoteStream(this.peerjsService.mediaConnection?.remoteStream || null));
                            }
                        });

                    // this.peerjsService.remotePeerConnected$
                    //     .pipe(skip(1), takeUntil(this.peerjsService.connected$))
                    //     .subscribe({
                    //         next: (remotePeerId) => {
                    //             ctx.dispatch([
                    //                 new AppAction.SetRemotePeerConnected(!!remotePeerId),
                    //                 new AppAction.MessagesClear()
                    //             ]);
                    //             console.log('remotePeerConnected$', remotePeerId);
                    //             if (remotePeerId) {
                    //                 if (this.peerjsService.dataConnection?.peer) {
                    //                     ctx.dispatch(new AppAction.SetRemotePeerId(this.peerjsService.dataConnection.peer));
                    //                 }
                    //                 if (this.peerjsService.mediaConnection?.remoteStream) {
                    //                     ctx.dispatch(new AppAction.SetRemoteStream(this.peerjsService.mediaConnection.remoteStream));
                    //                 }
                    //             } else {
                    //                 if (ctx.getState().remotePeerId) {
                    //                     ctx.dispatch([
                    //                         new AppAction.SetRemotePeerId(''),
                    //                         new AppAction.SetRemoteStream(null)
                    //                     ]);
                    //                 }
                    //                 this.peerjsService.disconnect();
                    //                 setTimeout(() => {
                    //                     if (this.peerjsService.getIsConnected()) {
                    //                         ctx.dispatch(new AppAction.NextPeer());
                    //                     }
                    //                 }, 1);
                    //             }
                    //         }
                    //     });

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
            this.peerjsService.disconnect(true);
            ctx.patchState({connected: false});
            ctx.dispatch(new AppAction.SetPeerId(''));
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
        if (ctx.getState().remotePeerId) {
            this.peerjsService.disconnect();
        } else {
            this.peerjsService.requestNextPear();
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
        this.peerjsService.connectToPeer(action.payload)
            .catch((err) => {
                console.log(err);
            });
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
}
