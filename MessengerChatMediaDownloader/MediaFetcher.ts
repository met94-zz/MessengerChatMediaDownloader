import * as fse from 'fs-extra';
import * as delay from 'delay';
import * as random from 'random';
import { Config } from './Config';
import { PathsManager } from './PathsManager';
import { Singletons } from './Singletons';
import { ThreadSavedInfo } from './ThreadSavedInfo';
import { SavedThreadManager } from './SavedThreadManager';

class MediaFetcherError extends Error {

}

export class MediaFetcher {
    readonly MaxErrors = 3;
    readonly postsToReadAtOnceMin = 900;
    readonly postsToReadAtOnceMax = 1000;
    readonly threadsToReadAtOnce = 30;
    readonly emptyMessagesBeforeSkipping = 3;
    facebookApi: any;
    errorsCount: number;

    get threadsInfoManager(): SavedThreadManager {
        return Singletons.savedThreadsManager;
    }

    get pathsManager(): PathsManager {
        return Singletons.pathsManager;
    }

    constructor(api: any) {
        this.facebookApi = api;
        this.errorsCount = 0;
    }

    async saveAll() {
        let previousThreadTimestamp: number;
        let threadTimestamp: number;
        do {
            try {
                console.log("Getting thread info...");
                previousThreadTimestamp = threadTimestamp;
                let threadsInfo = await this.getNextThreads(this.threadsToReadAtOnce, threadTimestamp);
                if (threadsInfo && threadsInfo.length > 0) {
                    for (let threadInfo of threadsInfo) {
                        if (threadInfo != null) {
                            threadTimestamp = Number(threadInfo.timestamp);
                            let name = await this.getThreadName(threadInfo);
                            console.log("Thread name: " + name + ", message count: " + threadInfo.messageCount);

                            let urls = await this.getUrlsForThread(threadInfo, name);
                            await this.saveUrlsToDisk(threadInfo.threadID, urls);
                        }
                    }
                }
                else {
                    break;
                }
                await delay(random.int(1000, 5000));
            } catch (error) {
                if (error instanceof MediaFetcherError) {
                    Config.logError(error.message);
                    console.log("Could not get the whole conversation, skipping...");
                    this.errorsCount++;

                    //uncomment to retry with the current thread
                    //threadTimestamp = previousThreadTimestamp;
                }
                else {
                    Config.logError(error);
                    Config.logError("Retrying...")
                }
                this.onError();
            }
        } while (1);
        console.log("saveAll Finished");
    }

    async saveUrlsForThread(threadId: string) {
        do {
            try {
                console.log("Getting thread info...");
                let threadInfo = await this.getThreadInfo(threadId);
                if (threadInfo) {
                    let name = await this.getThreadName(threadInfo);
                    console.log("Thread name: " + name + ", message count: " + threadInfo.messageCount);

                    let urls: string[] = await this.getUrlsForThread(threadInfo, name);

                    await this.saveUrlsToDisk(threadId, urls);
                } else {
                    throw new MediaFetcherError("Failed to query thread info");
                }
                break;
            } catch (error) {
                if (error instanceof MediaFetcherError) {
                    Config.logError(error.message);
                    Config.logError("Failed to get urls");
                } else {
                    Config.logError(error);
                    Config.logError("Retrying...")
                }
                throw error;
            }
        } while (1);
        console.log("saveUrlsForThread Finished");
    }


    /**
     * Get urls for a given thread.
     * @param threadInfo
     * @returns 
     */
    async getUrlsForThread(threadInfo: any, name: string): Promise<string[]> {
        let threadId: string = threadInfo.threadID;
        let threadProgress: ThreadSavedInfo = this.threadsInfoManager.getThreadInfo(threadId);
        let messageTimestamp: number = threadProgress.lastTimestamp;
        let readMessages: number = threadProgress.messagesRead;
        let messageCount: number = threadProgress.messageCount ? threadProgress.messageCount : threadInfo.messageCount;
        let urls: string[] = this.readTempSavedUrls(threadId);
        let history: any[] = [];
        let emptyHistoryCounter: number = 0;
        let percentReadNotify = 10;

        if (threadProgress.completed) {
            return urls;
        }

        const saveProgress = () => {
            //Do not save the progress when no messages read as we do not have timestamp and that will fuck up messageCount if there come new messages meanwhile
            if (readMessages > 0) {
                this.threadsInfoManager.saveThreadInfo(threadId, new ThreadSavedInfo(messageTimestamp, name || threadId, readMessages, readMessages >= messageCount, messageCount));
                this.saveTempSavedUrls(threadId, urls);
            }
        }

        const calculateProgress = () => Math.floor((readMessages / messageCount) * 100);
        const printProgress = (percent: number) => console.log("Read " + percent + "% messages");

        printProgress(calculateProgress());

        while (readMessages < messageCount) {
            try {
                history = await this.fetchThreadHistory(threadId, messageTimestamp);
                if (history.length > 0) {
                    readMessages += history.length;
                    let percent = calculateProgress();
                    if (percent > percentReadNotify) {
                        printProgress(percent);
                        percentReadNotify = 10 + percent;
                    }
                    messageTimestamp = Number(history[0].timestamp);
                    history.forEach(msg => urls = urls.concat(this.getUrlsFromMessage(msg)));
                }
                else {
                    emptyHistoryCounter++;
                    if (emptyHistoryCounter >= this.emptyMessagesBeforeSkipping) {
                        saveProgress();
                        throw new MediaFetcherError("API calls limit reached");
                    }
                }
            } catch (error) {
                if (error instanceof MediaFetcherError) {
                    //Internal error, rethrow
                    throw error;
                } else {
                    Config.logError(error);
                    Config.logError("Retrying...")
                }
                this.onError();
            }
        }
        saveProgress();
        return urls;
    }

    getUrlsFromMessage(msg): string[] {
        let urls: string[] = [];
        if (msg.type == "message") {
            if (msg.attachments.length > 0) {
                msg.attachments.forEach(attachment => {
                    let url = null;
                    if (attachment.type == "photo") {
                        url = attachment.largePreviewUrl;
                    }
                    else if (attachment.type == "audio" || attachment.type == "video") {
                        url = attachment.url;
                    }
                    if (url != null) {
                        urls.push(url);
                    }
                });
            }
        }
        return urls;
    }

    async saveThreadsList() {
        let threadsList: any[] = [];
        let threadTimestamp: number;
        do {
            try {
                let fetched = await this.getNextThreads(this.threadsToReadAtOnce, threadTimestamp);
                if (fetched.length > 0) {
                    threadTimestamp = Number(fetched[fetched.length - 1].timestamp);
                    threadsList = threadsList.concat(fetched);
                }
                else {
                    break;
                }
            } catch (error) {
                Config.logError(error);
                Config.logError("Retrying...")
                this.onError();
            }
        } while (1);
        const threadToString = thread => "Name: " + thread.name + ", message count: " + thread.messageCount + ", threadID: " + thread.threadID;
        threadsList.sort((a, b) => b.messageCount - a.messageCount);

        if (threadsList.length > 0) {
            let filePath: string = this.pathsManager.getThreadsIdsFilePath();
            let writeStream = fse.createWriteStream(filePath);
            writeStream.on('error', function (err) { Config.logError("IO ERROR: " + err); });
            threadsList.forEach(thread => writeStream.write(threadToString(thread) + '\n', 'utf8'));
            writeStream.end();
            console.log("Saved results to " + filePath);
        }
    }

    //#region Utilities

    onError() {
        this.errorsCount++;
        if (this.errorsCount >= this.MaxErrors) {
            throw Error("Exiting due too many errors");
        }
    }

    async getThreadName(threadInfo: any): Promise<string> {
        let name: string = threadInfo.name;
        if (name == null) {
            name = "";
            let users: any[] = await this.getUserInfo(threadInfo.participantIDs);
            users.forEach(user => name += user.name + "_");
            if (name.length > 1) {
                name = name.substring(0, name.length - 1);
            }
        }
        return name;
    }

    readTempSavedUrls(threadID: string): string[] {
        let filePath: string = this.pathsManager.getTempUrlFilePath(threadID);
        let urls: string[] = [];
        try {
            urls = fse.readJsonSync(filePath);
        } catch (error) { }
        return urls;
    }

    saveTempSavedUrls(threadID: string, urls: string[]) {
        let filePath: string = this.pathsManager.getTempUrlFilePath(threadID);
        try {
            fse.outputJsonSync(filePath, urls);
        } catch (error) { }
    }

    async saveUrlsToDisk(threadId: string, urls: string[]) {
        if (urls.length > 0) {
            //remove duplicates
            var uniqUrls = [...new Set(urls)];

            let urlsPath: string = this.pathsManager.getUrlsPathForThread(threadId);

            await fse.ensureFile(urlsPath);
            let writeStream = fse.createWriteStream(urlsPath);
            writeStream.on('error', function (err) { Config.logError("IO ERROR: " + err); });
            uniqUrls.forEach(url => writeStream.write(url + '\n', 'utf8'));
            var awaitableStreamEnd = new Promise((resolve, reject) => {
                writeStream.end(resolve);
            });
            await awaitableStreamEnd;
            console.log("Urls saved to " + urlsPath);
        }
    }

    //#endregion

    //#region Facebook API promisify

    async getUserInfo(userIds: number[]): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.facebookApi.getUserInfo(userIds, (err, data) => {
                if (err) {
                    Config.logError(err);
                    reject(Error("Failed to get thread info"));
                    return;
                }

                let result: any[] = [];
                for (var prop in data) {
                    if (data.hasOwnProperty(prop)) {
                        result.push(data[prop]);
                    }
                }
                resolve(result);
            });
        });
    }

    async fetchThreadHistory(threadID: string, messageTimestamp: number): Promise<any[]> {
        //delay so we do not reach api calls limit that fast
        await delay(random.int(300, 500));
        return new Promise((resolve, reject) => {
            this.facebookApi.getThreadHistory(threadID, random.int(this.postsToReadAtOnceMin, this.postsToReadAtOnceMax), messageTimestamp, (err, history) => {
                if (err) {
                    Config.logError(err);
                    reject(Error("Failed to get thread history"));
                    return;
                }

                // if the timestamp is not null then the first message on the list is the one we got the last time
                if (messageTimestamp != null) {
                    if (history == null) {
                        history = null;
                    }
                    history.pop()
                };
                resolve(history);
            });
        });
    }

    async getNextThreads(amount: number, threadTimestamp: number): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.facebookApi.getThreadList(amount, threadTimestamp || null, [], (err, list) => {
                if (err) {
                    Config.logError(err);
                    reject(Error("Error getting threads"));
                    return;
                }

                // if the timestamp is not null then the first thread on the list is the one we got the last time
                if (threadTimestamp != null) {
                    list.pop();
                }
                resolve(list);
            });
        });

    }

    async getThreadInfo(threadID: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.facebookApi.getThreadInfo(threadID, (err, info) => {
                if (err) {
                    Config.logError(err);
                    reject(Error("Failed to get thread info"));
                    return;
                }

                resolve(info);
            });
        });
    }
    //#endregion
}