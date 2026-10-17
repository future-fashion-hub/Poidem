import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function harness() {
  const effects = [], windowListeners = new Map(), documentListeners = new Map();
  const document = { activeElement: null, querySelector: () => trigger };
  class Element {
    isConnected = true;
    hidden = false;
    nested = false;
    constructor(name, children = []) { this.name = name; this.children = children; }
    closest(selector) { return selector.startsWith(".site-date") ? this.nested ? this : null : this.hidden ? this : null; }
    getClientRects() { return this.hidden ? [] : [{}]; }
    focus() { document.activeElement = this; }
    contains(target) { return this === target || this.children.includes(target); }
    querySelector() { return this.children[0]; }
    querySelectorAll() { return this.children; }
  }
  const trigger = new Element("trigger");
  document.activeElement = trigger;
  document.addEventListener = (name, handler) => documentListeners.set(name, handler);
  document.removeEventListener = name => documentListeners.delete(name);
  const window = { addEventListener: (name, handler) => windowListeners.set(handler, name), removeEventListener: (_, handler) => windowListeners.delete(handler) };
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL("./useModalDialog.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function("require", "exports", "window", "document", "HTMLElement", "requestAnimationFrame", code)(
    () => ({ useRef: current => ({ current }), useLayoutEffect: effect => effects.push(effect()) }), exports, window, document, Element, callback => callback(),
  );
  function mount() {
    const close = new Element("close"), last = new Element("submit"), panel = new Element("panel", [close, last]);
    let calls = 0;
    exports.useModalDialog({ current: panel }, () => calls++);
    const cleanup = effects.at(-1);
    return { close, last, panel, cleanup, calls: () => calls };
  }
  function key(key, shiftKey = false, prevented = false) {
    const event = { key, shiftKey, defaultPrevented: prevented, target: document.activeElement, preventDefault() { this.defaultPrevented = true; } };
    for (const handler of windowListeners.keys()) handler(event);
    return event;
  }
  return { document, trigger, mount, key, documentListeners };
}

test("dialog moves focus inside, wraps Tab in both directions and restores its initiator", () => {
  const view = harness(), dialog = view.mount();
  assert.equal(view.document.activeElement, dialog.close);
  dialog.last.focus(); view.key("Tab");
  assert.equal(view.document.activeElement, dialog.close);
  view.key("Tab", true);
  assert.equal(view.document.activeElement, dialog.last);
  view.key("Escape");
  assert.equal(dialog.calls(), 1);
  dialog.cleanup();
  assert.equal(view.document.activeElement, view.trigger);
});
test("Escape is consumed only by the top dialog, not by underlying windows", () => {
  const view = harness(), first = view.mount(), second = view.mount();
  view.key("Escape");
  assert.equal(first.calls(), 0);
  assert.equal(second.calls(), 1);
  second.cleanup(); first.cleanup();
});
test("an open calendar/select handles Escape without dismissing its parent", () => {
  const view = harness(), dialog = view.mount();
  dialog.close.nested = true;
  view.key("Escape");
  assert.equal(dialog.calls(), 0);
  dialog.close.nested = false;
  view.key("Escape", false, true);
  assert.equal(dialog.calls(), 0);
  dialog.cleanup();
});
test("focus cannot escape into the hidden page", () => {
  const view = harness(), dialog = view.mount();
  view.trigger.focus();
  view.documentListeners.get("focusin")({ target: view.trigger });
  assert.equal(view.document.activeElement, dialog.close);
  dialog.cleanup();
});
