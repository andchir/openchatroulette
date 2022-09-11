
export namespace UserMediaAction {

    export class DevicesUpdate {
        static readonly type = '[UserMedia] DevicesUpdate';
        constructor(public payload: InputDeviceInfo[]) {}
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
}
