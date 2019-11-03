import * as Command from 'commander';
import * as fs from 'fs';
import { MediaFetcher } from './MediaFetcher';
import { Core } from './Core';
import { Downloader } from './Downloader';

Main();

async function Main() {
    Command.version('1.0.0');
    Command
        .option('-r, --reset', 'resets the saved session, allows to relog to fb')
        .option('-a, --all', 'dump urls to photo/video/audio from all conversations')
        .option('-l, --list', 'get list of messenger conversations threadIDs')
        .option('-t, --thread <threadID>', 'dump urls to photo/video/audio from conversation with given threadID');
    Command.parse(process.argv);
    let appState: any;
    if (!Command.reset) {
        try {
            appState = JSON.parse(fs.readFileSync('appstate.json', 'utf8'));
        } catch (error) {
            console.error(error);
        }
    }
    if (Command.all || Command.list || Command.thread) {
        try {
            let core: Core = new Core();
            await core.setup(appState);

            //let downloader: Downloader = new Downloader();
            //await downloader.downloadFiles("tet", "./tet2/", ["https://www.thebostoncalendar.com/system/events/photos/000/157/951/original/Tet_Ba_Mien_2018_new.png?1512401368"]);

            let mediaFetcher = new MediaFetcher(core.facebookApi);
            if (Command.all) {
                await mediaFetcher.saveAll();
            }
            if (Command.list) {
                await mediaFetcher.saveThreadsList();
            }
            if (Command.thread) {
                await mediaFetcher.saveUrlsForThread(Command.thread);
            }
        } catch (error) {
            console.error(error);
            console.error("Fatal error, terminating...");
        }
    }
    console.log("Main finished...");
}

