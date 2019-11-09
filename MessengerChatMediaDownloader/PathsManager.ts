import * as path from 'path';
import { Singletons } from './Singletons';
import { SavedThreadManager } from './SavedThreadManager';

export class PathsManager {

    get threadsInfoManager(): SavedThreadManager {
        return Singletons.savedThreadsManager;
    }

    get threadsMainPath(): string {
        return path.join(this.basedir, "threads");
    }

    get threadsMainOutputPath(): string {
        return path.join(this.basedir, "outputs");
    }

    get basedir(): string {
        return process.cwd();
    }

    getPathForThread(threadId: string): string {
        return path.join(this.threadsMainPath, threadId);
    }

    getUrlsPathForThread(threadId: string): string {
        return path.join(this.getPathForThread(threadId), "urls.txt");
    }

    getOutputPathForThread(threadId: string): string {
        let name: string = this.threadsInfoManager.getThreadInfo(threadId).name;
        return path.join(this.threadsMainOutputPath, name);
    }

    getFileProgressPathForThread(threadId: string): string {
        return path.join(this.basedir, threadId, "fileProgresses.json");
    }

    getThreadsInfoFilePath(): string {
        return path.join(this.basedir, "threadsInfo.json");
    }

    getThreadsIdsFilePath(): string {
        return path.join(this.basedir, "threadsIDs.txt");
    }

    getTempUrlFilePath(threadID: string): string {
        return path.join(this.basedir, "temp", threadID + ".json");
    }
}