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
  return { api: load("./mockApi.ts").mockApi, helpers: load("./demoNotifications.ts"), snapshot: () => snapshot, fill: () => { full = true; } };
}
const source = changes => ({ userId: 1, companies: [], events: [], applications: [], companyIds: [], soloIds: [], ...changes });
const now = Date.parse("2026-10-19T12:00:00Z");
const event = changes => ({ id: 7, creator: { id: 2 }, title: "Встреча", locationName: "Кофейня", status: "active", createdAt: "2026-10-18T12:00:00Z", updatedAt: "2026-10-18T12:00:00Z", startsAt: "2026-10-19T12:30:00Z", ...changes });
const companyInput = { name: "Наша компания", description: null, maxMembers: 5, joinType: "open" };

test("only actual relationships produce reminders, with stable IDs and correct time windows", () => {
  const { deriveNotifications } = harness().helpers;
  assert.deepEqual(deriveNotifications(source({ events: [event()] }), now), []);
  const one = deriveNotifications(source({ events: [event()], soloIds: [7] }), now);
  assert.equal(one.length, 1); assert.equal(one[0].kind, "reminder"); assert.match(one[0].id, /:1$/);
  assert.deepEqual(deriveNotifications(source({ events: [event()], soloIds: [7] }), now + 1000), one);
  assert.match(deriveNotifications(source({ events: [event({ startsAt: "2026-10-20T11:00:00Z" })], soloIds: [7] }), now)[0].id, /:24$/);
  for (const changes of [{ startsAt: "2026-10-18T11:00:00Z" }, { startsAt: "2026-10-21T11:00:00Z" }, { status: "blocked" }, { status: "completed" }]) assert.equal(deriveNotifications(source({ events: [event(changes)], soloIds: [7] }), now).length, 0);
});
test("blocked and unrelated private companies do not leak reminders or notifications", () => {
  const { deriveNotifications } = harness().helpers;
  const company = { id: 42, eventId: 7, name: "Закрытая", visibility: "private", status: "active", owner: { id: 2 }, createdAt: new Date(now).toISOString() };
  assert.deepEqual(deriveNotifications(source({ companies: [company], events: [event()] }), now), []);
  assert.equal(deriveNotifications(source({ companies: [company], events: [event()], companyIds: [42] }), now)[0].kind, "reminder");
  assert.deepEqual(deriveNotifications(source({ companies: [{ ...company, status: "blocked" }], events: [event()], companyIds: [42] }), now), []);
});
test("application notifications are scoped to applicant/owner and target the correct company or chat", () => {
  const { deriveNotifications } = harness().helpers;
  const company = { id: 42, eventId: 7, name: "Своя компания", owner: { id: 2 }, status: "active", createdAt: "2026-01-01T00:00:00Z" };
  const application = { id: 9, companyId: 42, user: { id: 1, firstName: "Анна" }, status: "pending", createdAt: new Date(now).toISOString(), resolvedAt: null };
  const pending = deriveNotifications(source({ userId: 2, companies: [company], applications: [application] }), now);
  assert.deepEqual(pending[0].target, { kind: "company", id: 42 });
  assert.deepEqual(deriveNotifications(source({ userId: 3, companies: [company], applications: [application] }), now), []);
  const approved = deriveNotifications(source({ companies: [company], companyIds: [42], applications: [{ ...application, status: "approved", resolvedAt: new Date(now).toISOString() }] }), now);
  assert.deepEqual(approved[0].target, { kind: "chat", id: 42 });
});
test("event updates and blocked status have versioned IDs and do not direct to unavailable events", () => {
  const { deriveNotifications } = harness().helpers;
  const changed = event({ startsAt: "2026-10-22T12:00:00Z", updatedAt: new Date(now).toISOString() });
  const active = deriveNotifications(source({ events: [changed], soloIds: [7] }), now)[0];
  const blocked = deriveNotifications(source({ events: [{ ...changed, status: "blocked" }], soloIds: [7] }), now)[0];
  assert.equal(active.target.kind, "event"); assert.equal(blocked.target.kind, "plans"); assert.notEqual(active.id, blocked.id);
});
test("history merge preserves read receipts, deduplicates, expires after 30 days and caps history", () => {
  const { mergeNotifications } = harness().helpers;
  const notification = { id: "1", createdAt: new Date(now).toISOString(), readAt: new Date(now).toISOString() };
  assert.equal(mergeNotifications([notification], [{ ...notification, readAt: null }], now)[0].readAt, notification.readAt);
  assert.equal(mergeNotifications([{ ...notification, createdAt: "2026-01-01T00:00:00Z" }], [], now).length, 0);
  assert.equal(mergeNotifications([], Array.from({ length: 250 }, (_, id) => ({ ...notification, id: String(id) })), now).length, 200);
});
test("notification read receipts persist and are isolated by account", async () => {
  const storage = harness(); await assert.rejects(storage.api.listNotifications(), error => error.code === "UNAUTHORIZED");
  await storage.api.login("google"); const company = await storage.api.createCompany(3001, companyInput);
  const first = await storage.api.listNotifications(); const item = first.items.find(item => item.id === `company:${company.id}:created`);
  assert.ok(item); assert.equal(item.readAt, null);
  await storage.api.markNotificationsRead([item.id]);
  assert.ok((await harness(storage.snapshot()).api.listNotifications()).items.find(notification => notification.id === item.id).readAt);
  const snapshot = JSON.parse(storage.snapshot()); snapshot.user = snapshot.users.find(user => user.id === 3);
  const other = harness(JSON.stringify(snapshot)); await assert.rejects(other.api.markNotificationsRead([item.id]), error => error.code === "NOTIFICATION_NOT_FOUND");
  assert.ok(!(await other.api.listNotifications()).items.some(notification => notification.id === item.id));
});
test("mark all uses the loaded ID snapshot and leaves later notifications unread", async () => {
  const storage = harness(); await storage.api.login("google");
  const first = await storage.api.createCompany(3001, companyInput), loaded = await storage.api.listNotifications();
  const second = await storage.api.createCompany(3002, companyInput);
  await storage.api.markNotificationsRead(loaded.items.map(item => item.id));
  const items = (await storage.api.listNotifications()).items;
  assert.ok(items.find(item => item.id === `company:${first.id}:created`).readAt);
  assert.equal(items.find(item => item.id === `company:${second.id}:created`).readAt, null);
});
test("quota failure does not mark notifications read in memory", async () => {
  const storage = harness(); await storage.api.login("google"); await storage.api.createCompany(3001, companyInput);
  const item = (await storage.api.listNotifications()).items[0]; storage.fill();
  await assert.rejects(storage.api.markNotificationsRead([item.id]), error => error.code === "STORAGE_FULL");
  assert.equal((await storage.api.listNotifications()).items.find(notification => notification.id === item.id).readAt, null);
});
test("notification API paginates beyond 100 records without resetting legacy data", async () => {
  const storage = harness(); await storage.api.login("google"); await storage.api.createCompany(3001, companyInput);
  const snapshot = JSON.parse(storage.snapshot());
  snapshot.notificationsByUser = { 1: Array.from({ length: 130 }, (_, index) => ({ id: `seed:${index}`, kind: "company", title: "История", body: "Запись", createdAt: new Date().toISOString(), readAt: null, target: { kind: "plans" } })) };
  const api = harness(JSON.stringify(snapshot)).api;
  const pages = await Promise.all([1, 2, 3].map(page => api.listNotifications({ page, limit: 50 })));
  assert.ok(pages[0].pagination.total > 100);
  assert.equal(new Set(pages.flatMap(page => page.items).map(item => item.id)).size, pages[0].pagination.total);
});
