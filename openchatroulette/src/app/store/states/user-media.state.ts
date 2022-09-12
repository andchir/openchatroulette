import {Injectable} from '@angular/core';

import {Action, Selector, State, StateContext} from '@ngxs/store';
import {UserMediaAction} from '../actions/user-media.actions';

export class UserMediaStateModel {
    public videoInputDeviceCurrent: string;
    public audioInputDeviceCurrent: string;
    public devices: InputDeviceInfo[];
    public localStream: MediaStream|null;
    public remoteStream: MediaStream|null;
}

const defaults = {
    videoInputDeviceCurrent: '',
    audioInputDeviceCurrent: '',
    devices: [],
    localStream: null,
    remoteStream: null
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

    @Selector()
    static localStream(state: UserMediaStateModel) {
        return state.localStream;
    }

    @Selector()
    static remoteStream(state: UserMediaStateModel) {
        return state.remoteStream;
    }

    @Action(UserMediaAction.SetAudioInputDeviceCurrent)
    setAudioInputDeviceCurrent(ctx: StateContext<UserMediaStateModel>, action: UserMediaAction.SetAudioInputDeviceCurrent) {
        ctx.patchState({
            audioInputDeviceCurrent: action.payload
        });
    }

    @Action(UserMediaAction.SetVideoInputDeviceCurrent)
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
    enumerateDevices(ctx: StateContext<UserMediaStateModel>) {
        return navigator.mediaDevices.enumerateDevices()
            .then((devices: MediaDeviceInfo[]) => {
                ctx.dispatch(new UserMediaAction.DevicesUpdate(devices));
            })
            .catch((e) => {
                console.log('enumerateDevices ERROR', e);
            });
    }

    @Action(UserMediaAction.GetLocalStream)
    getLocalStream(ctx: StateContext<UserMediaStateModel>, action: UserMediaAction.GetLocalStream) {
        return navigator.mediaDevices.getUserMedia(action.payload)
            .then((stream) => {
                ctx.dispatch(new UserMediaAction.SetLocalStream(stream));
            })
            .catch((err) => {
                console.log(err);
                ctx.patchState({localStream: null});
            });
    }

    @Action(UserMediaAction.SetLocalStream)
    setLocalStream(ctx: StateContext<UserMediaStateModel>, action: UserMediaAction.SetLocalStream) {
        ctx.patchState({localStream: action.payload});
        if (action.payload) {
            action.payload.getTracks().forEach((track) => {
                if (track.kind === 'audio') {
                    ctx.dispatch(new UserMediaAction.SetAudioInputDeviceCurrent(track.getSettings().deviceId || ''));
                } else {
                    ctx.dispatch(new UserMediaAction.SetVideoInputDeviceCurrent(track.getSettings().deviceId || ''));
                }
            });
        }
    }

    @Action(UserMediaAction.StopLocalStream)
    stopLocalStream(ctx: StateContext<UserMediaStateModel>) {
        const {localStream} = ctx.getState();
        if (localStream) {
            localStream.getTracks().forEach(function(track) {
                track.stop();
            });
        }
        ctx.patchState({localStream: null});
    }
}
