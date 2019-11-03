import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as delay from 'delay';
import * as random from 'random';
import * as path from 'path';

class MediaFetcherError extends Error {

}

class ThreadProgress {
    messagesRead: number = 0;
    lastTimestamp: number;
}

export class MediaFetcher {
    /**
     * Maximum errors when quering all threads
     */
    readonly MaxErrorsAll = 100;
    /**
     * Maximum errors when not quering all threads
     */
    readonly MaxErrors = 15;
    readonly postsToReadAtOnceMin = 900;
    readonly postsToReadAtOnceMax = 1000;
    readonly threadsToReadAtOnce = 30;
    readonly emptyMessagesBeforeSkipping = 10;
    facebookApi: any;
    errorsCount: number;
    queringAllThread: boolean = false;

    threadsProgressesPath: string = path.join(__dirname, "threadsProgresses.json");
    threadProgresses: { [threadId: string]: ThreadProgress } = {};

    constructor(api: any) {
        this.facebookApi = api;
        this.errorsCount = 0;
        try {
            this.threadProgresses = JSON.parse(fs.readFileSync(this.threadsProgressesPath, 'utf8'));
        } catch (error) { }
    }

    saveProgress() {
        fs.writeFileSync(this.threadsProgressesPath, JSON.stringify(this.threadProgresses));
    }

    onError(error) {
        console.error(error);
        console.error("Retrying...")
        this.errorsCount++;
        let maximumErrors: number = this.queringAllThread ? this.MaxErrorsAll : this.MaxErrors;
        if (this.errorsCount >= maximumErrors) {
            throw Error("Exiting due too many errors");
        }
    }

    async saveAll() {
        this.queringAllThread = true;
        let previousThreadTimestamp: number;
        let threadTimestamp: number;
        do {
            try {
                console.log("Getting thread info...");
                previousThreadTimestamp = threadTimestamp;
                let threadInfo = (await this.getNextThreads(2, threadTimestamp))[0];
                if (threadInfo != null) {
                    threadTimestamp = threadInfo.timestamp;
                    let name = await this.getThreadName(threadInfo);
                    console.log("Thread name: " + name + ", message count: " + threadInfo.messageCount);

                    let urls = await this.getUrlsForThread(threadInfo);
                    let urlsPath = path.join(__dirname, threadInfo.threadID, 'urls.txt');
                    await this.saveUrlsToDisk(urlsPath, urls);
                    console.log("Urls saved to " + urlsPath);
                }
                else {
                    break;
                }
            } catch (error) {
                if (error instanceof MediaFetcherError) {
                    console.error(error.message);
                    console.log("Could not get the whole conversation, skipping...");
                    this.errorsCount++;

                    //uncomment to retry with the current thread
                    //threadTimestamp = previousThreadTimestamp;
                }
                else {
                    this.onError(error);
                }
            }
        } while (1);
        console.log("saveAll Finished");
    }

    async saveUrlsForThread(threadId: string) {
        this.queringAllThread = false;
        let urls: string[] = [];
        do {
            try {
                console.log("Getting thread info...");
                let threadInfo = await this.getThreadInfo(threadId);
                if (threadInfo) {
                    let name = await this.getThreadName(threadInfo);
                    console.log("Thread name: " + name + ", message count: " + threadInfo.messageCount);
                    let urls: string[] = await this.getUrlsForThread(threadInfo);
                    let urlsPath = path.join(__dirname, threadInfo.threadID, 'urls.txt');
                    await this.saveUrlsToDisk(urlsPath, urls);
                    console.log("Urls saved to " + urlsPath);
                } else {
                    throw new MediaFetcherError("Failed to query thread info");
                }
                break;
            } catch (error) {
                if (error instanceof MediaFetcherError) {
                    console.error(error.message);
                    console.error("Failed to get urls, exiting...");
                    break;
                } else {
                    this.onError(error);
                }
            }
        } while (1);
        console.log("saveUrlsForThread Finished");
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

    /**
     * Get urls for a given thread.
     * @param threadInfo
     * @returns 
     */
    async getUrlsForThread(threadInfo: any): Promise<string[]> {
        let threadProgress: ThreadProgress = this.threadProgresses[threadInfo.threadID] || new ThreadProgress();
        let messageTimestamp: number = threadProgress.lastTimestamp;
        let history: any[] = [];
        let urls: string[] = [];
        let readMessages: number = threadProgress.messagesRead;
        let emptyHistoryCounter: number = 0;
        let percentReadNotify = 10;
        do {
            try {
                history = await this.fetchThreadHistory(threadInfo.threadID, messageTimestamp);
                if (history.length > 0) {
                    readMessages += history.length;
                    let percent = Math.floor((readMessages / threadInfo.messageCount) * 100);
                    if (percent > percentReadNotify) {
                        console.log("Read " + percent + "% messages");
                        percentReadNotify = 10 + percent;
                    }
                    messageTimestamp = Number(history[0].timestamp);
                    history.forEach(msg => urls = urls.concat(this.getUrlsFromMessage(msg)));
                }
                else {
                    emptyHistoryCounter++;
                    if (emptyHistoryCounter >= this.emptyMessagesBeforeSkipping) {
                        threadProgress.lastTimestamp = messageTimestamp;
                        threadProgress.messagesRead = readMessages;
                        this.threadProgresses[threadInfo.threadID] = threadProgress;
                        this.saveProgress();
                        throw new MediaFetcherError("API calls limit reached");
                    }
                }
            } catch (error) {
                if (error instanceof MediaFetcherError) {
                    //Internal error, rethrow
                    throw error;
                } else {
                    this.onError(error);
                }
            }
        } while (readMessages < threadInfo.messageCount);
        return urls;
    }

    async getNextThreads(amount: number, threadTimestamp: number): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.facebookApi.getThreadList(amount, threadTimestamp || null, [], (err, list) => {
                if (err) {
                    console.error(err);
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
                    console.error(err);
                    reject(Error("Failed to get thread info"));
                    return;
                }

                resolve(info);
            });
        });
    }

    async getUserInfo(userIds: number[]): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.facebookApi.getUserInfo(userIds, (err, data) => {
                if (err) {
                    console.error(err);
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
                    console.error(err);
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

    async saveUrlsToDisk(path: string, urls: string[]) {
        if (urls.length > 0) {
            await fse.mkdirp(path);
            let writeStream = fs.createWriteStream(path);
            writeStream.on('error', function (err) { console.error("IO ERROR: " + err); });
            urls.forEach(url => writeStream.write(url + '\n', 'utf8'));
            writeStream.end();
        }
    }

    async saveThreadsList() {
        this.queringAllThread = false;
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
                this.onError(error);
            }
        } while (1);
        const threadToString = thread => "Name: " + thread.name + ", message count: " + thread.messageCount + ", threadID: " + thread.threadID;
        threadsList.sort((a, b) => b.messageCount - a.messageCount);

        if (threadsList.length > 0) {
            let filePath: string = path.join(__dirname, "threadsIDs.txt");
            let writeStream = fs.createWriteStream(filePath);
            writeStream.on('error', function (err) { console.error("IO ERROR: " + err); });
            threadsList.forEach(thread => writeStream.write(threadToString(thread) + '\n', 'utf8'));
            writeStream.end();
            console.log("Saved results to " + filePath);
        }
    }
}