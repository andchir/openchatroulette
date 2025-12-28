
export namespace UserMediaAction {

    export class DevicesUpdate {
        static readonly type = '[UserMedia] DevicesUpdate';
        constructor(public payload: MediaDeviceInfo[]) {}
    }

    export class SetVideoInputDeviceCurrent {
        static readonly type = '[UserMedia] SetVideoInputDeviceCurrent';
        constructor(public payload: string) {}
    }

    export class SetAudioInputDeviceCurrent {
        static readonly type = '[UserMedia] SetAudioInputDeviceCurrent';
        constructor(public payload: string) {}
    }

    export class EnumerateDevices {
        static readonly type = '[UserMedia] EnumerateDevices';
    }

    export class GetLocalStream {
        static readonly type = '[UserMedia] GetLocalStream';
        constructor(public payload: MediaStreamConstraints) {}
    }

    export class SetLocalStream {
        static readonly type = '[UserMedia] SetLocalStream';
        constructor(public payload: MediaStream|null) {}
    }

    export class StopLocalStream {
        static readonly type = '[UserMedia] StopLocalStream';
    }

    export class GetRemoteStream {
        static readonly type = '[UserMedia] GetRemoteStream';
    }

    export class SetRemoteStream {
        static readonly type = '[UserMedia] SetRemoteStream';
        constructor(public payload: MediaStream|null) {}
    }

    export class SwitchMediaInput {
        static readonly type = '[UserMedia] SwitchMediaSource';
        constructor(public payload: {kind: string; deviceId: string;}) {}
    }
}
