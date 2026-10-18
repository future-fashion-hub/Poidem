import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import ts from "typescript"

const load = (path) => {
  const exports = {}
  const code = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText
  new Function("require", "exports", code)(
    (name) => load(`${name}.ts`),
    exports,
  )
  return exports
}
const { routeDestination, directionLinks } = load("./eventDirections.ts")
const event = {
  location: { latitude: 59.9251, longitude: 30.2414 },
  locationName: "Севкабель Порт",
  address: "Кожевенная линия, 40",
}

test("directions prefer the actual event pin over its address and never swap latitude/longitude", () => {
  const destination = routeDestination(event, "Санкт-Петербург")
  assert.equal(destination.exact, true)
  assert.equal(destination.value, "59.9251,30.2414")
  assert.equal(
    destination.label,
    "Санкт-Петербург, Севкабель Порт, Кожевенная линия, 40",
  )
  const links = directionLinks(destination, "walking").map(
    (link) => new URL(link.href),
  )
  assert.equal(links[0].searchParams.get("rtext"), "~59.9251,30.2414")
  assert.equal(links[1].searchParams.get("destination"), destination.value)
  assert.equal(links[2].searchParams.get("destination"), destination.value)
})

test("every travel mode maps to the documented provider parameters", () => {
  for (const [mode, rtt] of [
    ["walking", "pd"],
    ["transit", "mt"],
    ["driving", "auto"],
  ]) {
    const links = directionLinks(routeDestination(event), mode).map(
      (link) => new URL(link.href),
    )
    assert.equal(links[0].searchParams.get("rtt"), rtt)
    assert.equal(links[1].searchParams.get("api"), "1")
    assert.equal(links[1].searchParams.get("travelmode"), mode)
    assert.equal(links[2].pathname, "/directions")
    assert.equal(links[2].searchParams.get("mode"), mode)
    assert.ok(links.every((url) => url.protocol === "https:"))
  }
})

test("missing and invalid pins use city-qualified address rather than a fabricated city-centre coordinate", () => {
  for (const location of [
    null,
    { latitude: NaN, longitude: 30 },
    { latitude: 91, longitude: 30 },
    { latitude: 55, longitude: 181 },
    { latitude: "", longitude: 30 },
  ]) {
    const destination = routeDestination(
      { ...event, location },
      " Санкт-Петербург ",
    )
    assert.equal(destination.exact, false)
    assert.equal(destination.value, "Санкт-Петербург, Кожевенная линия, 40")
  }
  assert.equal(
    routeDestination(
      { ...event, location: null, address: null },
      "Санкт-Петербург",
    ).value,
    "Санкт-Петербург, Севкабель Порт",
  )
  assert.equal(
    routeDestination(
      { location: null, address: "", locationName: "" },
      "Москва",
    ),
    null,
  )
  assert.equal(routeDestination({ ...event, location: null }), null)
})

test("zero, negative and older numeric-string coordinates remain valid", () => {
  assert.equal(
    routeDestination({ ...event, location: { latitude: 0, longitude: 0 } })
      .value,
    "0,0",
  )
  assert.equal(
    routeDestination({
      ...event,
      location: { latitude: "-33.86", longitude: "151.21" },
    }).value,
    "-33.86,151.21",
  )
})

test("Cyrillic and reserved characters stay inside destination parameters with no query injection", () => {
  const destination = routeDestination(
    {
      location: null,
      locationName: "Кафе",
      address: "улица A & B, 5?x=1#вход",
    },
    "Москва",
  )
  for (const link of directionLinks(destination, "transit")) {
    const url = new URL(link.href)
    assert.equal(url.hash, "")
    assert.equal(url.searchParams.has("x"), false)
    const query = url.searchParams.get(
      link.id === "yandex" ? "rtext" : "destination",
    )
    assert.equal(
      query,
      `${link.id === "yandex" ? "~" : ""}${destination.value}`,
    )
    assert.equal(url.username, "")
    assert.equal(url.password, "")
  }
})

test("route links do not include origin, auth or application state", () => {
  for (const link of directionLinks(routeDestination(event), "walking")) {
    const url = new URL(link.href)
    for (const name of ["origin", "source", "access_token", "token", "userId"])
      assert.equal(url.searchParams.has(name), false)
    assert.ok(
      ["yandex.ru", "www.google.com", "maps.apple.com"].includes(url.hostname),
    )
  }
})
