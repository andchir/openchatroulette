import {Injectable} from '@angular/core';

import {Action, Selector, State, StateContext} from '@ngxs/store';
import {UserMediaAction} from '../actions/user-media.actions';

export class UserMediaStateModel {
    public videoInputDeviceCurrent: string;
    public audioInputDeviceCurrent: string;
    public devices: InputDeviceInfo[];
}

const defaults = {
    videoInputDeviceCurrent: '',
    audioInputDeviceCurrent: '',
    devices: []
};

@State<UserMediaStateModel>({
    name: 'user_media',
    defaults
})
@Injectable()
export class UserMediaState {

    @Selector()
    static audioInputDeviceCurrent(state: UserMediaStateModel) {
        return state.audioInputDeviceCurrent;
    }

    @Selector()
    static videoInputDeviceCurrent(state: UserMediaStateModel) {
        return state.videoInputDeviceCurrent;
    }

    @Selector()
    static devices(state: UserMediaStateModel) {
        return state.devices;
    }

    @Action(UserMediaAction.SetAudioInputDeviceCurrent)
    setAudioInputDeviceCurrent(ctx: StateContext<UserMediaStateModel>, action: UserMediaAction.SetAudioInputDeviceCurrent) {
        ctx.patchState({
            audioInputDeviceCurrent: action.payload
        });
    }

    @Action(UserMediaAction.SetAudioInputDeviceCurrent)
    setVideoInputDeviceCurrent(ctx: StateContext<UserMediaStateModel>, action: UserMediaAction.SetVideoInputDeviceCurrent) {
        ctx.patchState({
            videoInputDeviceCurrent: action.payload
        });
    }

    @Action(UserMediaAction.DevicesUpdate)
    devicesUpdate(ctx: StateContext<UserMediaStateModel>, action: UserMediaAction.DevicesUpdate) {
        ctx.patchState({
            devices: action.payload
        });
    }

    @Action(UserMediaAction.EnumerateDevices)
    enumerateDevices(ctx: StateContext<UserMediaStateModel>, action: UserMediaAction.EnumerateDevices) {
        return navigator.mediaDevices.enumerateDevices()
            .then((devices: MediaDeviceInfo[]) => {
                console.log(devices);
            })
            .catch((e) => {
                console.log('enumerateDevices ERROR');
            });
    }
}
