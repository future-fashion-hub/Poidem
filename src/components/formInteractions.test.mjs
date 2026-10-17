import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Exercise the real component callbacks without a browser or network requests.
function pureModule(path) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function("exports", code)(exports);
  return exports;
}

function componentHarness(path, modules = {}, environment = {}) {
  const states = [], effects = [];
  const storage = new Map(Object.entries(environment.storage ?? {})), timers = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], next => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
    },
    useRef(current) {
      const index = cursor++;
      if (!(index in states)) states[index] = { current };
      return states[index];
    },
    useId: () => "test-picker",
    useMemo: factory => factory(),
    useCallback: callback => callback,
    useEffect: effect => effects.push(effect),
    useLayoutEffect: effect => effects.push(effect),
    lazy: () => function Lazy() {},
  };
  const jsx = (type, props) => ({ type, props });
  const window = {
    location: { hash: environment.hash ?? "#feed", search: "" },
    setTimeout: callback => { timers.push(callback); return timers.length; },
    clearTimeout: () => {},
    matchMedia: () => ({ matches: false }),
  };
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const componentCode = code + (environment.component ? `\nexports.default = ${environment.component};` : "");
  new Function("require", "exports", "window", "localStorage", "setTimeout", "clearTimeout", "document", componentCode)(name => {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
    if (name in modules) return modules[name];
    if (name === "react-dom") return { createPortal: node => node };
    const utilities = { "./api/publicCatalog": "../api/publicCatalog.ts", "./api/eventParticipation": "../api/eventParticipation.ts", "./api/russianCount": "../api/russianCount.ts", "../api/russianCount": "../api/russianCount.ts", "./api/types": "../api/types.ts" };
    if (name in utilities) return pureModule(utilities[name]);
    return { __esModule: true, default: name };
  }, exports, window, { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }, callback => { timers.push(callback); return timers.length; }, () => {}, { visibilityState: "visible", body: {} });
  return {
    render(props) { cursor = 0; effects.length = 0; return exports.default(props); },
    runEffects() { return effects.map(effect => effect()).filter(Boolean); },
    runEffectContaining(text) { return effects.find(effect => effect?.toString().includes(text))?.(); },
    async runTimers() { for (const callback of timers.splice(0)) await callback(); },
    storage,
  };
}

function find(node, predicate) {
  if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
  if (!node || typeof node !== "object") return undefined;
  return predicate(node) ? node : find(node.props?.children, predicate);
}
const getComponent = (tree, name) => find(tree, node => node.type === name || node.type?.name === name);
const flush = () => new Promise(resolve => setImmediate(resolve));

for (const readyBeforeRef of [true, false]) test(`globe always locks zoom and restores its intended scale (readyBeforeRef=${readyBeforeRef})`, () => {
  const harness = componentHarness("./Globe.tsx", {
    "react-globe.gl": { __esModule: true, default: "ReactGlobe" },
    "topojson-client": { feature: () => ({ features: [] }) },
    "world-atlas/countries-110m.json": { objects: { countries: {} } },
  });
  const controls = { enableZoom: true, enablePan: true };
  let view = { altitude: 2.5 }, paused = false;
  const globe = { controls: () => controls, pointOfView: next => { view = next; }, pauseAnimation: () => { paused = true; }, resumeAnimation: () => { paused = false; } };
  const node = getComponent(harness.render({ paused: true }), "ReactGlobe");
  if (readyBeforeRef) node.props.onGlobeReady();
  if (typeof node.props.ref === "function") node.props.ref(globe); else node.props.ref.current = globe;
  harness.runEffectContaining("configureGlobe");
  if (!readyBeforeRef) node.props.onGlobeReady();
  assert.equal(controls.enableZoom, false);
  assert.equal(controls.enablePan, false);
  assert.equal(controls.enableRotate, true);
  assert.deepEqual(view, { lat: 51, lng: 46, altitude: 1.65 });
  assert.equal(paused, true);
});

for (const soloJoined of [false, true]) test(`solo button has aligned layout and distinct color/icon state (joined=${soloJoined})`, () => {
  const harness = componentHarness("../App.tsx", {
    "./components/usePopupDismiss": { usePopupDismiss: () => ({ closing: false, dismiss() {} }) },
    "./components/useModalDialog": { useModalDialog() {} },
  }, { component: "EventDrawer" });
  let clicks = 0;
  const props = {
    event: { id: 42, title: "Встреча", startsAt: "2026-11-01T12:00:00+03:00", participantsCount: 3 },
    companies: [], joinedCompanyIds: [], soloJoined, soloLoading: false, soloSaving: false, membershipError: "",
    onSolo: () => clicks++, onCreate() {}, onClose() {}, onJoin() {}, onReloadParticipation() {},
  };
  const tree = harness.render(props);
  const actions = find(tree, node => node.props?.className === "event-modal-actions");
  assert.equal(actions.props.children.length, 2);
  assert.ok(actions.props.children.every(child => child.type === "button"), "status text must not stretch the other button");
  const button = actions.props.children[0];
  assert.equal(button.props["data-joined"], soloJoined);
  assert.equal(button.props.children[0].props.name, soloJoined ? "close" : "check");
  assert.equal(button.props.children[1], soloJoined ? "Отменить участие" : "Пойду самостоятельно");
  button.props.onClick(); assert.equal(clicks, 1);
  assert.equal(Boolean(find(tree, node => node.props?.className === "event-solo-status")), soloJoined);
});

for (const includeTime of [false, true]) {
  test(`calendar stays open after selection and clearing; Done closes it (includeTime=${includeTime})`, () => {
    const harness = componentHarness("./SiteDatePicker.tsx", {
      "@daypicker/react": { DayPicker: "DayPicker" },
      "./dateTimeValue": { pickerTime: value => value.slice(11, 16) },
    });
    const props = { value: "", includeTime, onChange: next => { props.value = next; } };
    let tree = harness.render(props);
    find(tree, node => node.props?.className === "site-date-trigger").props.onClick();
    tree = harness.render(props);
    find(tree, node => node.type === "DayPicker").props.onSelect(new Date(2026, 9, 15));
    assert.equal(props.value, includeTime ? "2026-10-15T12:00" : "2026-10-15");
    tree = harness.render(props);
    assert.ok(find(tree, node => node.type === "DayPicker"));
    // Reopening the trigger must not accidentally dismiss an unfinished choice.
    find(tree, node => node.props?.className === "site-date-trigger").props.onClick();
    tree = harness.render(props);
    assert.ok(find(tree, node => node.type === "DayPicker"));
    find(tree, node => node.type === "button" && node.props.children === "Очистить").props.onClick();
    tree = harness.render(props);
    assert.equal(props.value, "");
    assert.ok(find(tree, node => node.type === "DayPicker"));
    find(tree, node => node.props?.className === "site-date-done").props.onClick();
    tree = harness.render(props);
    assert.equal(find(tree, node => node.type === "DayPicker"), undefined);
  });
}

for (const method of ["password", "social", "login"]) {
  test(`${method}: guest company creation cannot reopen the event over profile setup`, async () => {
    const user = { id: 1, firstName: "", interests: [], isProfileComplete: false };
    const harness = componentHarness("../App.tsx", {
      "./api": { api: {
        listEventCompanies: async () => ({ items: [] }),
        getEvent: async id => ({ id, title: "Event" }),
        registerWithPassword: async () => ({ user }),
        register: async () => ({ user }),
        loginWithPassword: async () => ({ user }),
      } },
      "./api/backendApi": { backendMode: false },
      "./api/pagination": { collectPages: fetch => fetch({}) },
    });
    const get = (tree, name) => find(tree, node => node.type === name || node.type?.name === name);
    let tree = harness.render();
    await get(tree, "./components/EventFeed").props.onOpen({ id: 42, title: "Event" });
    tree = harness.render();
    get(tree, "EventDrawer").props.onCreate();
    tree = harness.render();
    assert.equal(get(tree, "CreateCompanyModal"), undefined);
    const auth = get(tree, "AuthModal");
    if (method === "login") {
      await auth.props.onAdminLogin("guest", "password");
    } else {
      auth.props.onRegister();
      tree = harness.render();
      const registration = get(tree, "./components/RegisterModal");
      if (method === "password") await registration.props.onPasswordRegister("guest", "password");
      else await registration.props.onRegister("google");
    }
    tree = harness.render();
    const onboarding = get(tree, "./components/Onboarding");
    assert.ok(onboarding);
    assert.equal(get(tree, "EventDrawer"), undefined);
    assert.equal(get(tree, "AuthModal"), undefined);
    assert.equal(get(tree, "./components/RegisterModal"), undefined);
    assert.equal(find(tree, node => node.props?.className === "app-background").props.inert, undefined);
    onboarding.props.onComplete({ ...user, isProfileComplete: true });
    tree = harness.render();
    assert.ok(get(tree, "./components/UserDashboard"));
    assert.equal(get(tree, "EventDrawer"), undefined);
  });
}

test("password login preserves the feed and selected event without joining automatically", async () => {
  let mutations = 0;
  const user = { id: 1, firstName: "Анна", interests: [], isProfileComplete: true };
  const event = { id: 42, title: "Встреча", participantsCount: 3, companiesCount: 1 };
  const harness = componentHarness("../App.tsx", {
    "./api": { api: { getEvent: async () => event, listEventCompanies: async () => ({ items: [] }), loginWithPassword: async () => ({ user }), joinEventSolo: async () => { mutations++; } } },
    "./api/backendApi": { backendMode: false }, "./api/pagination": { collectPages: fetch => fetch({}) },
  });
  let tree = harness.render();
  await getComponent(tree, "./components/EventFeed").props.onOpen(event);
  tree = harness.render();
  getComponent(tree, "EventDrawer").props.onSolo();
  tree = harness.render();
  await getComponent(tree, "AuthModal").props.onAdminLogin("anna", "password");
  tree = harness.render();
  assert.ok(getComponent(tree, "./components/EventFeed"));
  assert.equal(getComponent(tree, "EventDrawer").props.event.id, 42);
  assert.equal(getComponent(tree, "HomeHero"), undefined);
  assert.equal(mutations, 0);
});

test("solo participation restores from server and cancellation updates drawer counters", async () => {
  let joined = true, mutations = 0;
  const user = { id: 1, firstName: "Анна", interests: [], isProfileComplete: true };
  const event = () => ({ id: 42, title: "Встреча", participantsCount: joined ? 4 : 3, companiesCount: 1 });
  const harness = componentHarness("../App.tsx", {
    "./api": { api: {
      getEvent: async () => event(), listEventCompanies: async () => ({ items: [] }), loginWithPassword: async () => ({ user }),
      listMyEvents: async () => ({ items: joined ? [{ ...event(), relation: "participant" }] : [] }), listMyCompanies: async () => ({ items: [] }),
      cancelEventSolo: async () => { joined = false; mutations++; },
    } }, "./api/backendApi": { backendMode: false }, "./api/pagination": { collectPages: fetch => fetch({}) },
  });
  let tree = harness.render();
  getComponent(tree, "Header").props.onAuth();
  tree = harness.render();
  await getComponent(tree, "AuthModal").props.onAdminLogin("anna", "password");
  tree = harness.render();
  harness.runEffectContaining("refreshParticipation");
  await flush();
  tree = harness.render();
  await getComponent(tree, "./components/EventFeed").props.onOpen(event());
  tree = harness.render();
  assert.equal(getComponent(tree, "EventDrawer").props.soloJoined, true);
  getComponent(tree, "EventDrawer").props.onSolo();
  await flush();
  tree = harness.render();
  assert.equal(mutations, 1);
  assert.equal(getComponent(tree, "EventDrawer").props.soloJoined, false);
  assert.equal(getComponent(tree, "EventDrawer").props.event.participantsCount, 3);
});

for (const initiallyJoined of [false, true]) for (const refreshFails of [false, true]) {
  test(`confirmed solo mutation survives stale reads and refresh errors (initiallyJoined=${initiallyJoined}, refreshFails=${refreshFails})`, async () => {
    let mutations = 0, membershipReads = 0, detailReads = 0, finishMutation;
    const user = { id: 1, firstName: "Анна", interests: [], isProfileComplete: true };
    const event = { id: 42, title: "Встреча", participantsCount: 3, companiesCount: 1 };
    const mutation = () => { mutations++; return new Promise(resolve => { finishMutation = resolve; }); };
    const harness = componentHarness("../App.tsx", {
      "./api": { api: {
        getEvent: async () => { if (++detailReads === 2 && refreshFails) throw new Error("Refresh failed"); return event; },
        listEventCompanies: async () => ({ items: [] }), loginWithPassword: async () => ({ user }),
        // A list response may still reflect the state before the successful write.
        listMyEvents: async () => { membershipReads++; return { items: initiallyJoined ? [{ ...event, relation: "participant" }] : [] }; },
        listMyCompanies: async () => ({ items: [] }), joinEventSolo: mutation, cancelEventSolo: mutation,
      } }, "./api/backendApi": { backendMode: false }, "./api/pagination": { collectPages: fetch => fetch({}) },
    });
    let tree = harness.render();
    getComponent(tree, "Header").props.onAuth();
    tree = harness.render();
    await getComponent(tree, "AuthModal").props.onAdminLogin("anna", "password");
    tree = harness.render();
    harness.runEffectContaining("refreshParticipation"); await flush();
    tree = harness.render();
    await getComponent(tree, "./components/EventFeed").props.onOpen(event);
    tree = harness.render();
    assert.equal(getComponent(tree, "EventDrawer").props.soloJoined, initiallyJoined);
    getComponent(tree, "EventDrawer").props.onSolo();
    getComponent(tree, "EventDrawer").props.onSolo();
    tree = harness.render();
    assert.equal(getComponent(tree, "EventDrawer").props.soloSaving, true);
    assert.equal(mutations, 1, "a repeated click must not submit twice");
    finishMutation(); await flush();
    tree = harness.render();
    assert.equal(getComponent(tree, "EventDrawer").props.soloSaving, false);
    assert.equal(getComponent(tree, "EventDrawer").props.soloJoined, !initiallyJoined);
    assert.equal(membershipReads, 1, "do not overwrite a confirmed write with a list read");
    // Closing and reopening the same event preserves the confirmed button state.
    getComponent(tree, "EventDrawer").props.onClose();
    tree = harness.render();
    await getComponent(tree, "./components/EventFeed").props.onOpen(event);
    tree = harness.render();
    assert.equal(getComponent(tree, "EventDrawer").props.soloJoined, !initiallyJoined);
  });
}

test("replay restores an all-saved feed without losing guest favorites, including skip and undo", async () => {
  const event = { id: 42, title: "Кофе и настолки", startsAt: "2026-11-01T12:00:00+03:00", status: "active", participantsCount: 1, companiesCount: 1 };
  const harness = componentHarness("./EventFeed.tsx", { "../api": { backendMode: false, api: {} } }, {
    storage: { "poidem-event-feed-actions:demo:guest": JSON.stringify({ 42: "save" }) },
  });
  const props = { userId: null, events: [event], categories: [], cities: [], onOpen() {}, favoritesOpen: false, onFavoritesChange() {} };
  let tree = harness.render(props);
  assert.equal(find(tree, node => node.type === "article"), undefined);
  find(tree, node => node.type === "button" && node.props.children === "Посмотреть заново").props.onClick();
  tree = harness.render(props);
  assert.ok(find(tree, node => node.type === "article"));
  find(tree, node => node.props?.className === "swipe-action swipe-action--skip").props.onClick();
  await harness.runTimers();
  tree = harness.render(props);
  assert.equal(find(tree, node => node.type === "article"), undefined);
  assert.equal(JSON.parse(harness.storage.get("poidem-event-feed-actions:demo:guest"))[42], "save");
  await find(tree, node => node.props?.className === "swipe-action swipe-action--undo").props.onClick();
  tree = harness.render(props);
  assert.ok(find(tree, node => node.type === "article"));
  assert.equal(JSON.parse(harness.storage.get("poidem-event-feed-actions:demo:guest"))[42], "save");
});

test("home filters expose text, city and category with independent clearing", () => {
  const harness = componentHarness("./CatalogFilters.tsx");
  const changes = [];
  const tree = harness.render({ search: "джаз", cityId: 1, categoryId: 2, cities: [{ id: 1, name: "Москва" }], categories: [{ id: 2, name: "Музыка" }], onSearch: value => changes.push(["search", value]), onCity: value => changes.push(["city", value]), onCategory: value => changes.push(["category", value]), onReset: () => changes.push(["reset"]) });
  find(tree, node => node.props?.type === "search").props.onChange({ target: { value: "кофе" } });
  find(tree, node => node.props?.id === "test-picker-city" && node.type === "./SiteSelect").props.onChange("3");
  find(tree, node => node.props?.id === "test-picker-category" && node.type === "./SiteSelect").props.onChange("4");
  find(tree, node => node.props?.className === "catalog-reset").props.onClick();
  assert.deepEqual(changes, [["search", "кофе"], ["city", 3], ["category", 4], ["reset"]]);
});

test("site startup requests location automatically and tolerates permission denial", async () => {
  let calls = 0;
  const harness = componentHarness("../App.tsx", {
    "./api/nearbyPermissions": { getNearbyLocation: async () => { calls++; throw new Error("Permission denied"); } },
  });
  harness.render();
  harness.runEffectContaining("getNearbyLocation");
  await flush();
  assert.equal(calls, 1);
});

test("nearby locates on opening and shows no duplicate error buttons; toolbar refresh retries", async () => {
  let calls = 0;
  const props = { open: false, suspended: false, categories: [], onOpenChange: open => { props.open = open; }, onOpenEvent() {} };
  const harness = componentHarness("./NearbyEvents.tsx", {
    "./usePopupDismiss": { usePopupDismiss: () => ({ closing: false, dismiss() {} }) },
    "./useModalDialog": { useModalDialog() {} },
    "../api/nearbyPermissions": { getNearbyLocation: async () => { calls++; throw new Error("Разрешите геолокацию в браузере"); } },
  });
  let tree = harness.render(props);
  find(tree, node => node.props?.className === "nearby-trigger").props.onClick({ detail: 1 });
  await flush();
  tree = harness.render(props);
  assert.equal(calls, 1);
  const error = find(tree, node => node.props?.className === "nearby-state");
  assert.ok(find(error, node => node.props?.role === "alert"));
  assert.equal(find(error, node => node.type === "button"), undefined);
  find(tree, node => node.props?.className === "nearby-refresh").props.onClick();
  await flush();
  assert.equal(calls, 2);
});

test("company creation refreshes both the event drawer and the background feed", async () => {
  let companyCount = 1;
  const user = { id: 1, firstName: "Анна", interests: [], isProfileComplete: true };
  const event = () => ({ id: 42, title: "Встреча", participantsCount: companyCount, companiesCount: companyCount });
  const harness = componentHarness("../App.tsx", {
    "./api": { api: {
      listEvents: async () => ({ items: [event()] }), getEvent: async () => event(),
      listEventCompanies: async () => ({ items: [{ id: 7, eventId: 42 }] }),
      loginWithPassword: async () => ({ user }), listMyEvents: async () => ({ items: [] }), listMyCompanies: async () => ({ items: [] }),
    } }, "./api/backendApi": { backendMode: false }, "./api/pagination": { collectPages: fetch => fetch({}) },
  });
  let tree = harness.render();
  harness.runEffectContaining("listEvents");
  await harness.runTimers(); await flush();
  tree = harness.render();
  assert.equal(getComponent(tree, "./components/EventFeed").props.events[0].companiesCount, 1);
  getComponent(tree, "Header").props.onAuth();
  tree = harness.render();
  await getComponent(tree, "AuthModal").props.onAdminLogin("anna", "password");
  tree = harness.render();
  await getComponent(tree, "./components/EventFeed").props.onOpen(event());
  tree = harness.render();
  getComponent(tree, "EventDrawer").props.onCreate();
  tree = harness.render();
  companyCount = 2;
  await getComponent(tree, "CreateCompanyModal").props.onCreated();
  tree = harness.render();
  assert.equal(getComponent(tree, "EventDrawer").props.event.companiesCount, 2);
  assert.equal(getComponent(tree, "./components/EventFeed").props.events[0].companiesCount, 2);
});

for (const scenario of ["empty", "denied", "nearby_request_error", "found", "catalogue_error", "all_empty"]) test(`nearby falls back to the full catalogue only when needed (${scenario})`, async () => {
  const requests = [];
  const event = { id: 42, title: "Встреча", startsAt: "2099-11-01T18:00:00+03:00", endsAt: null, status: "active", locationName: "Место" };
  const catalogue = [event, { ...event, id: 43, title: "Событие без координат", location: null }, { ...event, id: 44, status: "pending" }, { ...event, id: 45, endsAt: "2000-01-01" }, { ...event, id: 46, title: "Скрытое" }];
  const props = { open: false, suspended: false, categories: [], onOpenChange: open => { props.open = open; }, onOpenEvent() {}, isPublicEvent: item => item.id !== 46 };
  const harness = componentHarness("./NearbyEvents.tsx", {
    "./usePopupDismiss": { usePopupDismiss: () => ({ closing: false, dismiss() {} }) },
    "./useModalDialog": { useModalDialog() {} },
    "../api/nearbyPermissions": { getNearbyLocation: async () => { if (scenario === "denied") throw new Error("Denied"); return { coords: { latitude: 55, longitude: 37, accuracy: 10 } }; } },
    "../api/pagination": { collectPages: fetch => fetch({}) },
    "../api": { api: { listEvents: async filters => {
      requests.push(filters);
      if (filters.west !== undefined && scenario === "nearby_request_error") throw new Error("Nearby unavailable");
      if (filters.west === undefined && scenario === "catalogue_error") throw new Error("Не удалось загрузить афишу");
      if (scenario === "all_empty") return { items: [] };
      return { items: filters.west !== undefined ? [] : catalogue };
    } } },
    "../api/nearby": { nearbyBounds: () => ({ west: 36, east: 38, south: 54, north: 56 }), nearbyEvents: () => scenario === "found" ? [{ event, distance: 2.5 }] : [], distanceLabel: value => `${value} км` },
  });
  let tree = harness.render(props);
  find(tree, node => node.props?.className === "nearby-trigger").props.onClick({ detail: 1 });
  await flush();
  tree = harness.render(props);
  if (scenario === "catalogue_error") {
    assert.equal(find(tree, node => node.props?.role === "alert").props.children, "Не удалось загрузить афишу");
    assert.equal(find(tree, node => node.props?.className === "nearby-refresh").props.disabled, false);
    return;
  }
  if (scenario === "all_empty") {
    assert.ok(find(tree, node => node.type === "h3" && node.props.children === "Пока нет доступных событий"));
    return;
  }
  const list = find(tree, node => node.props?.className === "nearby-list");
  assert.ok(list);
  assert.equal(list.props.children.length, scenario === "found" ? 1 : 2);
  if (scenario === "found") {
    assert.equal(requests.length, 1);
    assert.match(list.props.children[0].props["aria-label"], /2.5 км/);
  } else {
    assert.deepEqual(requests.at(-1), { sort: "date" }, "fallback has no city, bounds or radius constraint");
    assert.ok(list.props.children.every(card => !card.props["aria-label"].includes("от вас")));
    const summary = find(tree, node => node.props?.className === "nearby-summary");
    assert.equal(summary.props.children[0], "Все доступные события: ");
  }
});
