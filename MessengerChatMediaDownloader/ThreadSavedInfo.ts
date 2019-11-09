export class ThreadSavedInfo {
    messagesRead: number = 0;
    //timestamp of the most recent message
    lastTimestamp: number;
    //needed in case new messages come between get history calls
    messageCount: number = 0;
    name: string;
    completed: boolean = false;

    constructor(lastTimestamp: number = null, name: string = null, messagesRead: number = 0, completed: boolean = false, messageCount: number = 0) {
        this.lastTimestamp = lastTimestamp;
        this.name = name;
        this.messagesRead = messagesRead;
        this.completed = completed;
        this.messageCount = messageCount;
    }
}