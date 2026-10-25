import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

export function findChrome(): string {
  const path = process.env.CHROME_PATH ?? CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!path) throw new Error("Chrome not found. Install Google Chrome or set CHROME_PATH.");
  return path;
}

/** Minimal Chrome DevTools Protocol client over the Node built-in WebSocket. */
export class Cdp {
  private nextId = 0;
  private pending = new Map<number, (message: { result?: unknown; error?: { message: string } }) => void>();
  private waiters: { method: string; resolve: (params: Record<string, unknown>) => void }[] = [];
  /** Status of the most recent document response (the last one after redirects). */
  private documentStatus = 0;

  private constructor(
    private ws: WebSocket,
    private chrome: ChildProcess,
  ) {
    ws.onmessage = (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id !== undefined) {
        this.pending.get(message.id)?.(message);
        this.pending.delete(message.id);
      } else if (message.method) {
        if (message.method === "Network.responseReceived" && message.params?.type === "Document") {
          this.documentStatus = message.params.response?.status ?? 0;
        }
        this.waiters = this.waiters.filter((waiter) => {
          if (waiter.method !== message.method) return true;
          waiter.resolve(message.params);
          return false;
        });
      }
    };
  }

  static async launch(profileDir: string): Promise<Cdp> {
    const port = await freePort();
    const chrome = spawn(
      findChrome(),
      [
        "--headless=new",
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profileDir}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-gpu",
        "about:blank",
      ],
      { stdio: "ignore" },
    );

    let webSocketUrl: string | undefined;
    for (let attempt = 0; attempt < 60 && !webSocketUrl; attempt++) {
      try {
        const targets: { type: string; webSocketDebuggerUrl: string }[] = await (
          await fetch(`http://127.0.0.1:${port}/json`)
        ).json();
        webSocketUrl = targets.find((target) => target.type === "page")?.webSocketDebuggerUrl;
      } catch {
        // Chrome is still starting.
      }
      if (!webSocketUrl) await sleep(250);
    }
    if (!webSocketUrl) {
      chrome.kill();
      throw new Error("Chrome did not start its DevTools endpoint.");
    }

    const ws = new WebSocket(webSocketUrl);
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("Could not connect to Chrome DevTools."));
    });
    const cdp = new Cdp(ws, chrome);
    await cdp.send("Page.enable");
    await cdp.send("Network.enable");
    return cdp;
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      this.pending.set(id, (message) => (message.error ? reject(new Error(`${method}: ${message.error.message}`)) : resolve(message.result)));
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Resolves with the params of the next event of this kind. */
  once(method: string, timeoutMs: number): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      const waiter = { method, resolve: (params: Record<string, unknown>) => resolve(params) };
      this.waiters.push(waiter);
      setTimeout(() => {
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) {
          this.waiters.splice(index, 1);
          resolve(null);
        }
      }, timeoutMs);
    });
  }

  async evaluate<T>(expression: string): Promise<T> {
    const result = (await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })) as {
      result: { value: T };
      exceptionDetails?: { text: string };
    };
    if (result.exceptionDetails) throw new Error(`Page script failed: ${result.exceptionDetails.text}`);
    return result.result.value;
  }

  setViewport(width: number, height: number) {
    return this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  }

  /** Navigates and resolves with the document's HTTP status once the page has loaded. */
  async navigate(url: string): Promise<number> {
    this.documentStatus = 0;
    const loaded = this.once("Page.loadEventFired", 60_000);
    await this.send("Page.navigate", { url });
    await loaded;
    return this.documentStatus;
  }

  /** Closes the connection and waits for Chrome to exit, so its profile folder can be deleted. */
  async close() {
    this.ws.close();
    if (this.chrome.exitCode !== null) return;
    const exited = new Promise<void>((resolve) => this.chrome.once("exit", () => resolve()));
    this.chrome.kill();
    await Promise.race([exited, sleep(5000)]);
  }
}
