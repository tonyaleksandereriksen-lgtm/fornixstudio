import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "../../studio-one-extension/main.js");
const source = fs.readFileSync(extensionPath, "utf8");

function loadRouterSandbox() {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    setInterval: () => 1,
    clearInterval: () => {},
    Date,
  };

  vm.runInNewContext(source, sandbox, { filename: "main.js" });
  return sandbox.module.exports.__test;
}

function invokeHandle(router, raw) {
  const messages = [];
  const client = {
    send(payload) {
      messages.push(JSON.parse(payload));
    },
  };

  router.handle(client, raw);
  assert.equal(messages.length, 1);
  return messages[0];
}

test("extension router returns INVALID_JSON envelope for malformed input", () => {
  const router = loadRouterSandbox();
  const response = invokeHandle(router, "{not-json");

  assert.equal(response.ok, false);
  assert.equal(response.command, "unknown");
  assert.equal(response.errorCode, "INVALID_JSON");
  assert.equal(typeof response.errorMessage, "string");
});

test("extension router returns UNKNOWN_COMMAND envelope for unsupported commands", () => {
  const router = loadRouterSandbox();
  const response = invokeHandle(router, JSON.stringify({
    requestId: "req-1",
    command: "doesNotExist",
  }));

  assert.deepEqual(response, {
    requestId: "req-1",
    ok: false,
    command: "doesNotExist",
    errorCode: "UNKNOWN_COMMAND",
    errorMessage: "Unknown command: doesNotExist",
  });
});

test("probe commands return consistent success envelopes without Studio One globals", () => {
  const router = loadRouterSandbox();

  for (const command of ["ping", "getHostInfo", "getCapabilities", "runSelfTest"]) {
    const response = router.executeCommand(command, {}, "req-probe");

    assert.equal(response.ok, true);
    assert.equal(response.command, command);
    assert.equal(response.requestId, "req-probe");
    assert.equal(typeof response.data, "object");
    assert.ok(!("errorCode" in response));
    assert.ok(!("errorMessage" in response));
  }
});
