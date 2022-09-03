export class AppAction {
    static readonly type = '[App] Add item';
    constructor(public payload: string) {
    }
}

export class AddMessage {
    static type = '[Chat] Add message';
    constructor(public from: string, public message: string) {}
}
