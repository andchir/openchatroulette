import {Injectable} from '@angular/core';
import {State, Action, Selector, StateContext} from '@ngxs/store';
import {AppAction} from '../actions/app.actions';
import {TextMessageInterface} from '../../models/textmessage.interface';
import {PeerjsService} from '../../services/peerjs.service';

export class AppStateModel {
    public connected: boolean;
    public ready: boolean;
    public localPeerId: string;
    public localStream: MediaStream|null;
    public messages: TextMessageInterface[];
}

const defaults = {
    connected: false,
    ready: false,
    localPeerId: '',
    localStream: null,
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

    @Action(AppAction.SetConnected)
    setConnected(ctx: StateContext<AppStateModel>, action: AppAction.SetConnected) {
        if (action.payload) {
            this.peerjsService.connect()
                .then((peerId) => {
                    ctx.patchState({connected: true});
                    return ctx.dispatch(new AppAction.SetPeerId(peerId));
                })
                .catch((error) => {
                    console.log(error);
                })
        } else {
            // TODO: disconnect peer server
            ctx.patchState({
                connected: false
            });
        }
        console.log('setConnected', action.payload, ctx.getState());
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
    getLocalStream(ctx: StateContext<AppStateModel>, action: AppAction.GetLocalStream) {
        this.peerjsService.getUserMedia()
            .then((stream) => {
                ctx.patchState({localStream: stream});
                return ctx.dispatch(new AppAction.SetReady(ctx.getState().connected));
            })
            .catch((err) => {
                ctx.patchState({localStream: null});
                return ctx.dispatch(new AppAction.SetReady(false));
            });
    }

    @Action(AppAction.StopLocalStream)
    stopLocalStream(ctx: StateContext<AppStateModel>, action: AppAction.StopLocalStream) {

        // stream.getTracks().forEach(function(track) {
        //     track.stop();
        // });
    }
}
