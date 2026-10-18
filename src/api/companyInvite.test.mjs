import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const exports = {};
const code = ts.transpileModule(readFileSync(new URL("./companyInvite.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
new Function("exports", code)(exports);
const { inviteCompanyId, companyInviteUrl, companyInviteAvailable } = exports;

test("invitation URLs contain only a safe company ID, never filters or credentials", () => {
  assert.equal(companyInviteUrl(42, "https://poidem.vercel.app", "/?q=secret#feed"), "https://poidem.vercel.app/#invite/42");
  for (const id of [-1, 0, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => companyInviteUrl(id, "https://poidem.vercel.app"));
  assert.throws(() => companyInviteUrl(1, "javascript:alert(1)"));
});
test("invitation parser rejects malformed, injected and unsafe IDs", () => {
  assert.equal(inviteCompanyId("#invite/42"), 42);
  assert.equal(inviteCompanyId("#/invite/42"), 42);
  for (const hash of ["#feed", "#invite/0", "#invite/-1", "#invite/1.5", "#invite/42/extra", "#invite/42?redirect=evil", "#invite/9999999999999999999", "#invite/<script>"]) assert.equal(inviteCompanyId(hash), 0, hash);
});
test("invite eligibility rejects wrong event, blocked, unpublished and expired companies", () => {
  const company = { eventId: 1, status: "active" }, event = { id: 1, status: "active", startsAt: "2099-01-01T10:00:00Z", endsAt: "2099-01-01T12:00:00Z" };
  assert.equal(companyInviteAvailable(company, event), true);
  assert.equal(companyInviteAvailable({ ...company, status: "closed" }, event), true, "existing members can still open their chat");
  assert.equal(companyInviteAvailable({ ...company, status: "blocked" }, event), false);
  assert.equal(companyInviteAvailable(company, { ...event, id: 2 }), false);
  for (const status of ["pending", "rejected", "completed", "blocked"]) assert.equal(companyInviteAvailable(company, { ...event, status }), false);
  assert.equal(companyInviteAvailable(company, { ...event, endsAt: "2000-01-01T00:00:00Z" }), false);
  assert.equal(companyInviteAvailable(company, { ...event, endsAt: "bad" }), false);
});
