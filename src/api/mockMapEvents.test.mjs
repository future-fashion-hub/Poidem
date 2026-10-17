import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function demo(saved = null, storageFull = false) {
  let snapshot = saved;
  const cache = new Map();
  const storage = { getItem: () => snapshot, setItem: (_key, value) => { if (storageFull) throw new Error("Quota exceeded"); snapshot = value; } };
  const load = path => {
    if (cache.has(path)) return cache.get(path);
    const exports = {}; cache.set(path, exports);
    new Function("require", "exports", "localStorage", "setTimeout", compile(path))(
      name => load(`${name}.ts`), exports, storage, callback => { callback(); return 1; },
    );
    return exports;
  };
  return { api: load("./mockApi.ts").mockApi, snapshot: () => snapshot };
}

test("fresh demo contains 20 extra mapped events with covers and valid dictionary references", async () => {
  const { api } = demo();
  const [{ items }, dictionaries] = await Promise.all([api.listEvents(), api.dictionaries()]);
  const added = items.filter(event => event.id >= 2001 && event.id <= 2020);
  assert.equal(items.length, 26); assert.equal(added.length, 20);
  assert.equal(new Set(items.map(event => event.id)).size, 26);
  assert.equal(new Set(added.map(event => new URL(event.imageUrl).pathname)).size, 20, "all twenty covers use different source photos");
  assert.equal(new Set(added.map(event => event.description)).size, 20);
  assert.equal(new Set(added.map(event => `${event.location.latitude},${event.location.longitude}`)).size, 20);
  for (const event of added) {
    assert.equal(event.status, "active");
    assert.ok(Math.abs(event.location.latitude) <= 90 && Math.abs(event.location.longitude) <= 180);
    assert.ok(dictionaries.cities.some(city => city.id === event.cityId));
    assert.ok(dictionaries.categories.some(category => category.id === event.categoryId));
    assert.match(event.imageUrl, /^https:\/\/images\.unsplash\.com\//);
    assert.ok(event.description && event.locationName);
    assert.ok(event.description.length >= 120, "each event has its own detailed description");
    assert.ok(Date.parse(event.endsAt) > Date.parse(event.startsAt));
    assert.ok(Date.parse(event.startsAt) > Date.parse("2026-10-17"));
  }
  assert.equal(new Set(added.map(event => event.cityId)).size, 20);
  for (const cityId of Array.from({ length: 20 }, (_, index) => index + 1)) assert.equal(added.filter(event => event.cityId === cityId).length, 1);
  assert.ok(added.some(event => event.location.longitude > 130), "the demo includes the Far East");
  assert.ok(added.some(event => event.location.latitude < 44), "the demo includes southern Russia");
  assert.ok(added.some(event => event.location.longitude < 25), "the demo includes Kaliningrad");
});

test("existing snapshots gain the new events without losing edited events, users or favorites", async () => {
  const baseline = (await demo().api.listEvents()).items;
  const old = baseline.filter(event => event.id < 2001);
  old[0] = { ...old[0], title: "Моё изменённое событие" };
  const custom = { ...old[0], id: 9000, title: "Моё новое событие" };
  const user = { id: 777, firstName: "Анна" };
  const favoritesByUser = { 777: [{ eventId: 9000, savedAt: "2026-10-17" }] };
  const storage = demo(JSON.stringify({ user, events: [...old, custom, baseline.find(event => event.id === 2001)], favoritesByUser }));
  const migrated = JSON.parse(storage.snapshot());
  assert.deepEqual(migrated.user, user);
  assert.deepEqual(migrated.favoritesByUser, favoritesByUser);
  assert.equal(migrated.events.length, 27);
  assert.equal(migrated.events.find(event => event.id === old[0].id).title, old[0].title);
  assert.deepEqual(migrated.events.find(event => event.id === 9000), custom);
  assert.equal(new Set(migrated.events.map(event => event.id)).size, 27);
  assert.equal((await demo(storage.snapshot()).api.listEvents()).items.length, 27);
});

test("migration does not resurrect new demo events deleted after the upgrade", async () => {
  const storage = demo(JSON.stringify({ events: [] }));
  const snapshot = JSON.parse(storage.snapshot());
  snapshot.events = snapshot.events.filter(event => event.id !== 2001);
  const restored = demo(JSON.stringify(snapshot));
  assert.equal((await restored.api.listEvents()).items.length, 19);
});

test("a full localStorage does not discard the existing user snapshot", async () => {
  const user = { id: 777, firstName: "Анна" };
  const { api } = demo(JSON.stringify({ user, events: [] }), true);
  assert.deepEqual(await api.getCurrentUser(), user);
  assert.equal((await api.listEvents()).items.length, 20);
});

test("new mapped events are included in city and geographic searches", async () => {
  const { api } = demo();
  const { items } = await api.listEvents({ cityId: 4, west: 60.5, east: 60.7, south: 56.7, north: 57 });
  assert.equal(items.filter(event => event.id >= 2001 && event.id <= 2020).length, 1);
});

test("version-one snapshots relocate the old Moscow seeds but preserve user edits and deleted events", async () => {
  const events = (await demo().api.listEvents()).items;
  const oldMoscowEvent = {
    ...events.find(event => event.id === 2004), cityId: 1, title: "Мой заголовок", participantsCount: 99,
    locationName: "Парк Сокольники", location: { latitude: 55.7948, longitude: 37.6765, source: "manual" },
    startsAt: "2026-11-04T18:00:00+03:00", endsAt: "2026-11-04T21:00:00+03:00",
  };
  const editedVenue = { ...events.find(event => event.id === 2002), locationName: "Моё место", cityId: 1 };
  const favoritesByUser = { 777: [{ eventId: 2004, savedAt: "2026-10-17" }] };
  const storage = demo(JSON.stringify({ mapEventsSeedVersion: 1, events: [oldMoscowEvent, editedVenue], favoritesByUser }));
  const migrated = JSON.parse(storage.snapshot());
  assert.equal(migrated.mapEventsSeedVersion, 3);
  assert.equal(migrated.events.length, 2, "deleted demo events must not come back");
  const moved = migrated.events.find(event => event.id === 2004);
  assert.equal(moved.cityId, 6);
  assert.equal(moved.location.longitude, 82.9364);
  assert.equal(moved.title, "Мой заголовок");
  assert.equal(moved.participantsCount, 99);
  assert.match(moved.startsAt, /\+07:00$/);
  assert.deepEqual(migrated.events.find(event => event.id === 2002), editedVenue);
  assert.deepEqual(migrated.favoritesByUser, favoritesByUser);
});

test("content upgrade replaces repeated seed photos and short descriptions without overwriting custom content", async () => {
  const current = (await demo().api.listEvents()).items;
  const originalImage = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&h=700&fit=crop&auto=format";
  const old = { ...current.find(event => event.id === 2001), description: "Знакомимся за чашкой кофе и делимся планами на выходные.", imageUrl: originalImage };
  const customText = { ...current.find(event => event.id === 2002), description: "Моё описание встречи", imageUrl: originalImage };
  const customPhoto = { ...old, id: 2008, description: "Практикуем язык в дружеской компании. Ошибаться можно и нужно.", imageUrl: "https://example.com/my-photo.jpg" };
  const favoritesByUser = { 777: [{ eventId: 2001, savedAt: "2026-10-17" }] };
  const storage = demo(JSON.stringify({ mapEventsSeedVersion: 2, events: [old, customText, customPhoto], favoritesByUser }));
  const migrated = JSON.parse(storage.snapshot());
  assert.equal(migrated.mapEventsSeedVersion, 3);
  assert.equal(migrated.events.length, 3);
  assert.deepEqual(migrated.favoritesByUser, favoritesByUser);
  const updated = migrated.events.find(event => event.id === 2001);
  assert.notEqual(updated.description, old.description);
  assert.notEqual(updated.imageUrl, old.imageUrl);
  assert.deepEqual(updated.location, old.location);
  assert.equal(migrated.events.find(event => event.id === 2002).description, customText.description);
  assert.notEqual(migrated.events.find(event => event.id === 2002).imageUrl, originalImage);
  assert.equal(migrated.events.find(event => event.id === 2008).imageUrl, customPhoto.imageUrl);
  assert.notEqual(migrated.events.find(event => event.id === 2008).description, customPhoto.description);
  assert.deepEqual((await demo(storage.snapshot()).api.listEvents()).items.map(event => event.id).sort(), [2001, 2002, 2008]);
});
