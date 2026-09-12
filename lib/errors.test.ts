import { describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError, ValidationError, runAction } from "./errors";

describe("runAction", () => {
  it("returns ok:true with the function's result on success", async () => {
    const result = await runAction(async () => 42);
    expect(result).toEqual({ ok: true, data: 42 });
  });

  it("maps a thrown ValidationError to ok:false with its message, without logging", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await runAction(async () => {
      throw new ValidationError("Nama wajib diisi");
    });
    expect(result).toEqual({ ok: false, error: "Nama wajib diisi" });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("maps a thrown ForbiddenError to ok:false with its message", async () => {
    const result = await runAction(async () => {
      throw new ForbiddenError("Anda tidak memiliki izin untuk melakukan ini");
    });
    expect(result).toEqual({
      ok: false,
      error: "Anda tidak memiliki izin untuk melakukan ini",
    });
  });

  it("maps a thrown NotFoundError to ok:false with its message", async () => {
    const result = await runAction(async () => {
      throw new NotFoundError("Data tidak ditemukan");
    });
    expect(result).toEqual({ ok: false, error: "Data tidak ditemukan" });
  });

  it("logs the stack trace server-side and re-throws an unexpected error, without leaking its message", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const boom = new Error("column memberz does not exist");

    await expect(
      runAction(async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(errorSpy).toHaveBeenCalledWith(boom);

    errorSpy.mockRestore();
  });

  it("does not log or swallow a Next.js redirect/not-found control-flow signal", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const redirectSignal = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/login;307;",
    });

    await expect(
      runAction(async () => {
        throw redirectSignal;
      }),
    ).rejects.toBe(redirectSignal);
    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
