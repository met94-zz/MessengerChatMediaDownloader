import * as Command from 'commander';
import * as fse from 'fs-extra';
import { MediaFetcher } from './MediaFetcher';
import { Core } from './Core';
import { Downloader } from './Downloader';
import * as delay from 'delay';
import { Config } from './Config';

Main();

async function Main() {
    Command.version('0.0.1');
    Command
        .option('-r, --reset', 'resets the saved session, allows to relog to fb')
        .option('-a, --all', 'download photos/videos/audios from all conversations')
        .option('-l, --list', 'list all conversations and their threadIds')
        .option('-i, --infinite', 'keep retrying until all operations succeed')
        .option('-t, --thread <threadID>', 'download photos/videos/audios from the conversation with given threadID');
    Command.parse(process.argv);
    let appState: any;
    let appStateFileName: string = 'appstate.json';
    if (!Command.reset && fse.existsSync(appStateFileName)) {
        try {
            appState = await fse.readJson(appStateFileName);
        } catch (error) {
            Config.logError(error);
        }
    }
    if (Command.all || Command.list || Command.thread) {
        try {
            let core: Core = new Core();
            await core.setup(appState);

            while (1) {
                try {
                    let downloader: Downloader;
                    if (Command.all || Command.thread) {
                        downloader = new Downloader();
                    }
                    let mediaFetcher = new MediaFetcher(core.facebookApi);
                    if (Command.all) {
                        await mediaFetcher.saveAll();
                        await downloader.downloadFilesForAll();
                    }
                    if (Command.list) {
                        await mediaFetcher.saveThreadsList();
                    }
                    if (Command.thread) {
                        let threadId: string = Command.thread;
                        await mediaFetcher.saveUrlsForThread(threadId);
                        await downloader.downloadFilesForThread(threadId);
                    }
                } catch (error) {
                    Config.logError(error);
                    if (!Command.infinite) {
                        throw error;
                    } else {
                        let delayInMs: number = 1000 * 60 * 3;
                        console.log("Will retry in " + delayInMs / 1000 / 60 + " minutes");
                        await delay(delayInMs);
                        continue;
                    }
                }
                break;
            }
        } catch (error) {
            Config.logError(error);
            Config.logError("Fatal error, terminating...");
        }
    }
    console.log("Main finished...");
}

