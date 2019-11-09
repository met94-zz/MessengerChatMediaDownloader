import * as fse from 'fs-extra';
import * as Facebook from 'facebook-chat-api';
import * as readline from 'readline';
import { Config } from './Config';
import { Singletons } from './Singletons';
import { PathsManager } from './PathsManager';

export class Core {
    facebookApi: any;
    get pathsManager(): PathsManager {
        return Singletons.pathsManager;
    }

    constructor() {
    }

    async setup(appState: any): Promise<any> {
        if (appState != null) {
            this.facebookApi = await this.logFacebook(appState);
        }
        if (this.facebookApi == null) {
            if (appState != null) {
                Config.logError("Failed to log with the appState. Retrying with credentials");
            }
            this.facebookApi = await this.logFacebookWithCredentials();
        }
        if (this.facebookApi == null) {
            throw Error("Failed to log in");
        }
        return this.facebookApi;
    }

    async logFacebookWithCredentials(): Promise<any> {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        function ReadText(question: string): Promise<string> {
            return new Promise(resolve => {
                rl.question(question, resolve);
            });
        }
        let login: string = await ReadText('Enter facebook login: ');
        let password: string = await ReadText('Enter facebook password: ');
        rl.close();
        return await this.logFacebook(null, login, password);
    }

    async logFacebook(appState: any, login: string = null, password: string = null): Promise<any> {
        try {
            let facebookApi: any = await new Promise((resolve, reject) => {
                const loginCallback = (err: string, api: any) => {
                    if (err) {
                        Config.logError(err);
                        reject(Error(err));
                        return;
                    }
                    fse.outputJsonSync(this.pathsManager.getAppStatePath(), api.getAppState());
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
            Config.logError(error);
        }
    }
}