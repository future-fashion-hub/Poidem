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

test("chat activity adapter sends scoped paginated reads and explicit vote/pin mutations", async () => {
  const { api, calls } = adapter(() => response({}));
  const input = { question: "Где встречаемся?", options: ["Снаружи", "Внутри"], durationHours: 24 };
  await api.listCompanyPolls(42, { page: 3, limit: 50 }); await api.createCompanyPoll(42, input);
  await api.voteCompanyPoll(42, 7, "2"); await api.voteCompanyPoll(42, 7, null); await api.closeCompanyPoll(42, 7);
  await api.getCompanyPinnedMessage(42); await api.setCompanyPinnedMessage(42, 10); await api.setCompanyPinnedMessage(42, null);
  assert.ok(calls[0].url.endsWith("/companies/42/polls?page=3&limit=50"));
  assert.equal(calls[1].init.method, "POST"); assert.deepEqual(JSON.parse(calls[1].init.body), input);
  assert.ok(calls[2].url.endsWith("/companies/42/polls/7/vote")); assert.equal(calls[2].init.method, "PUT");
  assert.deepEqual(JSON.parse(calls[3].init.body), { optionId: null });
  assert.ok(calls[4].url.endsWith("/polls/7/close")); assert.equal(calls[4].init.method, "POST");
  assert.equal(calls[5].init.method, undefined); assert.equal(calls[6].init.method, "PUT"); assert.deepEqual(JSON.parse(calls[6].init.body), { messageId: 10 });
  assert.equal(calls[7].init.method, "DELETE"); assert.ok(calls.every(call => call.init.credentials === "include"));
});

test("missing chat activity backend never fabricates a poll or retries a legacy route", async () => {
  const { api, calls } = adapter(() => response({ error: { code: "NOT_FOUND", message: "Опросы пока не подключены" } }, 404));
  await assert.rejects(api.createCompanyPoll(42, {}), error => error.status === 404 && error.message === "Опросы пока не подключены");
  assert.equal(calls.length, 1);
});
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

test("notification adapter sends server pagination and explicit read IDs", async () => {
  const { api, calls } = adapter(() => response({ items: [] }));
  await api.listNotifications({ page: 3, limit: 50 }); await api.markNotificationsRead(["n:1", "n:2"]);
  assert.equal(calls[0].url, "https://api.test/api/v1/users/me/notifications?page=3&limit=50");
  assert.equal(calls[1].url, "https://api.test/api/v1/users/me/notifications/read");
  assert.equal(calls[1].init.method, "POST"); assert.deepEqual(JSON.parse(calls[1].init.body), { ids: ["n:1", "n:2"] });
  assert.ok(calls.every(call => call.init.credentials === "include"));
});
