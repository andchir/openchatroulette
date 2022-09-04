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
        console.log('setPeerId', action.payload, ctx.getState());
    }
}
