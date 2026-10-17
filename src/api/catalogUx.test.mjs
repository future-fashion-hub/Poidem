import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function load(path) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function("exports", code)(exports);
  return exports;
}
const { countLabel } = load("./russianCount.ts");
const { soloEventIds, mergeEvent } = load("./eventParticipation.ts");
const { publicDictionary, publicEvents } = load("./publicCatalog.ts");

test("Russian counts use the correct forms at 0, 1, 2, 5, 11 and 21", () => {
  for (const [unit, forms] of Object.entries({ events: ["событий", "событие", "события", "событий", "событий", "событие"], companies: ["компаний", "компания", "компании", "компаний", "компаний", "компания"], members: ["участников", "участник", "участника", "участников", "участников", "участник"] })) {
    [0, 1, 2, 5, 11, 21].forEach((n, i) => assert.equal(countLabel(n, unit), `${n} ${forms[i]}`));
  }
});
test("solo state excludes company members and authors without participation", () => {
  const mine = [{ id: 1, relation: "participant" }, { id: 2, relation: "creator" }, { id: 3, relation: "creator_and_participant" }, { id: 4, relation: "participant" }, { id: 5 }];
  assert.deepEqual(soloEventIds(mine, [{ eventId: 4 }]), [1, 3]);
  assert.deepEqual(soloEventIds(mine, [{ eventId: 4, status: "blocked" }]), [1, 3, 4]);
});
test("fresh server counters replace only the matching catalog entity", () => {
  const before = [{ id: 1, participantsCount: 1, companiesCount: 1 }, { id: 2, participantsCount: 5 }];
  const after = mergeEvent(before, { id: 1, participantsCount: 2, companiesCount: 2 });
  assert.equal(after[0].participantsCount, 2);
  assert.equal(after[0].companiesCount, 2);
  assert.equal(after[1], before[1]);
  assert.equal(before[0].participantsCount, 1);
});
test("technical dictionaries and their events are hidden without replacing real content", () => {
  assert.deepEqual(publicDictionary([{ id: 1, name: "Москва", slug: "moscow" }, { id: 2, name: "Map test city", slug: "map-test-city" }]).map(x => x.id), [1]);
  const events = [{ id: 1, title: "Встреча", cityId: 1, categoryId: 1 }, { id: 2, title: "Название", cityId: 2, categoryId: 1 }, { id: 3, title: "Название", cityId: 1, categoryId: 2 }, { id: 4, title: "Test event 42", cityId: 1, categoryId: 1 }];
  assert.deepEqual(publicEvents(events, new Set([2]), new Set([2])).map(x => x.id), [1]);
});
