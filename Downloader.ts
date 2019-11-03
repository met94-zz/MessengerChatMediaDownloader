import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as delay from 'delay';
import * as random from 'random';
import * as Facebook from 'facebook-chat-api';
import * as readline from 'readline';
import * as download from 'download';
import * as path from 'path';


class MediaFetcherError extends Error {

}

class FileProgress {
    url: string;
    downloaded: boolean = false;

    constructor(url: string) {
        this.url = url;
    }
}

export class Downloader {
    facebookApi: any;

    constructor() {
    }

    async downloadFiles(id: string, outputPath: string, urls: string[]) {
        let filesProgressesDir: string = path.join(__dirname, id);
        let filesProgressesPath: string = path.join(filesProgressesDir, "fileProgresses.json");
        let filesProgresses: FileProgress[] = [];
        let saveChanges: boolean = false;
        // will fail if the file does not exist
        try {
            filesProgresses = JSON.parse(fs.readFileSync(filesProgressesPath, 'utf8'));
        } catch (error) {}
        for (let url of urls) {
            if (!filesProgresses.some(fileProgress => fileProgress.url == url)) {
                filesProgresses.push(new FileProgress(url));
            }
        };
        let unfinishedFiles: FileProgress[] = filesProgresses.filter(fileProgress => fileProgress.downloaded == false);
        if (unfinishedFiles.length > 0) {
            saveChanges = true;
        }
        try {
            for (let file of unfinishedFiles) {
                await download(file.url, outputPath);
                file.downloaded = true;
                console.log("Downloaded: " + file.url);
            }
        } catch (error) {
            console.error(error);
        } finally {
            if (saveChanges) {
                await fse.mkdirp(filesProgressesDir);
                fs.writeFileSync(filesProgressesPath, JSON.stringify(filesProgresses));
                console.log("Download progress saved");
            }
        }
    }
}