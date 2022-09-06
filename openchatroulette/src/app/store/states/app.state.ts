import {Injectable} from '@angular/core';
import {State, Action, Selector, StateContext} from '@ngxs/store';
import {Observable, take, takeUntil, tap} from 'rxjs';
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
    static localStream(state: AppStateModel) {
        return state.localStream;
    }

    @Selector()
    static remoteStream(state: AppStateModel) {
        return state.remoteStream;
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
                    ctx.dispatch(new AppAction.SetPeerId(peerId));
                    ctx.dispatch(new AppAction.NextPeer());

                    // this.peerjsService.callFromPeer$
                    //     .pipe(takeUntil(this.peerjsService.connected$))
                    //     .subscribe({
                    //         next: (remotePeerId) => {
                    //             if (ctx.getState().connected && ctx.getState().remotePeerId) {
                    //                 this.peerjsService.callAnswer(ctx.getState().remotePeerId);
                    //             }
                    //         }
                    //     });
                    //
                    // this.peerjsService.remotePeerConnected$
                    //     .pipe(takeUntil(this.peerjsService.connected$))
                    //     .subscribe({
                    //         next: (remotePeerId) => {
                    //             if (remotePeerId) {
                    //                 ctx.dispatch(new AppAction.SetRemotePeerId(remotePeerId));
                    //                 if (this.peerjsService.mediaConnection?.remoteStream) {
                    //                     ctx.dispatch(new AppAction.SetRemoteStream(this.peerjsService.mediaConnection?.remoteStream));
                    //                 }
                    //             } else {
                    //                 ctx.dispatch(new AppAction.SetRemotePeerId(''));
                    //                 ctx.dispatch(new AppAction.SetRemoteStream(null));
                    //             }
                    //         }
                    //     });

                })
                .catch((error) => {
                    console.log(error);
                })
        } else {
            this.peerjsService.disconnect(true);
            ctx.patchState({connected: false});
            ctx.dispatch(new AppAction.SetPeerId(''));
            // ctx.dispatch(new AppAction.SetRemotePeerId(''));
            return Promise.reject();
        }
    }

    @Action(AppAction.SetReadyToConnect)
    setReadyToConnect(ctx: StateContext<AppStateModel>, action: AppAction.SetReadyToConnect) {
        ctx.patchState({
            readyToConnect: action.payload
        });
        // if (!action.payload) {
        //     this.peerjsService.disconnect();
        // }
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
    nextPeer(ctx: StateContext<AppStateModel>, action: AppAction.NextPeer): Observable<any> {
        ctx.dispatch(new AppAction.SetRemoteStream(null));
        return this.peerjsService.nextPeer()
            .pipe(tap(result => {
                if (result.peerId) {
                    ctx.dispatch(new AppAction.SetRemotePeerId(result.peerId));
                } else if (this.peerjsService.getIsConnected()) {
                    setTimeout(() => {
                        ctx.dispatch(new AppAction.NextPeer());
                    }, 4000);
                }
            }));
    }

    @Action(AppAction.SetRemotePeerId)
    setRemotePeerId(ctx: StateContext<AppStateModel>, action: AppAction.SetRemotePeerId) {
        ctx.patchState({
            remotePeerId: action.payload
        });
        ctx.dispatch(new AppAction.GetRemoteStream(action.payload));
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
}
