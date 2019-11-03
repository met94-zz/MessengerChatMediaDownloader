import * as fs from 'fs';
import * as delay from 'delay';
import * as random from 'random';
import * as Facebook from 'facebook-chat-api';
import * as readline from 'readline';

class MediaFetcherError extends Error {

}

export class Core {
    facebookApi: any;

    constructor() {
    }

    async setup(appState: any): Promise<any> {
        this.facebookApi = await this.logFacebook(appState);
        if (appState != null && this.facebookApi == null) {
            console.error("Failed to log with the appState. Retrying with credentials");
            this.facebookApi = await this.logFacebook(null);
        }
        if (this.facebookApi == null) {
            throw Error("Failed to log in");
        }
        return this.facebookApi;
    }

    async logFacebook(appState: any): Promise<any> {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        function ReadText(question: string): Promise<string> {
            return new Promise(resolve => {
                rl.question(question, resolve);
            });
        }
        let login: string, password: string;
        if (appState == null) {
            login = await ReadText('Enter facebook login: ');
            password = await ReadText('Enter facebook password: ');
        }

        try {
            let facebookApi: any = await new Promise((resolve, reject) => {
                const loginCallback = (err: string, api: any) => {
                    if (err) {
                        console.error(err);
                        reject(Error(err));
                        return;
                    }
                    fs.writeFileSync('appstate.json', JSON.stringify(api.getAppState()));
                    resolve(api);
                };
                // Log in
                if (appState != null) {
                    Facebook({ appState: appState }, loginCallback);
                }
                else {
                    Facebook({ email: login, password: password }, loginCallback);
                }
            });
            return facebookApi;
        } catch (error) {
            console.error(error);
        }
    }
}