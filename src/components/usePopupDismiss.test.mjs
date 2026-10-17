import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function harness(reducedMotion = false, options = {}, confirm = true) {
  const cleanups = [], states = [], timers = new Map();
  let calls = 0;
  const react = {
    useRef: current => ({ current }),
    useState: initial => [initial, next => states.push(next)],
    useCallback: callback => callback,
    useEffect: effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL("./usePopupDismiss.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function("require", "exports", "window", "setTimeout", "clearTimeout", code)(
    () => react, module.exports, { matchMedia: () => ({ matches: reducedMotion }), confirm: () => confirm },
    (callback, delay) => { assert.equal(delay, 340); timers.set(1, callback); return 1; },
    id => timers.delete(id),
  );
  const popup = module.exports.usePopupDismiss(() => calls++, true, options);
  return { popup, states, timers, calls: () => calls, unmount: () => cleanups.forEach(cleanup => cleanup()) };
}

test("dismiss waits for the exit animation and ignores repeated clicks", () => {
  const view = harness();
  view.popup.dismiss(); view.popup.dismiss();
  assert.deepEqual(view.states, [true]);
  assert.equal(view.calls(), 0);
  assert.equal(view.timers.size, 1);
  view.timers.get(1)();
  assert.equal(view.calls(), 1);
});

test("reduced motion dismisses immediately without a timer", () => {
  const view = harness(true);
  view.popup.dismiss();
  assert.equal(view.calls(), 1);
  assert.equal(view.timers.size, 0);
});

test("unmount cancels a pending dismissal", () => {
  const view = harness();
  view.popup.dismiss(); view.unmount();
  assert.equal(view.timers.size, 0);
  assert.equal(view.calls(), 0);
});
test("dirty forms stay open if discarding changes is rejected", () => {
  const view = harness(false, { dirty: true }, false);
  view.popup.dismiss();
  assert.equal(view.timers.size, 0);
  assert.equal(view.calls(), 0);
});
test("saving forms cannot be dismissed mid-request", () => {
  const view = harness(false, { busy: true });
  view.popup.dismiss();
  assert.equal(view.timers.size, 0);
  assert.equal(view.calls(), 0);
});
