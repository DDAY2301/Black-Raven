import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("deploy config preserves dashboard-managed SMTP secret and does not block new release", () => {
  const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  assert.equal(config.name, "blackraven-contact");
  assert.equal(config.main, "src/index.js");
  assert.equal(config.keep_vars, true);
  assert.equal(config.workers_dev, true);
  assert.equal(config.secrets?.required, undefined);
  assert.equal(config.vars?.SMTP_PASS, undefined, "Never publish SMTP_PASS as plaintext var");
});

test("runtime rejects missing SMTP password and does not send without readiness", () => {
  const script = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  assert.match(script, /env\.SMTP_PASS/);
  assert.match(script, /!password/);
  assert.match(script, /if \(!config\(env\)\) return json\(503/);
  assert.match(script, /if \(!await ready\(env\)\) return json\(503/);
});
