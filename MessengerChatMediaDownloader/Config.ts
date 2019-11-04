export module Config {
    export var showErrorMessageOnly: boolean = true;
    export function logError(error: any) {
        if (error instanceof Error && showErrorMessageOnly) {
            console.error(error.name + ": " + error.message);
        }
        else {
            console.error(error)
        }
    }
}