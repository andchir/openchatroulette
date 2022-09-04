export namespace AppAction {

    export class SetConnected {
        static readonly type = '[App] SetConnected';
        constructor(public payload: boolean) {}
    }

    export class SetReady {
        static readonly type = '[App] SetReady';
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
}
