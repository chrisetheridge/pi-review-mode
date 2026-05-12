import { spawn } from "node:child_process";

export type BrowserOpener = (url: string) => Promise<void>;

export const openBrowser: BrowserOpener = async (url) => {
  const command = browserCommand(url);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command.command, command.args, {
      stdio: "ignore",
      detached: true
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
};

function browserCommand(url: string): { command: string; args: string[] } {
  switch (process.platform) {
    case "darwin":
      return { command: "open", args: [url] };
    case "win32":
      return { command: "cmd", args: ["/c", "start", "", url] };
    default:
      return { command: "xdg-open", args: [url] };
  }
}
