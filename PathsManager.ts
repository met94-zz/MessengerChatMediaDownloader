import * as path from 'path';
import { SavedThreadManager } from './ThreadSavedInfo';
import { Singletons } from './Singletons';

export class PathsManager {
    threadsMainPath: string = path.join(__dirname, "threads");
    threadsMainOutputPath: string = path.join(__dirname, "outputs");
    get threadsInfoManager(): SavedThreadManager {
        return Singletons.savedThreadsManager;
    }

    getPathForThread(threadId: string): string {
        //let name: string = this.threadsInfoManager.getThreadInfo(threadId).name;
        return path.join(this.threadsMainPath, threadId);//name);
    }

    getUrlsPathForThread(threadId: string): string {
        return path.join(this.getPathForThread(threadId), "urls.txt");
    }

    getOutputPathForThread(threadId: string): string {
        let name: string = this.threadsInfoManager.getThreadInfo(threadId).name;
        return path.join(this.threadsMainOutputPath, name);
    }

    getFileProgressPathForThread(threadId: string): string {
        return path.join(__dirname, threadId, "fileProgresses.json");
    }
}