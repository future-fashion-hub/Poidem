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
  assert.equal(new Set(added.map(event => `${event.location.latitude},${event.location.longitude}`)).size, 20);
  for (const event of added) {
    assert.equal(event.status, "active");
    assert.ok(Math.abs(event.location.latitude) <= 90 && Math.abs(event.location.longitude) <= 180);
    assert.ok(dictionaries.cities.some(city => city.id === event.cityId));
    assert.ok(dictionaries.categories.some(category => category.id === event.categoryId));
    assert.match(event.imageUrl, /^https:\/\/images\.unsplash\.com\//);
    assert.ok(event.description && event.locationName);
    assert.ok(Date.parse(event.endsAt) > Date.parse(event.startsAt));
    assert.ok(Date.parse(event.startsAt) > Date.parse("2026-10-17"));
  }
  for (const cityId of [1, 2, 3, 4]) assert.equal(added.filter(event => event.cityId === cityId).length, 5);
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
  assert.equal(items.filter(event => event.id >= 2001 && event.id <= 2020).length, 5);
});
