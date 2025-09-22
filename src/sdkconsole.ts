export class SdkConsole {
    static warn(...args: any[]) {
        console.warn("SDK: ", args);
    }
    static log(...args: any[]) {
        console.log("SDK: ", args);
    }

    static error(...args: any[]) {
        console.error("SDK: ", args);
    }
}
