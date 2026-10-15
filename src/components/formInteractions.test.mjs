import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Exercise the real component callbacks without a browser or network requests.
function componentHarness(path, modules = {}) {
  const states = [], effects = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], next => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
    },
    useRef: current => ({ current }),
    useId: () => "test-picker",
    useMemo: factory => factory(),
    useEffect: effect => effects.push(effect),
    useLayoutEffect: () => {},
    lazy: () => function Lazy() {},
  };
  const jsx = (type, props) => ({ type, props });
  const window = {
    location: { hash: "#feed", search: "" },
    setTimeout: () => 1,
    matchMedia: () => ({ matches: false }),
  };
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  new Function("require", "exports", "window", code)(name => {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
    if (name in modules) return modules[name];
    return { __esModule: true, default: name };
  }, exports, window);
  return {
    render(props) { cursor = 0; effects.length = 0; return exports.default(props); },
    runEffects() { return effects.map(effect => effect()).filter(Boolean); },
  };
}

function find(node, predicate) {
  if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
  if (!node || typeof node !== "object") return undefined;
  return predicate(node) ? node : find(node.props?.children, predicate);
}

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
