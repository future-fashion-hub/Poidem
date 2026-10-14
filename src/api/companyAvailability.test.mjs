import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const exported = {};
const code = ts.transpileModule(readFileSync(new URL("./companyAvailability.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
new Function("exports", code)(exported);
const { companyEventAvailable, loadCompanyEvents } = exported;
const now = Date.parse("2026-10-15T12:00:00Z");
const company = { id: 1, eventId: 10, status: "active" };
const event = { id: 10, status: "active", startsAt: "2026-10-15T10:00:00Z", endsAt: "2026-10-15T13:00:00Z" };

test("companies remain during the event and expire at its exact end", () => {
  assert.equal(companyEventAvailable(company, { 10: event }, now), true);
  assert.equal(companyEventAvailable(company, { 10: { ...event, endsAt: "2026-10-15T12:00:00Z" } }, now), false);
  assert.equal(companyEventAvailable(company, { 10: { ...event, endsAt: null } }, now), false);
  assert.equal(companyEventAvailable(company, { 10: { ...event, status: "completed" } }, now), false);
  assert.equal(companyEventAvailable(company, {}, now), false);
});
test("event lookup reuses known events and deduplicates companies of the same event", async () => {
  const calls = [];
  const index = await loadCompanyEvents([company, { id: 2, eventId: 10 }, { id: 3, eventId: 11 }], [{ ...event, id: 11 }], async id => { calls.push(id); return event; });
  assert.deepEqual(calls, [10]);
  assert.equal(index[10], event);
  assert.equal(index[11].id, 11);
});
test("removed events are hidden but temporary API errors are reported", async () => {
  const missing = await loadCompanyEvents([company], [], async () => { throw { status: 404 }; });
  assert.equal(missing[10], null);
  await assert.rejects(loadCompanyEvents([company], [], async () => { throw new Error("offline"); }), /offline/);
});
