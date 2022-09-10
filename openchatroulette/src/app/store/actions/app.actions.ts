export namespace AppAction {

    export class SetConnected {
        static readonly type = '[App] SetConnected';
        constructor(public payload: boolean) {}
    }

    export class SetReadyToConnect {
        static readonly type = '[App] SetReadyToConnect';
        constructor(public payload: boolean) {}
    }

    export class SetPeerId {
        static readonly type = '[App] SetPeerId';
        constructor(public payload: string) {}
    }

    export class GetLocalStream {
        static readonly type = '[App] GetLocalStream';
    }

    export class StopLocalStream {
        static readonly type = '[App] StopLocalStream';
    }

    export class NextPeer {
        static readonly type = '[App] NextPeer';
    }

    export class GetRemoteStream {
        static readonly type = '[App] GetRemoteStream';
        constructor(public payload: string) {}
    }

    export class SetRemotePeerId {
        static readonly type = '[App] SetRemotePeerId';
        constructor(public payload: string) {}
    }

    export class SetRemoteStream {
        static readonly type = '[App] SetRemoteStream';
        constructor(public payload: MediaStream|null) {}
    }

    export class SetRemotePeerConnected {
        static readonly type = '[App] SetRemotePeerConnected';
        constructor(public payload: boolean) {}
    }
}
