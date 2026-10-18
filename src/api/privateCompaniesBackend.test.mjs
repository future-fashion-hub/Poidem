import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function adapter(reply) {
  const types = {};
  new Function("exports", ts.transpileModule(readFileSync(new URL("./types.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(types);
  const source = readFileSync(new URL("./backendApi.ts", import.meta.url), "utf8").replaceAll("import.meta.env.VITE_BACKEND_URL", '"https://api.test"').replaceAll("import.meta.env.VITE_API_MODE", '"backend"');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {}, calls = [];
  new Function("require", "exports", "fetch", code)(() => types, exports, async (url, init) => { calls.push({ url, init }); return reply(url, init); });
  return { api: exports.backendApi, calls };
}
const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
test("private creation never falls back to a public route, while public creation keeps the old payload", async () => {
  const { api, calls } = adapter(() => response({ id: 42, visibility: "private" }));
  await api.createCompany(7, { name: "Закрытая", visibility: "private", joinType: "open", description: null, maxMembers: 4 });
  assert.equal(calls[0].url, "https://api.test/api/v1/events/7/private-companies");
  assert.equal(JSON.parse(calls[0].init.body).visibility, "private");
  await api.createCompany(7, { name: "Публичная", visibility: "public", joinType: "open", description: null, maxMembers: 4 });
  assert.equal(calls[1].url, "https://api.test/api/v1/events/7/companies");
  assert.equal("visibility" in JSON.parse(calls[1].init.body), false);
});
test("missing private API and incorrect visibility fail explicitly without a public retry", async () => {
  const missing = adapter(() => response({ error: { code: "NOT_FOUND", message: "Новый API не подключён" } }, 404));
  await assert.rejects(missing.api.createCompany(7, { visibility: "private" }), error => error.status === 404);
  assert.equal(missing.calls.length, 1);
  const invalid = adapter(() => response({ id: 42 }));
  await assert.rejects(invalid.api.createCompany(7, { visibility: "private" }), error => error.code === "PRIVACY_NOT_SUPPORTED");
});
test("token APIs use explicit read and authenticated mutation operations with credentials", async () => {
  const { api, calls } = adapter(() => response({})), token = "a".repeat(64);
  await api.previewCompanyInvitation(token); await api.redeemCompanyInvitation(token);
  await api.createCompanyInvitation(42, { expiresInHours: 168, maxUses: 10 }); await api.revokeCompanyInvitation(42);
  assert.equal(calls[0].url, "https://api.test/api/v1/company-invitations/" + token);
  assert.equal(calls[0].init.method, undefined);
  assert.equal(calls[1].init.method, "POST"); assert.ok(calls[1].url.endsWith("/redeem"));
  assert.equal(calls[2].init.method, "POST"); assert.equal(calls[3].init.method, "DELETE");
  assert.ok(calls.every(call => call.init.credentials === "include"));
});
