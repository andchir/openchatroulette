import {TextMessageInterface} from '../../models/textmessage.interface';

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

    export class SetRemoteCountryCode {
        static readonly type = '[App] SetRemoteCountryCode';
        constructor(public payload: string) {}
    }

    export class MessageSend {
        static readonly type = '[App] MessageSend';
        constructor(public payload: TextMessageInterface) {}
    }

    export class MessageAdd {
        static readonly type = '[App] MessageAdd';
        constructor(public payload: TextMessageInterface) {}
    }

    export class MessagesClear {
        static readonly type = '[App] MessagesClear';
    }

    export class SetCountryCode {
        static readonly type = '[App] SetCountryCode';
        constructor(public payload: string) {}
    }

    export class SetPurpose {
        static readonly type = '[App] SetPurpose';
        constructor(public payload: string) {}
    }

    export class UpdateCountryCode {
        static readonly type = '[App] UpdateCountryCode';
        constructor(public payload: string) {}
    }

    export class UpdatePurpose {
        static readonly type = '[App] UpdatePurpose';
        constructor(public payload: string) {}
    }
}
