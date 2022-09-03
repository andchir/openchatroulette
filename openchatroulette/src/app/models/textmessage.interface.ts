export interface TextMessageInterface {
    type: string;
    message: string;
    from?: string;
}

export enum TextMessageType {
    Answer = 'answer',
    Question = 'question'
}
