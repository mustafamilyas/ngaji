import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { provisionInputFromEnv } from "./from-env";

const base = {
  BOOTSTRAP_ORG_NAME: "Org Baru",
  BOOTSTRAP_ROOT_GROUP_NAME: "Pusat",
  BOOTSTRAP_OWNER_USERNAME: "owner",
  BOOTSTRAP_OWNER_NAME: "Owner",
  BOOTSTRAP_OWNER_PASSWORD: "kata-sandi-aman",
  BOOTSTRAP_MEMBER_CODE_PREFIX: "ORG",
};

describe("provisionInputFromEnv", () => {
  it("maps the variables and defaults levels to pusat,daerah,desa,kelompok", () => {
    expect(provisionInputFromEnv(base)).toEqual({
      organizationName: "Org Baru",
      rootGroupName: "Pusat",
      levelNames: ["pusat", "daerah", "desa", "kelompok"],
      timezone: undefined,
      ownerUsername: "owner",
      ownerName: "Owner",
      ownerPassword: "kata-sandi-aman",
      memberCodePrefix: "ORG",
    });
  });

  it("splits and trims custom level names and drops empty entries", () => {
    const input = provisionInputFromEnv({ ...base, BOOTSTRAP_LEVEL_NAMES: " pusat , cabang ,," });
    expect(input.levelNames).toEqual(["pusat", "cabang"]);
  });

  it("passes the timezone through when set and leaves it undefined when blank", () => {
    expect(provisionInputFromEnv({ ...base, BOOTSTRAP_TIMEZONE: "Asia/Makassar" }).timezone).toBe("Asia/Makassar");
    expect(provisionInputFromEnv({ ...base, BOOTSTRAP_TIMEZONE: "  " }).timezone).toBeUndefined();
  });

  it.each(Object.keys(base))("names the variable when %s is missing", (name) => {
    const env: Record<string, string | undefined> = { ...base };
    delete env[name];
    expect(() => provisionInputFromEnv(env)).toThrow(ValidationError);
    expect(() => provisionInputFromEnv(env)).toThrow(name);
  });

  it("does not repeat the password in any error", () => {
    const env = { ...base, BOOTSTRAP_ORG_NAME: undefined };
    expect(() => provisionInputFromEnv(env)).toThrow(/BOOTSTRAP_ORG_NAME/);
    try {
      provisionInputFromEnv(env);
    } catch (error) {
      expect((error as Error).message).not.toContain(base.BOOTSTRAP_OWNER_PASSWORD);
    }
  });
});
