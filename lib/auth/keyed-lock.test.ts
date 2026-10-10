import { describe, expect, it } from "vitest";
import { withKeyedLock } from "./keyed-lock";

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

describe("withKeyedLock", () => {
  it("serializes calls that share a key", async () => {
    const log: string[] = [];
    const task = (name: string) =>
      withKeyedLock(["a"], async () => {
        log.push(`${name}:start`);
        await tick();
        log.push(`${name}:end`);
      });
    await Promise.all([task("1"), task("2"), task("3")]);
    expect(log).toEqual(["1:start", "1:end", "2:start", "2:end", "3:start", "3:end"]);
  });

  it("runs different keys concurrently", async () => {
    const log: string[] = [];
    const task = (key: string) =>
      withKeyedLock([key], async () => {
        log.push(`${key}:start`);
        await tick();
        log.push(`${key}:end`);
      });
    await Promise.all([task("a"), task("b")]);
    expect(log.slice(0, 2).sort()).toEqual(["a:start", "b:start"]);
  });

  it("serializes multi-key calls that overlap on one key", async () => {
    const log: string[] = [];
    const task = (name: string, keys: string[]) =>
      withKeyedLock(keys, async () => {
        log.push(`${name}:start`);
        await tick();
        log.push(`${name}:end`);
      });
    await Promise.all([task("x", ["u:a", "ip:1"]), task("y", ["ip:1", "u:b"])]);
    expect(log).toEqual(["x:start", "x:end", "y:start", "y:end"]);
  });

  it("does not deadlock when keys are passed in opposite orders", async () => {
    const run = Promise.all([
      withKeyedLock(["a", "b"], async () => {
        await tick();
        return 1;
      }),
      withKeyedLock(["b", "a"], async () => {
        await tick();
        return 2;
      }),
    ]);
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("deadlock")), 1000));
    await expect(Promise.race([run, timeout])).resolves.toEqual([1, 2]);
  });

  it("returns the function's result", async () => {
    await expect(withKeyedLock(["a"], async () => 42)).resolves.toBe(42);
  });

  it("releases the lock when the function throws", async () => {
    await expect(
      withKeyedLock(["a"], async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(withKeyedLock(["a"], async () => "ok")).resolves.toBe("ok");
  });

  it("treats duplicate keys as one", async () => {
    await expect(withKeyedLock(["a", "a"], async () => "ok")).resolves.toBe("ok");
  });
});
