import {Injectable} from '@angular/core';

import {State, Action, Selector, StateContext} from '@ngxs/store';
import {skip, take, takeUntil} from 'rxjs';

import {AppAction} from '../actions/app.actions';
import {TextMessageInterface} from '../../models/textmessage.interface';
import {PeerjsService} from '../../services/peerjs.service';

export class AppStateModel {
    public connected: boolean;
    public remotePeerConnected: boolean;
    public readyToConnect: boolean;
    public localPeerId: string;
    public remotePeerId: string;
    public localStream: MediaStream|null;
    public remoteStream: MediaStream|null;
    public messages: TextMessageInterface[];
}

const defaults = {
    connected: false,
    remotePeerConnected: false,
    readyToConnect: false,
    localPeerId: '',
    remotePeerId: '',
    localStream: null,
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
    static localStream(state: AppStateModel) {
        return state.localStream;
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

                    this.peerjsService.remotePeerConnected$
                        .pipe(skip(1), takeUntil(this.peerjsService.connected$))
                        .subscribe({
                            next: (remotePeerConnected) => {
                                console.log('remotePeerConnected', remotePeerConnected);
                                ctx.dispatch([
                                    new AppAction.SetRemotePeerConnected(remotePeerConnected),
                                    new AppAction.MessagesClear()
                                ]);
                                if (remotePeerConnected) {
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
                                    this.peerjsService.disconnect();
                                    setTimeout(() => {
                                        if (this.peerjsService.getIsConnected()) {
                                            ctx.dispatch(new AppAction.NextPeer());
                                        }
                                    }, 1);
                                }
                            }
                        });

                    this.peerjsService.messageStream$
                        .pipe(takeUntil(this.peerjsService.connected$))
                        .subscribe({
                            next: (message) => {
                                ctx.dispatch(new AppAction.MessageAdd({
                                    type: 'question',
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

    @Action(AppAction.GetLocalStream)
    getLocalStream(ctx: StateContext<AppStateModel>) {
        this.peerjsService.getUserMedia()
            .then((stream) => {
                ctx.patchState({localStream: stream});
                ctx.dispatch(new AppAction.SetReadyToConnect(true));
            })
            .catch((err) => {
                console.log(err);
                ctx.patchState({localStream: null});
                ctx.dispatch(new AppAction.SetReadyToConnect(false));
            });
    }

    @Action(AppAction.StopLocalStream)
    stopLocalStream(ctx: StateContext<AppStateModel>) {
        const {localStream} = ctx.getState();
        if (localStream) {
            localStream.getTracks().forEach(function(track) {
                track.stop();
            });
        }
        ctx.patchState({localStream: null});
    }

    @Action(AppAction.NextPeer)
    nextPeer(ctx: StateContext<AppStateModel>, action: AppAction.NextPeer) {
        console.log('nextPeer');
        if (ctx.getState().remotePeerId) {
            this.peerjsService.disconnect();
        } else {
            this.peerjsService.requestNextPear();
            // this.peerjsService.nextPeer()
            //     .pipe(take(1))
            //     .subscribe({
            //         next: (result) => {
            //             if (result.peerId) {
            //                 ctx.dispatch(new AppAction.GetRemoteStream(result.peerId));
            //             }
            //         }
            //     });
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
