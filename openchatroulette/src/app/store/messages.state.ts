import {Injectable} from '@angular/core';
import {Action, State, StateContext} from '@ngxs/store';

import {AddMessage} from './app.actions';

export interface Message {
    from: string;
    message: string;
}

@State<Message[]>({
    name: 'messages',
    defaults: []
})
@Injectable()
export class MessagesState {
    @Action(AddMessage)
    addMessage(ctx: StateContext<Message[]>, {from, message}: AddMessage) {
        const state = ctx.getState();
        // omit `type` property that server socket sends
        console.log('Received message', from, message);
        ctx.setState([...state, {from, message}]);
    }
}
