import * as fse from 'fs-extra';
import { PathsManager } from './PathsManager';
import { ThreadSavedInfo } from './ThreadSavedInfo';

export class SavedThreadManager {
    threadsInfo: { [threadId: string]: ThreadSavedInfo } = {};

    pathsManager: PathsManager;

    get threadsInfoPath(): string {
        return this.pathsManager.getThreadsInfoFilePath();
    }

    constructor(pathsManager: PathsManager) {
        this.pathsManager = pathsManager;
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
