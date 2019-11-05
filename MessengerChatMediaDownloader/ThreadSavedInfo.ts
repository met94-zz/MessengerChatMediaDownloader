import * as fse from 'fs-extra';
import * as path from 'path';

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

export class SavedThreadManager {

    threadsInfoPath: string = path.join(__dirname, "threadsInfo.json");
    threadsInfo: { [threadId: string]: ThreadSavedInfo } = {};

    constructor() {
        this.threadsInfo = this.readThreadsInfo();
    }

    private saveThreadsInfo() {
        fse.outputJsonSync(this.threadsInfoPath, this.threadsInfo);
    }

    private readThreadsInfo(): { [threadId: string]: ThreadSavedInfo } {
        let threadsInfo: { [threadId: string]: ThreadSavedInfo } = {};
        try {
            threadsInfo = fse.readJsonSync(this.threadsInfoPath);
        } catch (error) { }
        return threadsInfo;
    }

    getThreadInfo(threadId: string): ThreadSavedInfo {
        return this.threadsInfo[threadId] || new ThreadSavedInfo();
    }

    saveThreadInfo(threadId: string, threadInfo: ThreadSavedInfo) {
        this.threadsInfo[threadId] = threadInfo;
        this.saveThreadsInfo();
    }
}
