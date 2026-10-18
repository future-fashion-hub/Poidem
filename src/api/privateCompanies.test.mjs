import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function harness(saved = null) {
  let snapshot = saved, full = false; const cache = new Map();
  const load = path => {
    if (cache.has(path)) return cache.get(path);
    const exports = {}; cache.set(path, exports);
    const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    new Function("require", "exports", "localStorage", "setTimeout", code)(name => load(`${name}.ts`), exports, { getItem: () => snapshot, setItem: (_key, value) => { if (full) throw new Error("Quota"); snapshot = value; } }, callback => { callback(); return 1; });
    return exports;
  };
  return { api: load("./mockApi.ts").mockApi, snapshot: () => snapshot, fill: () => { full = true; } };
}
const privateInput = changes => ({ name: "Наш закрытый круг", description: "Только знакомые", maxMembers: 4, joinType: "open", visibility: "private", ...changes });
async function setup(changes = {}, inviteOptions = {}) {
  const owner = harness(); await owner.api.login("google");
  const company = await owner.api.createCompany(3001, privateInput(changes));
  const invitation = await owner.api.createCompanyInvitation(company.id, { expiresInHours: 168, maxUses: 10, ...inviteOptions });
  return { owner, company, invitation };
}
function asUser(storage, id) { const snapshot = JSON.parse(storage.snapshot()); snapshot.user = id ? snapshot.users.find(item => item.id === id) : null; return harness(JSON.stringify(snapshot)); }
const codeIs = code => error => error.code === code;

test("private company is hidden from guests, direct IDs, ordinary joins and its chat", async () => {
  const { owner, company, invitation } = await setup();
  const guest = asUser(owner, null);
  assert.ok(!(await guest.api.listEventCompanies(3001)).items.some(item => item.id === company.id));
  await assert.rejects(guest.api.getCompany(company.id), codeIs("COMPANY_NOT_FOUND"));
  const visitor = asUser(owner, 3);
  await assert.rejects(visitor.api.joinOpenCompany(company.id), codeIs("INVITATION_REQUIRED"));
  await assert.rejects(visitor.api.createCompanyApplication(company.id, "test"), codeIs("INVITATION_REQUIRED"));
  await assert.rejects(visitor.api.listCompanyMembers(company.id), codeIs("COMPANY_NOT_FOUND"));
  await assert.rejects(visitor.api.listCompanyMessages(company.id), codeIs("FORBIDDEN"));
  await assert.rejects(visitor.api.sendCompanyMessage(company.id, "test"), codeIs("FORBIDDEN"));
  const preview = await guest.api.previewCompanyInvitation(invitation.token);
  assert.equal(preview.company.id, company.id); assert.equal(preview.member, false);
  await assert.rejects(guest.api.redeemCompanyInvitation(invitation.token), codeIs("UNAUTHORIZED"));
  assert.equal((await owner.api.getCompanyInvitation(company.id)).uses, 0);
});
test("private invitation redemption is idempotent and gives exactly one membership/chat seat", async () => {
  const { owner, company, invitation } = await setup(); const visitor = asUser(owner, 3);
  assert.match(invitation.token, /^[a-f0-9]{64}$/);
  const [a, b] = await Promise.all([visitor.api.redeemCompanyInvitation(invitation.token), visitor.api.redeemCompanyInvitation(invitation.token)]);
  assert.equal(a.member, true); assert.equal(b.member, true);
  assert.equal((await visitor.api.getCompany(company.id)).membersCount, 2);
  assert.equal(JSON.parse(visitor.snapshot()).companyInvitations[invitation.token].uses, 1);
  assert.ok((await visitor.api.listMyCompanies()).items.some(item => item.id === company.id));
  await visitor.api.sendCompanyMessage(company.id, "Привет");
  assert.equal((await visitor.api.listCompanyMessages(company.id)).items.length, 1);
  await assert.rejects(visitor.api.createCompanyInvitation(company.id, { expiresInHours: 24, maxUses: 5 }), codeIs("FORBIDDEN"));
});
test("requests consume one invitation use but no seat until the owner approves", async () => {
  const { owner, company, invitation } = await setup({ joinType: "request" });
  const visitor = asUser(owner, 3), preview = await visitor.api.redeemCompanyInvitation(invitation.token);
  assert.equal(preview.pending, true); assert.equal(preview.member, false); assert.equal(preview.company.membersCount, 1);
  await visitor.api.redeemCompanyInvitation(invitation.token);
  const snapshot = JSON.parse(visitor.snapshot()); assert.equal(snapshot.companyInvitations[invitation.token].uses, 1);
  await assert.rejects(visitor.api.listCompanyMessages(company.id), codeIs("FORBIDDEN"));
  const approving = asUser(visitor, 1), application = (await approving.api.listCompanyApplications(company.id)).items[0];
  await approving.api.resolveCompanyApplication(company.id, application.id, "approve");
  const member = asUser(approving, 3);
  assert.equal((await member.api.previewCompanyInvitation(invitation.token)).member, true);
  assert.equal((await member.api.getCompany(company.id)).membersCount, 2);
});
test("rotation/revocation invalidate old URLs without removing existing members", async () => {
  const { owner, company, invitation } = await setup();
  const visitor = asUser(owner, 3); await visitor.api.redeemCompanyInvitation(invitation.token);
  const currentOwner = asUser(visitor, 1);
  const rotated = await currentOwner.api.createCompanyInvitation(company.id, { expiresInHours: 24, maxUses: 2 });
  assert.notEqual(rotated.token, invitation.token);
  await assert.rejects(currentOwner.api.previewCompanyInvitation(invitation.token), codeIs("INVITATION_UNAVAILABLE"));
  await currentOwner.api.revokeCompanyInvitation(company.id);
  await assert.rejects(currentOwner.api.previewCompanyInvitation(rotated.token), codeIs("INVITATION_UNAVAILABLE"));
  assert.equal(await currentOwner.api.getCompanyInvitation(company.id), null);
  const member = asUser(currentOwner, 3); assert.equal((await member.api.getCompany(company.id)).membersCount, 2);
  await member.api.sendCompanyMessage(company.id, "Мы остаёмся в чате");
});
for (const reason of ["expired", "exhausted", "capacity", "closed", "event", "profile", "age"]) test(`invitation rejects ${reason} without creating membership`, async () => {
  const { owner, company, invitation } = await setup(); const snapshot = JSON.parse(owner.snapshot());
  snapshot.user = snapshot.users.find(item => item.id === 3);
  const group = snapshot.companies.find(item => item.id === company.id), link = snapshot.companyInvitations[invitation.token];
  if (reason === "expired") link.expiresAt = "2000-01-01T00:00:00Z";
  if (reason === "exhausted") link.uses = link.maxUses;
  if (reason === "capacity") group.membersCount = group.maxMembers;
  if (reason === "closed") group.status = "closed";
  if (reason === "event") snapshot.events.find(item => item.id === group.eventId).endsAt = "2000-01-01T00:00:00Z";
  if (reason === "profile") snapshot.user.isProfileComplete = false;
  if (reason === "age") { group.minAge = 90; snapshot.user.birthDate = "2000-01-01"; }
  const visitor = harness(JSON.stringify(snapshot));
  await assert.rejects(visitor.api.redeemCompanyInvitation(invitation.token));
  assert.ok(!(await visitor.api.listMyCompanies()).items.some(item => item.id === company.id));
});
test("quota failure leaves the invitation and memberships unchanged", async () => {
  const { owner, company, invitation } = await setup(); const visitor = asUser(owner, 3); visitor.fill();
  await assert.rejects(visitor.api.redeemCompanyInvitation(invitation.token), codeIs("STORAGE_FULL"));
  assert.equal((await visitor.api.previewCompanyInvitation(invitation.token)).member, false);
  assert.equal((await visitor.api.previewCompanyInvitation(invitation.token)).company.membersCount, 1);
  owner.fill(); await assert.rejects(owner.api.revokeCompanyInvitation(company.id), codeIs("STORAGE_FULL"));
  assert.equal((await owner.api.getCompanyInvitation(company.id)).revoked, false);
});
test("old snapshots migrate without resetting public companies or user data", async () => {
  const { owner, company } = await setup(); const snapshot = JSON.parse(owner.snapshot()); delete snapshot.companyInvitations;
  const migrated = harness(JSON.stringify(snapshot));
  assert.equal((await migrated.api.getCompany(company.id)).visibility, "private");
  assert.equal(await migrated.api.getCompanyInvitation(company.id), null);
});

test("pending private application can be cancelled without member access", async () => {
  const { owner, company, invitation } = await setup({ joinType: "request" }); const visitor = asUser(owner, 3);
  await visitor.api.redeemCompanyInvitation(invitation.token);
  await visitor.api.cancelMyCompanyApplication(company.id);
  assert.equal((await visitor.api.getMyCompanyApplication(company.id)).status, "cancelled");
  assert.equal((await visitor.api.previewCompanyInvitation(invitation.token)).pending, false);
});

test("closed recruitment prevents approving a pending private application", async () => {
  const { owner, company, invitation } = await setup({ joinType: "request" }); const visitor = asUser(owner, 3);
  await visitor.api.redeemCompanyInvitation(invitation.token);
  const organiser = asUser(visitor, 1), application = (await organiser.api.listCompanyApplications(company.id)).items[0];
  await organiser.api.closeCompanyRecruitment(company.id);
  await assert.rejects(organiser.api.resolveCompanyApplication(company.id, application.id, "approve"), codeIs("COMPANY_CLOSED"));
  assert.equal((await organiser.api.getCompany(company.id)).membersCount, 1);
  assert.equal((await organiser.api.listCompanyApplications(company.id)).items[0].status, "pending");
});
