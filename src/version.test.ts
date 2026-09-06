import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { PACKAGE_VERSION } from "./version.js";

test("runtime parser version matches package metadata", () => {
  const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as { version?: unknown };
  assert.equal(PACKAGE_VERSION, packageJson.version);
});
