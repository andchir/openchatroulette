import {Injectable} from '@angular/core';
import {State, Action, Selector, StateContext} from '@ngxs/store';
import {AppAction} from '../actions/app.actions';
import {TextMessageInterface} from '../../models/textmessage.interface';
import {PeerjsService} from '../../services/peerjs.service';
import {Observable, take} from "rxjs";

export class AppStateModel {
    public connected: boolean;
    public ready: boolean;
    public localPeerId: string;
    public localStream: MediaStream|null;
    public remoteStream: MediaStream|null;
    public messages: TextMessageInterface[];
}

const defaults = {
    connected: false,
    ready: false,
    localPeerId: '',
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
    static ready(state: AppStateModel) {
        return state.ready;
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
    setConnected(ctx: StateContext<AppStateModel>, action: AppAction.SetConnected) {
        if (action.payload) {
            this.peerjsService.connect()
                .then((peerId) => {
                    ctx.patchState({connected: true});
                    this.peerjsService.disconnected$
                        .pipe(take(1))
                        .subscribe({
                            next: (peerId) => {
                                ctx.dispatch(new AppAction.SetConnected(false));
                            }
                        });
                    return ctx.dispatch(new AppAction.SetPeerId(peerId));
                })
                .catch((error) => {
                    console.log(error);
                })
        } else {
            ctx.patchState({
                connected: false
            });
            ctx.dispatch(new AppAction.SetPeerId(''));
            ctx.dispatch(new AppAction.StopLocalStream());
            ctx.dispatch(new AppAction.SetReady(false));
        }
    }

    @Action(AppAction.SetReady)
    setReady(ctx: StateContext<AppStateModel>, action: AppAction.SetReady) {
        ctx.patchState({
            ready: action.payload
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
                ctx.dispatch(new AppAction.SetReady(ctx.getState().connected));
            })
            .catch((err) => {
                ctx.patchState({localStream: null});
                ctx.dispatch(new AppAction.SetReady(false));
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
    nextPeer(ctx: StateContext<AppStateModel>): void {
        this.peerjsService.nextPeer()
            .subscribe({
                next: (res) => {
                    if (res.peerId) {
                        ctx.dispatch(new AppAction.GetRemoteStream(res.peerId));
                    }
                }
            });
    }

    @Action(AppAction.GetRemoteStream)
    getRemoteStream(ctx: StateContext<AppStateModel>, action: AppAction.GetRemoteStream) {
        this.peerjsService.connectToPeer(action.payload)
            .then((res) => {
                ctx.dispatch(new AppAction.SetRemoteStream(res));
            })
            .catch((err) => {
                ctx.patchState({remoteStream: null});
            });
    }

    @Action(AppAction.SetRemoteStream)
    setRemoteStream(ctx: StateContext<AppStateModel>, action: AppAction.SetRemoteStream) {
        ctx.patchState({
            remoteStream: action.payload
        });
    }
}
