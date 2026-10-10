import { describe, expect, it } from "vitest";
import { localPorts, resolvePython, venvPython } from "./python-env.mjs";

const root = "/repo";

describe("venvPython", () => {
  it("uses the Windows and POSIX virtual environment layouts", () => {
    expect(venvPython("/repo/apps/api/.venv", "win32").replaceAll("\\", "/")).toBe("/repo/apps/api/.venv/Scripts/python.exe");
    expect(venvPython("/repo/apps/api/.venv", "linux").replaceAll("\\", "/")).toBe("/repo/apps/api/.venv/bin/python");
    expect(venvPython("/repo/apps/api/.venv", "darwin").replaceAll("\\", "/")).toBe("/repo/apps/api/.venv/bin/python");
  });
});

describe("resolvePython", () => {
  it("prefers MEDFORGE_PYTHON, then the project venv, then the platform default", () => {
    expect(resolvePython({ root, platform: "linux", env: { MEDFORGE_PYTHON: "/custom/python" }, exists: () => true })).toBe("/custom/python");
    const windowsVenv = resolvePython({ root, platform: "win32", env: {}, exists: (path) => path.replaceAll("\\", "/").endsWith("Scripts/python.exe") });
    expect(windowsVenv.replaceAll("\\", "/")).toBe("/repo/apps/api/.venv/Scripts/python.exe");
    expect(resolvePython({ root, platform: "win32", env: {}, exists: () => false })).toBe("python");
    expect(resolvePython({ root, platform: "linux", env: {}, exists: () => false })).toBe("python3");
  });
});

describe("localPorts", () => {
  it("defaults to 8000 and 5173 and rejects invalid or equal ports", () => {
    expect(localPorts({})).toEqual({ api: 8000, web: 5173 });
    expect(localPorts({ MEDFORGE_API_PORT: "18081", MEDFORGE_WEB_PORT: "15174" })).toEqual({ api: 18081, web: 15174 });
    expect(() => localPorts({ MEDFORGE_API_PORT: "80a" })).toThrow(/numeric/);
    expect(() => localPorts({ MEDFORGE_API_PORT: "70000" })).toThrow(/between 1 and 65535/);
    expect(() => localPorts({ MEDFORGE_API_PORT: "5173" })).toThrow(/must differ/);
  });
});
