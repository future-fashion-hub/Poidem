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
    location: { hash: environment.hash ?? "#feed", search: "", origin: "https://poidem.test", pathname: "/" },
    setTimeout: callback => { timers.push(callback); return timers.length; },
    clearTimeout: () => {},
    setInterval: () => 1, clearInterval: () => {}, addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false }),
    confirm: environment.confirm ?? (() => true),
  };
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const componentCode = code + (environment.component ? `\nexports.default = ${environment.component};` : "");
  new Function("require", "exports", "window", "localStorage", "setTimeout", "clearTimeout", "document", "navigator", componentCode)(name => {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
    if (name in modules) return modules[name];
    if (name === "react-dom") return { createPortal: node => node };
    const utilities = { "./api/publicCatalog": "../api/publicCatalog.ts", "./api/eventParticipation": "../api/eventParticipation.ts", "./api/russianCount": "../api/russianCount.ts", "../api/russianCount": "../api/russianCount.ts", "./api/types": "../api/types.ts", "../api/types": "../api/types.ts", "../api/coffee": "../api/coffee.ts", "./api/companyInvite": "../api/companyInvite.ts", "../api/companyInvite": "../api/companyInvite.ts" };
    if (name in utilities) return pureModule(utilities[name]);
    return { __esModule: true, default: name };
  }, exports, window, { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }, callback => { timers.push(callback); return timers.length; }, () => {}, { visibilityState: "visible", body: {}, addEventListener() {}, removeEventListener() {} }, environment.navigator ?? {});
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

test("missing notification backend is an explicit error, not fake demo notifications", async () => {
  const harness = componentHarness("./NotificationsCenter.tsx", {
    "../api": { backendMode: true, api: { listNotifications: async () => { throw new (pureModule("../api/types.ts").ApiError)("NOT_FOUND", "Missing", 404); } } },
    "../api/pagination": { collectPages: fetch => fetch({}) }, "./useModalDialog": { useModalDialog() {} }, "./usePopupDismiss": { usePopupDismiss: close => ({ closing: false, dismiss: close }) },
  });
  const props = { userId: 1, revision: 0, onOpenChange() {}, onAction() {} };
  find(harness.render(props), node => node.props?.className === "notifications-trigger").props.onClick(); await flush();
  const tree = harness.render(props);
  assert.ok(find(tree, node => node.props?.role === "alert"));
  assert.equal(find(tree, node => node.props?.className === "notifications-empty"), undefined);
  assert.equal(find(tree, node => node.props?.className === "notifications-item"), undefined);
});

test("read-all batches long histories and retains confirmed progress on a later failure", async () => {
  const batches = [], items = Array.from({ length: 201 }, (_, id) => ({ id: String(id), kind: "company", title: "Запись", body: "История", createdAt: new Date().toISOString(), readAt: null, target: { kind: "plans" } }));
  const harness = componentHarness("./NotificationsCenter.tsx", {
    "../api": { api: { listNotifications: async () => ({ items }), markNotificationsRead: async ids => { batches.push(ids); if (batches.length === 2) throw new Error("Сбой второй пачки"); } } },
    "../api/pagination": { collectPages: fetch => fetch({}) }, "./useModalDialog": { useModalDialog() {} }, "./usePopupDismiss": { usePopupDismiss: close => ({ closing: false, dismiss: close }) },
  });
  const props = { userId: 1, revision: 0, onOpenChange() {}, onAction() {} };
  find(harness.render(props), node => node.props?.className === "notifications-trigger").props.onClick(); await flush();
  find(harness.render(props), node => node.props?.className === "notifications-read-all").props.onClick(); await flush();
  const tree = harness.render(props); assert.deepEqual(batches.map(batch => batch.length), [200, 1]);
  assert.equal(find(tree, node => node.props?.className === "notifications-trigger").props["aria-label"], "Уведомления, непрочитанных: 1");
  assert.ok(find(tree, node => node.props?.role === "alert"));
});

for (const fails of [false, true]) test(`notifications mark-read updates only after confirmation (failure=${fails})`, async () => {
  const item = { id: "n1", kind: "company", title: "Компания создана", body: "Наша компания", createdAt: new Date().toISOString(), readAt: null, target: { kind: "company", id: 42 } };
  let writes = 0, finish;
  const harness = componentHarness("./NotificationsCenter.tsx", {
    "../api": { backendMode: false, api: { listNotifications: async () => ({ items: [item] }), markNotificationsRead: ids => { writes++; assert.deepEqual(ids, ["n1"]); return new Promise((resolve, reject) => { finish = () => fails ? reject(new Error("Не удалось сохранить прочтение")) : resolve(); }); } } },
    "../api/pagination": { collectPages: fetch => fetch({}) }, "./useModalDialog": { useModalDialog() {} }, "./usePopupDismiss": { usePopupDismiss: close => ({ closing: false, dismiss: close }) },
  });
  const props = { userId: 1, revision: 0, onOpenChange() {}, onAction() {} };
  let tree = harness.render(props); find(tree, node => node.props?.className === "notifications-trigger").props.onClick(); await flush(); tree = harness.render(props);
  const mark = find(tree, node => node.props?.className === "notifications-mark-one"); mark.props.onClick(); mark.props.onClick();
  assert.equal(writes, 1); tree = harness.render(props);
  assert.equal(find(tree, node => node.props?.className === "notifications-item").props["data-unread"], true);
  assert.equal(find(tree, node => node.props?.["aria-label"] === "Закрыть уведомления").props.disabled, true);
  finish(); await flush(); tree = harness.render(props);
  assert.ok(find(tree, node => node.props?.role === "dialog"), "marking one read keeps the center open");
  if (fails) { assert.equal(find(tree, node => node.props?.className === "notifications-item").props["data-unread"], true); assert.ok(find(tree, node => node.props?.role === "alert")); }
  else { assert.equal(find(tree, node => node.props?.className === "notifications-item").props["data-unread"], undefined); find(tree, node => node.props?.className === "notifications-tabs").props.children[1].props.onClick(); tree = harness.render(props); assert.ok(find(tree, node => node.type === "h3" && node.props.children === "Всё прочитано")); }
});

test("notification destination opens only after marking read and dismissing the panel", async () => {
  let target, writes = 0;
  const item = { id: "n1", kind: "application", title: "Новая заявка", body: "Компания", createdAt: new Date().toISOString(), readAt: null, target: { kind: "company", id: 42 } };
  const harness = componentHarness("./NotificationsCenter.tsx", {
    "../api": { api: { listNotifications: async () => ({ items: [item] }), markNotificationsRead: async () => writes++ } },
    "../api/pagination": { collectPages: fetch => fetch({}) }, "./useModalDialog": { useModalDialog() {} }, "./usePopupDismiss": { usePopupDismiss: close => ({ closing: false, dismiss: close }) },
  });
  const props = { userId: 1, revision: 0, onOpenChange() {}, onAction: next => { target = next; } };
  find(harness.render(props), node => node.props?.className === "notifications-trigger").props.onClick(); await flush();
  let tree = harness.render(props); find(tree, node => node.props?.className === "notifications-item-actions").props.children[0].props.onClick();
  assert.equal(target, undefined); await flush(); tree = harness.render(props); assert.equal(writes, 1);
  harness.runEffectContaining("leaving && !busy"); assert.deepEqual(target, { kind: "company", id: 42 });
  assert.equal(find(harness.render(props), node => node.props?.role === "dialog"), undefined);
});

test("older notification reads cannot undo a successful mark-read mutation", async () => {
  let reads = 0, oldRead;
  const item = { id: "n1", kind: "event", title: "Обновлено", body: "Детали", createdAt: new Date().toISOString(), readAt: null, target: { kind: "event", id: 7 } };
  const harness = componentHarness("./NotificationsCenter.tsx", {
    "../api": { api: { listNotifications: () => ++reads === 1 ? new Promise(resolve => { oldRead = resolve; }) : Promise.resolve({ items: [item] }), markNotificationsRead: async () => {} } },
    "../api/pagination": { collectPages: fetch => fetch({}) }, "./useModalDialog": { useModalDialog() {} }, "./usePopupDismiss": { usePopupDismiss: close => ({ closing: false, dismiss: close }) },
  });
  const props = { userId: 1, revision: 0, onOpenChange() {}, onAction() {} };
  harness.render(props); harness.runEffectContaining("void load");
  find(harness.render(props), node => node.props?.className === "notifications-trigger").props.onClick(); await flush();
  find(harness.render(props), node => node.props?.className === "notifications-read-all").props.onClick(); await flush();
  oldRead({ items: [item] }); await flush();
  assert.equal(find(harness.render(props), node => node.props?.className === "notifications-item").props["data-unread"], undefined);
});

test("header notifications are absent for guests and unfinished profiles", () => {
  const harness = componentHarness("../App.tsx", {}, { component: "Header" });
  const props = { user: null, view: "home", onboarding: false, onNavigate() {}, onAuth() {}, onRegister() {}, onLogout() {} };
  assert.equal(getComponent(harness.render(props), "./components/NotificationsCenter"), undefined);
  assert.equal(getComponent(harness.render({ ...props, user: { id: 1, firstName: "Анна" }, onboarding: true }), "./components/NotificationsCenter"), undefined);
  const center = getComponent(harness.render({ ...props, user: { id: 1, firstName: "Анна" } }), "./components/NotificationsCenter"); assert.equal(center.props.userId, 1);
});

test("notification routes target the selected company manager, chat and event", async () => {
  const user = { id: 1, firstName: "Анна", isProfileComplete: true };
  const event = { id: 7, title: "Событие", status: "active", startsAt: "2099-11-01T18:00:00Z", endsAt: "2099-11-01T19:00:00Z" };
  const harness = componentHarness("../App.tsx", { "./api": { api: { loginWithPassword: async () => ({ user }), getEvent: async () => event, listEventCompanies: async () => ({ items: [] }) } }, "./api/pagination": { collectPages: fetch => fetch({}) } });
  getComponent(harness.render(), "Header").props.onAuth(); await getComponent(harness.render(), "AuthModal").props.onAdminLogin("user", "password");
  let tree = harness.render(); getComponent(tree, "Header").props.onNotificationAction({ kind: "company", id: 42 }); await flush();
  tree = harness.render(); const plans = getComponent(tree, "./components/UserDashboard"); assert.equal(plans.props.initialTab, "companies"); assert.equal(plans.props.initialCompanyId, 42);
  getComponent(tree, "Header").props.onNotificationAction({ kind: "chat", id: 42 }); await flush();
  tree = harness.render(); assert.equal(getComponent(tree, "./components/ChatsPage").props.initialCompanyId, 42);
  getComponent(tree, "Header").props.onNotificationAction({ kind: "event", id: 7 }); await flush();
  assert.equal(getComponent(harness.render(), "EventDrawer").props.event.id, 7);
});

test("creation form submits private visibility once without changing the public event", async () => {
  let payload, calls = 0, finish, created = 0;
  const harness = componentHarness("../App.tsx", {
    "./components/usePopupDismiss": { usePopupDismiss: onClose => ({ closing: false, dismiss: onClose }) },
    "./components/useModalDialog": { useModalDialog() {} },
    "./api": { api: { createCompany: (eventId, input) => { assert.equal(eventId, 7); payload = input; calls++; return new Promise(resolve => { finish = resolve; }); } } },
  }, { component: "CreateCompanyModal" });
  const props = { event: { id: 7, title: "Публичное событие" }, onClose() {}, onCreated: async () => created++ };
  let tree = harness.render(props);
  find(tree, node => node.type === "input" && node.props.required).props.onChange({ target: { value: "Только свои" } });
  tree = harness.render(props);
  find(tree, node => node.props?.ariaLabel === "Кто видит компанию").props.onChange("private");
  tree = harness.render(props); const form = find(tree, node => node.type === "form");
  const first = form.props.onSubmit({ preventDefault() {} }); const second = form.props.onSubmit({ preventDefault() {} });
  assert.equal(calls, 1); assert.equal(payload.visibility, "private"); assert.equal(props.event.visibility, undefined);
  finish({ id: 42, visibility: "private" }); await Promise.all([first, second]); assert.equal(created, 1);
});

for (const scenario of ["guest", "open", "request", "revoked"]) test(`private invitation uses token API without ID-based access (${scenario})`, async () => {
  const token = "b".repeat(64); let mutations = 0, auth = 0;
  const preview = { company: { id: 42, eventId: 7, visibility: "private", name: "Только свои", owner: { id: 2, firstName: "Маша" }, status: "active", membersCount: 1, maxMembers: 4, joinType: scenario === "request" ? "request" : "open" }, event: { id: 7, title: "Событие", status: "active", startsAt: "2099-11-01T18:00:00Z", endsAt: "2099-11-01T19:00:00Z", cityId: 1, locationName: "Место" }, member: false, pending: false };
  const harness = componentHarness("./CompanyInvitePage.tsx", {
    "../api": { api: {
      previewCompanyInvitation: async value => { assert.equal(value, token); if (scenario === "revoked") throw new (pureModule("../api/types.ts").ApiError)("INVITATION_UNAVAILABLE", "Ссылка отозвана", 410); return preview; },
      redeemCompanyInvitation: async value => { mutations++; assert.equal(value, token); return { ...preview, member: scenario !== "request", pending: scenario === "request" }; },
    } }, "./useEventClock": { useEventClock: () => Date.now() },
  });
  const props = { companyId: 0, token, user: scenario === "guest" ? null : { id: 1 }, authLoading: false, cities: [], onAuth: () => auth++, onChat() {}, onChanged() {} };
  harness.render(props); harness.runEffectContaining("void load"); await flush();
  let tree = harness.render(props); assert.equal(mutations, 0);
  if (scenario === "revoked") { assert.equal(find(tree, node => node.props?.role === "alert").props.children, "Ссылка отозвана"); return; }
  find(tree, node => node.type === "button" && node.props?.className === "plans-button plans-button--primary").props.onClick(); await flush();
  tree = harness.render(props);
  if (scenario === "guest") { assert.equal(auth, 1); assert.equal(mutations, 0); }
  else { assert.equal(mutations, 1); assert.ok(find(tree, node => node.props?.role === "status")); }
});

test("private invitation management has no static ID link for members", () => {
  const company = { id: 42, visibility: "private", name: "Только свои" };
  const harness = componentHarness("./CompanyInviteLink.tsx");
  const member = harness.render({ company, canManage: false });
  assert.equal(find(member, node => node.type === "input"), undefined);
  assert.equal(find(member, node => node.type === "button"), undefined);
  assert.ok(getComponent(harness.render({ company, canManage: true }), "./PrivateCompanyInvites"));
});

test("owner generates one private invitation, and revoke requires confirmation", async () => {
  let creates = 0, revokes = 0, finish, confirm = false;
  const invitation = { token: "c".repeat(64), companyId: 42, expiresAt: "2099-11-01T19:00:00Z", uses: 0, maxUses: 10, revoked: false };
  const harness = componentHarness("./PrivateCompanyInvites.tsx", { "../api": { api: { getCompanyInvitation: async () => null, createCompanyInvitation: () => { creates++; return new Promise(resolve => { finish = () => resolve(invitation); }); }, revokeCompanyInvitation: async () => { revokes++; } } } }, { confirm: () => confirm });
  const props = { company: { id: 42, status: "active" } };
  let tree = harness.render(props); find(tree, node => node.type === "button").props.onClick();
  harness.render(props); harness.runEffectContaining("getCompanyInvitation"); await flush();
  tree = harness.render(props);
  const create = find(tree, node => node.type === "button" && node.props?.children === "Создать ссылку");
  create.props.onClick(); create.props.onClick(); assert.equal(creates, 1); finish(); await flush();
  tree = harness.render(props); const revoke = find(tree, node => node.props?.className === "company-invite-revoke");
  revoke.props.onClick(); await flush(); assert.equal(revokes, 0);
  confirm = true; revoke.props.onClick(); await flush(); assert.equal(revokes, 1);
});

for (const token of ["", "a".repeat(64)]) test(`company invitation survives guest registration and profile completion without auto-joining (token=${Boolean(token)})`, async () => {
  const user = { id: 1, firstName: "Анна", isProfileComplete: false };
  const harness = componentHarness("../App.tsx", { "./api": { api: { registerWithPassword: async () => ({ user }) } } }, { hash: token ? "#invite/t/" + token : "#invite/42" });
  let tree = harness.render();
  const invitation = getComponent(tree, "Lazy");
  assert.equal(invitation.props.companyId, token ? 0 : 42); assert.equal(invitation.props.token, token); invitation.props.onAuth();
  getComponent(harness.render(), "AuthModal").props.onRegister();
  await getComponent(harness.render(), "./components/RegisterModal").props.onPasswordRegister("user", "password");
  tree = harness.render();
  const profile = getComponent(tree, "./components/Onboarding"); assert.ok(profile);
  assert.equal(getComponent(tree, "EventDrawer"), undefined);
  profile.props.onComplete({ ...user, isProfileComplete: true });
  tree = harness.render();
  assert.equal(getComponent(tree, "Lazy").props.companyId, token ? 0 : 42); assert.equal(getComponent(tree, "Lazy").props.token, token);
  assert.equal(getComponent(tree, "./components/UserDashboard"), undefined);
});

for (const scenario of ["guest", "open", "request", "pending", "member", "full", "closed", "expired", "missing", "error"]) test(`company invitation: ${scenario}`, async () => {
  let joins = 0, applications = 0, auth = 0, chat, finish;
  const company = { id: 42, eventId: 7, name: "Наша компания", owner: { id: 2, firstName: "Маша" }, membersCount: scenario === "full" ? 4 : 1, maxMembers: 4, status: scenario === "closed" ? "closed" : "active", joinType: ["request", "pending"].includes(scenario) ? "request" : "open", minAge: null, maxAge: null };
  const event = { id: 7, title: "Событие", startsAt: "2099-11-01T18:00:00Z", endsAt: scenario === "expired" ? "2000-01-01T19:00:00Z" : "2099-11-01T19:00:00Z", status: "active", cityId: 1, locationName: "Кофейня" };
  const harness = componentHarness("./CompanyInvitePage.tsx", {
    "../api": { api: {
      getCompany: async () => { if (scenario === "missing") throw new (pureModule("../api/types.ts").ApiError)("COMPANY_NOT_FOUND", "Нет компании", 404); return company; },
      getEvent: async () => event,
      listMyCompanies: async () => ({ items: scenario === "member" ? [company] : [] }),
      getMyCompanyApplication: async () => ({ status: scenario === "pending" ? "pending" : "cancelled" }),
      joinOpenCompany: () => { joins++; if (scenario === "error") return Promise.reject(new Error("Сервер: места закончились")); return new Promise(resolve => { finish = () => { company.membersCount++; resolve(); }; }); },
      createCompanyApplication: async () => { applications++; },
    } },
    "../api/pagination": { collectPages: fetch => fetch({}) },
    "./useEventClock": { useEventClock: () => Date.now() },
  });
  const props = { companyId: 42, user: scenario === "guest" ? null : { id: 1 }, authLoading: false, cities: [], onAuth: () => auth++, onChat: id => { chat = id; }, onChanged() {} };
  harness.render(props); harness.runEffectContaining("void load"); await flush();
  let tree = harness.render(props);
  assert.equal(joins + applications, 0, "reading an invitation never joins automatically");
  if (["expired", "missing"].includes(scenario)) { assert.ok(find(tree, node => node.props?.role === "alert")); return; }
  const button = find(tree, node => node.type === "button" && node.props?.className === "plans-button plans-button--primary");
  if (scenario === "pending") { assert.equal(button, undefined); return; }
  assert.ok(button);
  if (["full", "closed"].includes(scenario)) { assert.equal(button.props.disabled, true); return; }
  button.props.onClick();
  if (scenario === "open") { button.props.onClick(); assert.equal(joins, 1); finish(); }
  await flush(); tree = harness.render(props);
  if (scenario === "guest") { assert.equal(auth, 1); assert.equal(joins + applications, 0); }
  if (scenario === "request") { assert.equal(applications, 1); assert.equal(joins, 0); assert.equal(find(tree, node => node.type === "button" && node.props?.className === "plans-button plans-button--primary"), undefined); }
  if (["member", "open"].includes(scenario)) {
    if (scenario === "open") find(tree, node => node.type === "button" && node.props?.className === "plans-button plans-button--primary").props.onClick();
    assert.equal(chat, 42);
    if (scenario === "open") assert.equal(find(tree, node => node.props?.className === "company-invite-facts").props.children[2].props.children[1], 2, "mock mutation is not counted twice");
  }
  if (scenario === "error") assert.equal(find(tree, node => node.props?.role === "alert").props.children, "Сервер: места закончились");
});

test("invitation share copies the clean URL and exposes a manual fallback", async () => {
  let copied;
  const company = { id: 42, name: "Наша компания" };
  const harness = componentHarness("./CompanyInviteLink.tsx", {}, { navigator: { clipboard: { writeText: async value => { copied = value; } } } });
  let tree = harness.render({ company });
  find(tree, node => node.type === "button").props.onClick(); tree = harness.render({ company });
  find(tree, node => node.props?.className === "company-invite-share-actions").props.children[0].props.onClick(); await flush();
  assert.equal(copied, "https://poidem.test/#invite/42");
  assert.ok(find(harness.render({ company }), node => node.props?.role === "status"));
  const fallback = componentHarness("./CompanyInviteLink.tsx");
  find(fallback.render({ company }), node => node.type === "button").props.onClick();
  tree = fallback.render({ company });
  find(tree, node => node.props?.className === "company-invite-share-actions").props.children[1].props.onClick(); await flush();
  assert.match(find(fallback.render({ company }), node => node.props?.role === "status").props.children, /вручную/);
});

test("coffee is a navigation section, not an action in the home hero", () => {
  const hero = componentHarness("../App.tsx", {}, { component: "HomeHero" }).render({ onNavigate() {}, paused: false });
  assert.equal(find(hero, node => node.props?.className?.includes("coffee-home-link")), undefined);
  const harness = componentHarness("../App.tsx", {}, { component: "Header" });
  const props = { user: null, view: "coffee", onboarding: false, onNavigate() {}, onAuth() {}, onRegister() {}, onLogout() {} };
  const nav = find(harness.render(props), node => node.props?.className === "site-section-nav");
  assert.equal(find(harness.render(props), node => node.props?.["data-view"] === "coffee"), undefined);
  assert.equal(find(harness.render(props), node => node.props?.["data-view"] === "map").props["aria-current"], "page");
  const coffee = find(nav, node => node.props?.href === "#coffee");
  assert.ok(coffee); assert.equal(coffee.props["aria-current"], "page");
  assert.equal(find(nav, node => node.props?.href === "#map").props["aria-current"], undefined);
  const mapNav = find(harness.render({ ...props, view: "map" }), node => node.props?.className === "site-section-nav");
  assert.equal(find(mapNav, node => node.props?.href === "#map").props["aria-current"], "page");
  for (const view of ["home", "feed", "profile", "chats"]) assert.equal(find(harness.render({ ...props, view }), node => node.props?.className === "site-section-nav"), undefined);
  assert.equal(find(harness.render({ ...props, onboarding: true }), node => node.props?.className === "site-section-nav"), undefined);
});

for (const requestedExists of [true, false]) test(`coffee chat opens only the requested company, including closed recruitment (exists=${requestedExists})`, async () => {
  const companies = [{ id: 7, name: "Другой чат", status: "active", membersCount: 2, eventId: 70 }, { id: 8, name: "Наш кофе", status: "closed", membersCount: 4, eventId: 80 }];
  const harness = componentHarness("./ChatsPage.tsx", {
    "../api": { backendMode: false, api: { listMyCompanies: async () => ({ items: companies }) } },
    "../api/pagination": { collectPages: fetch => fetch({}) },
    "../api/companyAvailability": { companyEventAvailable: () => true, loadCompanyEvents: async () => ({}) },
    "./useEventClock": { useEventClock: () => Date.now() },
  });
  const props = { userId: 1, initialCompanyId: requestedExists ? 8 : 99 };
  harness.render(props); harness.runEffectContaining("listMyCompanies"); await flush();
  const tree = harness.render(props);
  const title = find(tree, node => node.props?.className === "chat-topbar-title");
  if (requestedExists) assert.equal(find(title, node => node.type === "h2").props.children, "Наш кофе");
  else { assert.equal(title, undefined); assert.ok(find(tree, node => node.props?.role === "alert")); }
});

test("coffee route is public and does not remove the guest login flow", () => {
  const harness = componentHarness("../App.tsx", {}, { hash: "#coffee" });
  const tree = harness.render();
  const coffee = getComponent(tree, "Lazy");
  assert.ok(coffee); assert.equal(coffee.props.user, null);
  coffee.props.onAuth();
  assert.ok(getComponent(harness.render(), "AuthModal"));
});

test("coffee creation validates fields and prevents duplicate submissions", async () => {
  let mutations = 0, finish;
  const harness = componentHarness("./CoffeeCreateModal.tsx", { "../api": { api: { createCoffeeMeeting: () => { mutations++; return new Promise(resolve => { finish = resolve; }); } } } });
  let created;
  const props = { cities: [{ id: 1, name: "Москва" }], cityId: 1, onClose() {}, onCreated: meeting => { created = meeting; } };
  const form = () => getComponent(harness.render(props), "./CoffeeDialog").props.children(() => {});
  let tree = form();
  await tree.props.onSubmit({ preventDefault() {} });
  assert.equal(mutations, 0);
  tree = form(); assert.ok(find(tree, node => node.props?.role === "alert"));
  for (const [id, value] of [["coffee-title", "Кофе и книги"], ["coffee-description", "Давайте поговорим о хороших книгах за кофе"], ["coffee-locationName", "Кофейня у парка"]]) {
    find(tree, node => node.props?.id === id).props.onChange({ target: { value } }); tree = form();
  }
  find(tree, node => node.props?.id === "coffee-startsAt").props.onChange("2099-11-01T18:00");
  tree = form();
  const first = tree.props.onSubmit({ preventDefault() {} });
  const second = tree.props.onSubmit({ preventDefault() {} });
  assert.equal(mutations, 1);
  tree = form(); assert.equal(tree.props["aria-busy"], true);
  finish({ id: 77 }); await Promise.all([first, second]);
  assert.equal(created.id, 77);
});

for (const guest of [true, false]) test(`coffee detail joins explicitly, updates state, and opens the right company chat (guest=${guest})`, async () => {
  const meeting = { id: 55, eventId: 55, companyId: 555, topic: "chat", participation: "none", event: { id: 55, title: "Кофе и книги", description: "Поговорим за кофе", cityId: 1, startsAt: "2099-11-01T18:00:00Z", endsAt: "2099-11-01T19:00:00Z", status: "active", participantsCount: 1, locationName: "Кофейня" }, company: { id: 555, owner: { id: 2, firstName: "Маша", avatarUrl: null }, status: "active", membersCount: 1, maxMembers: 4, joinType: "open" } };
  let joins = 0, auth = 0, chat, changed = 0;
  const harness = componentHarness("./CoffeePage.tsx", {
    "../api": { backendMode: false, api: { listCoffeeMeetings: async () => ({ items: [meeting] }), joinOpenCompany: async () => { joins++; } } },
    "../api/pagination": { collectPages: fetch => fetch({}) },
  });
  const props = { user: guest ? null : { id: 1, firstName: "Анна" }, cities: [{ id: 1, name: "Москва" }], onAuth: () => auth++, onChat: id => { chat = id; }, onPlans() {}, onChanged: () => changed++, onModalChange() {} };
  let tree = harness.render(props);
  harness.runEffectContaining("void load"); await flush();
  tree = harness.render(props);
  find(tree, node => node.props?.className === "coffee-card-open").props.onClick();
  tree = harness.render(props);
  let detail = getComponent(tree, "./CoffeeDialog").props.children(() => {});
  const join = find(detail, node => node.type === "button" && node.props.className?.includes("coffee-button--primary"));
  await join.props.onClick(); await flush();
  tree = harness.render(props);
  if (guest) { assert.equal(auth, 1); assert.equal(joins, 0); assert.equal(getComponent(tree, "./CoffeeDialog"), undefined); }
  else {
    assert.equal(joins, 1); assert.equal(changed, 1);
    detail = getComponent(tree, "./CoffeeDialog").props.children(() => {});
    const chatButton = find(detail, node => node.type === "button" && node.props.children?.[1] === "Открыть чат");
    assert.ok(chatButton); chatButton.props.onClick(); assert.equal(chat, 555);
    assert.equal(find(tree, node => node.props?.className === "coffee-seat-count").props.children[1], 2);
  }
});

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
