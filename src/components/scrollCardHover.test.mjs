import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const activeClass = "is-scroll-hover";
function card() {
  const classes = new Set();
  return { classList: {
    contains: name => classes.has(name),
    remove: name => classes.delete(name),
    toggle: (name, active) => active ? classes.add(name) : classes.delete(name),
  } };
}

function harness(enabled = true, supported = true) {
  const cards = [card()], intersections = [], mutations = [], listeners = new Set();
  const media = {
    matches: enabled,
    addEventListener: (_, callback) => listeners.add(callback),
    removeEventListener: (_, callback) => listeners.delete(callback),
  };
  class IntersectionObserver {
    targets = new Set();
    disconnected = false;
    constructor(callback, options) { this.callback = callback; this.options = options; intersections.push(this); }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.disconnected = true; this.targets.clear(); }
    emit(target, height, { total = 400, viewport = 600, intersecting = true } = {}) {
      this.callback([{ target, isIntersecting: intersecting, intersectionRect: { height }, boundingClientRect: { height: total }, rootBounds: { height: viewport } }]);
    }
  }
  class MutationObserver {
    disconnected = false;
    constructor(callback) { this.callback = callback; mutations.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL("./scrollCardHover.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function("exports", "window", "document", "IntersectionObserver", "MutationObserver", code)(
    exports,
    { matchMedia: query => {
      assert.equal(query, "(hover: none) and (pointer: coarse) and (prefers-reduced-motion: no-preference)");
      return media;
    } },
    { body: { querySelectorAll: selector => {
      assert.equal(selector, ".event-card, .atlas-card, .plans-event, .favorites-card, .nearby-card");
      return cards;
    } } },
    supported ? IntersectionObserver : undefined, MutationObserver,
  );
  const cleanup = exports.observeScrollCards();
  return { cards, intersections, mutations, cleanup, listeners, change(enabled) {
    media.matches = enabled;
    for (const callback of listeners) callback();
  } };
}

test("touch cards enter, stay stable near the threshold, and reset when leaving", () => {
  const view = harness(), target = view.cards[0], observer = view.intersections[0];
  observer.emit(target, 180);
  assert.equal(target.classList.contains(activeClass), false);
  observer.emit(target, 240);
  assert.equal(target.classList.contains(activeClass), true);
  observer.emit(target, 180);
  assert.equal(target.classList.contains(activeClass), true);
  observer.emit(target, 100);
  assert.equal(target.classList.contains(activeClass), false);
  observer.emit(target, 240);
  observer.emit(target, 240, { intersecting: false });
  assert.equal(target.classList.contains(activeClass), false);
  assert.equal(observer.options.rootMargin, "-64px 0px -80px 0px");
  view.cleanup();
});

test("a tall card can activate in a short landscape viewport", () => {
  const view = harness(), target = view.cards[0];
  view.intersections[0].emit(target, 150, { total: 700, viewport: 220 });
  assert.equal(target.classList.contains(activeClass), true);
  view.cleanup();
});

test("new lists and popup cards are observed; removed cards are released", () => {
  const view = harness(), old = view.cards[0], next = card(), observer = view.intersections[0];
  observer.emit(old, 240);
  view.cards.push(next);
  view.mutations[0].callback();
  assert.ok(observer.targets.has(next));
  view.cards.shift();
  view.mutations[0].callback();
  assert.equal(observer.targets.has(old), false);
  assert.equal(old.classList.contains(activeClass), false);
  observer.emit(old, 240);
  assert.equal(old.classList.contains(activeClass), false);
  view.cleanup();
});

test("desktop and reduced-motion settings do not start automatic hover", () => {
  const view = harness(false);
  assert.equal(view.intersections.length, 0);
  assert.equal(view.mutations.length, 0);
  view.cleanup();
  assert.equal(view.listeners.size, 0);
});

test("changing input or motion preferences clears active effects and can restart", () => {
  const view = harness(), oldObserver = view.intersections[0], target = view.cards[0];
  oldObserver.emit(target, 240);
  view.change(false);
  assert.ok(oldObserver.disconnected);
  assert.equal(target.classList.contains(activeClass), false);
  view.change(true);
  assert.equal(view.intersections.length, 2);
  oldObserver.emit(target, 240);
  assert.equal(target.classList.contains(activeClass), false);
  view.intersections[1].emit(target, 240);
  assert.equal(target.classList.contains(activeClass), true);
  view.cleanup();
});

test("unmount disconnects observers and ignores any queued visibility callback", () => {
  const view = harness(), target = view.cards[0], observer = view.intersections[0];
  observer.emit(target, 240);
  view.cleanup();
  observer.emit(target, 240);
  assert.ok(observer.disconnected);
  assert.ok(view.mutations[0].disconnected);
  assert.equal(target.classList.contains(activeClass), false);
  assert.equal(view.listeners.size, 0);
});

test("missing browser observer APIs leave cards usable without effects", () => {
  const view = harness(true, false);
  assert.equal(view.intersections.length, 0);
  assert.doesNotThrow(view.cleanup);
});
