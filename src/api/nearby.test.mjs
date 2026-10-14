import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Run the real TypeScript helpers with Node's built-in test runner, without
// adding a browser or a second bundler to this Vite project.
function loadTypeScript(path) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function("require", "exports", "module", code)(name => loadTypeScript(resolve(dirname(path), `${name}.ts`)), module.exports, module);
  return module.exports;
}
const { distanceKm, nearbyBounds, nearbyEvents, createShakeDetector } = loadTypeScript(fileURLToPath(new URL("./nearby.ts", import.meta.url)));
const point = { latitude: 55.75, longitude: 37.61 };

function locationService(getCurrentPosition, secure = true) {
  const module = { exports: {} };
  const source = readFileSync(new URL("./nearbyPermissions.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function("window", "navigator", "exports", "module", code)(
    { isSecureContext: secure }, { geolocation: { getCurrentPosition } }, module.exports, module,
  );
  return module.exports.getNearbyLocation;
}

test("startup and first search share a permission request and reuse the position", async () => {
  let calls = 0;
  let complete;
  const locate = locationService(resolve => { calls++; complete = resolve; });
  const startup = locate();
  assert.equal(locate(), startup);
  const position = { coords: { latitude: 55.75, longitude: 37.61, accuracy: 20 } };
  complete(position);
  assert.equal(await startup, position);
  assert.equal(await locate(), position);
  assert.equal(calls, 1);
  const refresh = locate(true);
  assert.equal(calls, 2);
  complete(position);
  await refresh;
});

test("denied location can be retried, and insecure origins never ask permission", async () => {
  let calls = 0;
  const locate = locationService((_resolve, reject) => { calls++; reject({ code: 1 }); });
  await assert.rejects(locate(), /Доступ к геопозиции закрыт/);
  await assert.rejects(locate(), /Доступ к геопозиции закрыт/);
  assert.equal(calls, 2);
  const insecure = locationService(() => { throw new Error("must not request"); }, false);
  await assert.rejects(insecure(), /HTTPS/);
});

test("distance uses geographic coordinates, including the antimeridian", () => {
  assert.equal(distanceKm(point, point), 0);
  const parisLondon = distanceKm({ latitude: 48.8566, longitude: 2.3522 }, { latitude: 51.5074, longitude: -0.1278 });
  assert.ok(parisLondon > 343 && parisLondon < 344);
  const crossing = distanceKm({ latitude: 0, longitude: 179 }, { latitude: 0, longitude: -179 });
  assert.ok(crossing > 222 && crossing < 223);
});

test("server bounds remain valid near the pole and date line", () => {
  const ordinary = nearbyBounds(point, 10);
  assert.ok(ordinary.west < point.longitude && ordinary.east > point.longitude);
  assert.ok(ordinary.south < point.latitude && ordinary.north > point.latitude);
  const polar = nearbyBounds({ latitude: 89.99, longitude: 0 }, 10);
  assert.equal(polar.north, 90);
  assert.equal(polar.west, -180);
  assert.equal(polar.east, 180);
  const crossing = nearbyBounds({ latitude: 0, longitude: 179.99 }, 10);
  assert.ok(crossing.west > crossing.east);
});

test("nearby collection excludes hidden, ended, unlocated and distant events; sorts by distance", () => {
  const now = Date.parse("2026-10-14T12:00:00Z");
  const event = (id, changes = {}) => ({ id, status: "active", startsAt: "2026-10-20T12:00:00Z", endsAt: null, location: point, ...changes });
  const items = [
    event(1, { location: { latitude: 55.76, longitude: 37.61 } }), event(2),
    event(3, { status: "blocked" }), event(4, { startsAt: "2026-10-01T12:00:00Z" }),
    event(5, { location: null }), event(6, { location: { latitude: 0, longitude: 0 } }),
    event(7, { startsAt: "invalid" }),
    event(8, { startsAt: "2026-10-14T11:00:00Z", endsAt: "2026-10-14T13:00:00Z" }),
    event(9, { location: { latitude: 95, longitude: 37.61 } }),
  ];
  assert.deepEqual(nearbyEvents(items, point, 5, now).map(item => item.event.id), [8, 2, 1]);
});

test("normal handling and missing sensor samples do not count as shaking", () => {
  const detect = createShakeDetector();
  assert.equal(detect({ x: null, y: null, z: null }, 0), false);
  for (let time = 0; time < 2000; time += 20) assert.equal(detect({ x: Math.sin(time / 100), y: 0, z: 9.8 }, time), false);
});

test("intentional shake needs three impulses and has a cooldown", () => {
  const detect = createShakeDetector();
  assert.equal(detect({ x: 0, y: 0, z: 9.8 }, 0), false);
  assert.equal(detect({ x: 20, y: 0, z: 9.8 }, 100), false);
  assert.equal(detect({ x: -20, y: 0, z: 9.8 }, 200), false);
  assert.equal(detect({ x: 20, y: 0, z: 9.8 }, 300), true);
  for (let time = 400; time < 4300; time += 100) assert.equal(detect({ x: time % 200 ? 20 : -20, y: 0, z: 9.8 }, time), false);
  assert.equal(detect({ x: 20, y: 0, z: 9.8 }, 4300), false);
  assert.equal(detect({ x: -20, y: 0, z: 9.8 }, 4400), false);
  assert.equal(detect({ x: 20, y: 0, z: 9.8 }, 4500), true);
  assert.equal(detect({ x: -20, y: 0, z: 9.8 }, 4600), false);
});
