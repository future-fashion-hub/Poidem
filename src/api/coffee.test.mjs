import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function harness(saved = null) {
  const cache = new Map(); let snapshot = saved, full = false;
  const storage = { getItem: () => snapshot, setItem: (_key, value) => { if (full) throw new Error("Full"); snapshot = value; } };
  const load = path => {
    if (cache.has(path)) return cache.get(path);
    const exports = {}; cache.set(path, exports);
    new Function("require", "exports", "localStorage", "setTimeout", compile(path))(name => load(`${name}.ts`), exports, storage, callback => { callback(); return 1; });
    return exports;
  };
  return { api: load("./mockApi.ts").mockApi, helpers: load("./coffee.ts"), snapshot: () => snapshot, fillStorage: () => { full = true; } };
}
const input = (changes = {}) => ({ title: "Кофе после работы", description: "Встретимся за кофе и поговорим о любимых книгах.", cityId: 1, locationName: "Кофейня у парка", address: "Улица, 10", startsAt: "2099-11-01T18:00:00+03:00", duration: 60, maxMembers: 4, joinType: "open", topic: "chat", ...changes });

test("coffee validation rejects missing fields, past dates, fractional seats and invalid options", () => {
  const { helpers } = harness();
  assert.deepEqual(helpers.validateCoffee(input(), [1]), {});
  for (const [field, value] of [["title", "a"], ["description", ""], ["cityId", 999], ["locationName", ""], ["address", "x".repeat(241)], ["startsAt", "2000-01-01"], ["startsAt", "broken"], ["maxMembers", 1], ["maxMembers", 9], ["maxMembers", 2.5], ["duration", 17], ["topic", "unknown"], ["joinType", "unknown"]]) {
    assert.ok(helpers.validateCoffee(input({ [field]: value }), [1])[field], field);
  }
});

test("coffee demos are paginated, filterable, and separate from normal event discovery", async () => {
  const { api } = harness();
  const first = await api.listCoffeeMeetings({}, { page: 1, limit: 3 }), second = await api.listCoffeeMeetings({}, { page: 2, limit: 3 });
  assert.equal(first.items.length, 3); assert.equal(second.items.length, 3); assert.equal(first.pagination.totalPages, 2);
  assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 6);
  assert.ok((await api.listCoffeeMeetings({ cityId: 1, topic: "walk" })).items.every(item => item.event.cityId === 1 && item.topic === "walk"));
  const coffeeIds = new Set([...first.items, ...second.items].map(item => item.eventId));
  assert.ok((await api.listEvents()).items.every(event => !coffeeIds.has(event.id)));
});

test("guest cannot create coffee meetings and invalid creation makes no orphan company", async () => {
  const { api } = harness();
  await assert.rejects(api.createCoffeeMeeting(input()), error => error.code === "UNAUTHORIZED");
  await api.login("google");
  await assert.rejects(api.createCoffeeMeeting(input({ maxMembers: 1 })), error => error.code === "VALIDATION_ERROR");
  assert.equal((await api.listMyCompanies()).items.length, 0);
});

test("creating coffee creates one event, owner membership, company and usable existing chat", async () => {
  const storage = harness(), { api } = storage;
  const { user } = await api.login("google");
  const meeting = await api.createCoffeeMeeting(input());
  assert.equal(meeting.participation, "owner");
  assert.equal(meeting.company.membersCount, 1); assert.equal(meeting.event.participantsCount, 1);
  assert.equal(meeting.company.owner.id, user.id);
  assert.equal(Date.parse(meeting.event.endsAt) - Date.parse(meeting.event.startsAt), 3600000);
  assert.ok((await api.listMyCompanies()).items.some(company => company.id === meeting.companyId));
  assert.ok((await api.listMyEvents()).items.some(event => event.id === meeting.eventId));
  await api.sendCompanyMessage(meeting.companyId, "До встречи!");
  assert.equal((await api.listCompanyMessages(meeting.companyId)).items[0].text, "До встречи!");
  const restored = harness(storage.snapshot());
  assert.equal((await restored.api.getCoffeeMeeting(meeting.id)).participation, "owner");
  await assert.rejects(api.leaveCompany(meeting.companyId), error => error.code === "OWNER_CANNOT_LEAVE");
});

test("joining and leaving coffee updates counts once and survives reload", async () => {
  const storage = harness(), { api } = storage;
  await api.login("google");
  const before = await api.getCoffeeMeeting(3001);
  await api.joinOpenCompany(before.companyId);
  const joined = await api.getCoffeeMeeting(before.id);
  assert.equal(joined.participation, "member");
  assert.equal(joined.company.membersCount, before.company.membersCount + 1, "DTO snapshots must not mutate under the UI");
  assert.equal(joined.event.participantsCount, before.event.participantsCount + 1);
  await assert.rejects(api.joinOpenCompany(before.companyId), error => error.code === "ALREADY_COMPANY_MEMBER");
  assert.equal((await harness(storage.snapshot()).api.getCoffeeMeeting(before.id)).participation, "member");
  await api.leaveCompany(before.companyId);
  const left = await api.getCoffeeMeeting(before.id);
  assert.equal(left.participation, "none"); assert.equal(left.company.membersCount, before.company.membersCount); assert.equal(left.event.participantsCount, before.event.participantsCount);
});

test("request meetings support independent applications and cancellation without reserving a seat", async () => {
  const storage = harness(), { api } = storage;
  await api.login("google");
  const before = await api.getCoffeeMeeting(3002);
  await api.createCompanyApplication(before.companyId, "Буду рад встрече");
  const pending = await api.getCoffeeMeeting(before.id);
  assert.equal(pending.participation, "pending"); assert.equal(pending.company.membersCount, before.company.membersCount);
  await assert.rejects(api.createCompanyApplication(before.companyId, "Ещё раз"), error => error.code === "APPLICATION_ALREADY_EXISTS");
  const snapshot = JSON.parse(storage.snapshot()); snapshot.user = snapshot.users.find(user => user.id === 4);
  const other = harness(JSON.stringify(snapshot));
  await other.api.createCompanyApplication(before.companyId, "Я тоже хочу");
  assert.equal((await other.api.getCoffeeMeeting(before.id)).participation, "pending");
  await api.cancelMyCompanyApplication(before.companyId);
  assert.equal((await api.getCoffeeMeeting(before.id)).participation, "none");
});

test("approval enforces capacity and puts the approved applicant into the existing chat/company", async () => {
  const storage = harness(), { api } = storage;
  await api.login("google");
  await api.createCompanyApplication(3002, "Привет");
  const snapshot = JSON.parse(storage.snapshot());
  const company = snapshot.companies.find(item => item.id === 3002), application = snapshot.applications.at(-1);
  company.maxMembers = company.membersCount + 1;
  snapshot.user = snapshot.users.find(user => user.id === company.owner.id);
  const owner = harness(JSON.stringify(snapshot));
  await owner.api.resolveCompanyApplication(company.id, application.id, "approve");
  const approved = JSON.parse(owner.snapshot()); approved.user = approved.users.find(user => user.id === application.user.id);
  assert.equal((await harness(JSON.stringify(approved)).api.getCoffeeMeeting(3002)).participation, "member");
  const full = await owner.api.getCoffeeMeeting(3002);
  assert.equal(full.company.membersCount, full.company.maxMembers);
  assert.equal(full.event.participantsCount, 2);
});

test("closed, full and ended coffee meetings reject joining on the data layer", async () => {
  const base = harness(); await base.api.login("google");
  for (const change of ["closed", "full", "ended"]) {
    const snapshot = JSON.parse(base.snapshot());
    const company = snapshot.companies.find(item => item.id === 3001), event = snapshot.events.find(item => item.id === 3001);
    if (change === "closed") company.status = "closed";
    if (change === "full") company.membersCount = company.maxMembers;
    if (change === "ended") event.endsAt = "2000-01-01T12:00:00Z";
    await assert.rejects(harness(JSON.stringify(snapshot)).api.joinOpenCompany(3001), error => ["COMPANY_CLOSED", "COMPANY_FULL", "EVENT_UNAVAILABLE"].includes(error.code));
  }
});

test("storage failure does not leave a half-created coffee meeting", async () => {
  const storage = harness(); await storage.api.login("google");
  storage.fillStorage();
  await assert.rejects(storage.api.createCoffeeMeeting(input()), error => error.code === "STORAGE_FULL");
  assert.equal((await storage.api.listCoffeeMeetings()).pagination.total, 6);
  assert.equal((await storage.api.listMyCompanies()).items.length, 0);
});

test("existing user snapshots receive coffee seeds once without replacing custom events or favorites", async () => {
  const favoritesByUser = { 7: [{ eventId: 999, savedAt: "2026-10-17" }] };
  const custom = { id: 999, title: "Моё событие", status: "active", location: null };
  const storage = harness(JSON.stringify({ events: [custom], companies: [], favoritesByUser, mapEventsSeedVersion: 3 }));
  const migrated = JSON.parse(storage.snapshot());
  assert.deepEqual(migrated.events.find(event => event.id === 999), custom);
  assert.deepEqual(migrated.favoritesByUser, favoritesByUser);
  assert.equal((await storage.api.listCoffeeMeetings()).pagination.total, 6);
  assert.equal((await harness(storage.snapshot()).api.listCoffeeMeetings()).pagination.total, 6);
});

test("coffee time and free-seat filters exclude ended meetings and preserve pending owned meetings in mine", () => {
  const { helpers } = harness();
  const now = Date.parse("2099-11-01T12:00:00Z"), make = (id, event = {}, company = {}, participation = "none") => ({ id, event: { status: "active", startsAt: "2099-11-01T15:00:00Z", endsAt: "2099-11-01T16:00:00Z", ...event }, company: { status: "active", membersCount: 1, maxMembers: 4, ...company }, participation });
  const meetings = [make(1), make(2, { endsAt: "2000-01-01" }), make(3, {}, { membersCount: 4 }), make(4, { status: "pending" }, {}, "owner")];
  assert.deepEqual(helpers.filterCoffee(meetings, "all", true, now).map(item => item.id), [1]);
  assert.deepEqual(helpers.filterCoffee(meetings, "mine", false, now).map(item => item.id), [4]);
  assert.deepEqual(helpers.filterCoffee([make(5, { startsAt: "2099-12-01T15:00:00Z", endsAt: "2099-12-01T16:00:00Z" })], "week", false, now), []);
});
