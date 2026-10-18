import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postcss from "postcss";

const sheets = ["../index.css", "../mobile.css", "./coffee.css", "./companyInvite.css", "./chatActivities.css", "./notifications.css"].map(path => postcss.parse(readFileSync(new URL(path, import.meta.url), "utf8")));

for (const width of [320, 375, 402, 670, 1440]) test(`chat polls keep mobile inputs readable and controls touchable at ${width}px`, () => {
  assert.equal(declarations(".chat-activities", width)["min-width"], "0");
  assert.equal(declarations(".chat-poll-input-row > label", width).flex, "1");
  assert.equal(declarations(".chat-poll-form input", width)["font-size"], "16px");
  assert.equal(declarations(".chat-poll-form input", width)["min-width"], "0");
  assert.equal(declarations(".chat-poll-option", width)["min-height"], "48px");
  assert.equal(declarations(".chat-pin-dismiss", width)["min-height"], "44px");
  assert.equal(declarations(".chat-poll-actions", width)["flex-wrap"], "wrap");
  assert.equal(declarations(".chat-pinned-copy p", width)["overflow-wrap"], "anywhere");
});

for (const width of [320, 375, 402, 670, 1440]) test(`notifications keep touch controls and scroll area at ${width}px`, () => {
  assert.equal(declarations(".notifications-panel", width)["min-width"], "0");
  assert.equal(declarations(".notifications-panel", width)["max-width"], "100%");
  assert.equal(declarations(".notifications-list", width)["min-height"], "0");
  assert.equal(declarations(".notifications-list", width)["overflow-y"], "auto");
  assert.equal(declarations(".notifications-icon-button", width).width, "44px");
  assert.equal(declarations(".notifications-trigger", width).height, "44px");
  assert.equal(declarations(".notifications-item-copy", width)["overflow-wrap"], "anywhere");
  assert.equal(declarations(".notifications-panel", width).height, width < 768 ? "min(90dvh, 900px)" : "100dvh");
});

test("notification animations are transform-only and gated by reduced motion", () => {
  const sheet = sheets.at(-1);
  sheet.walkRules(rule => {
    if (!rule.selector.includes("notifications-panel")) return;
    rule.walkDecls(/^animation/, () => {
      let parent = rule.parent, allowed = false;
      while (parent) { if (parent.type === "atrule" && parent.name === "media" && parent.params.includes("prefers-reduced-motion: no-preference")) allowed = true; parent = parent.parent; }
      assert.equal(allowed, true);
    });
  });
  sheet.walkAtRules("keyframes", animation => animation.walkDecls(declaration => assert.equal(declaration.prop, "transform")));
});

for (const width of [320, 375, 402, 670, 1440]) test(`invitation page and share controls fit at ${width}px`, () => {
  assert.equal(declarations(".company-invite-page", width)["min-width"], "0");
  assert.equal(declarations(".company-invite-body", width)["overflow-wrap"], "anywhere");
  assert.equal(declarations(".company-invite-share-panel input", width)["min-width"], "0");
  assert.equal(declarations(".company-invite-share-panel input", width)["font-size"], "16px");
  assert.equal(declarations(".company-invite-share-actions", width)["flex-wrap"], "wrap");
  assert.equal(declarations(".company-invite-share-actions button", width)["min-height"], "44px");
  assert.equal(declarations(".company-invite-options", width)["grid-template-columns"], width < 768 ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))");
});

for (const width of [320, 375, 670, 768, 1024, 1440]) test(`coffee navigation stays aligned at ${width}px`, () => {
  assert.equal(declarations(".site-section-nav", width).display, "flex");
  if (width < 1024) {
    const tab = declarations(".site-section-nav > a", width);
    assert.equal(tab.display, "inline-flex");
    assert.equal(tab["align-items"], "center");
    assert.equal(tab["min-height"], "48px");
    assert.equal(declarations(".site-section-nav > a > svg", width).width, "20px");
  }
});

// Check our breakpoint rules without launching a browser. This deliberately
// checks exact selectors, not a general-purpose computed-style implementation.
function declarations(selector, width) {
  const result = {};
  for (const sheet of sheets) sheet.walkRules(rule => {
    if (!rule.selectors.includes(selector)) return;
    for (let parent = rule.parent; parent; parent = parent.parent) {
      if (parent.type !== "atrule" || parent.name !== "media") continue;
      for (const [, bound, value] of parent.params.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)) {
        if (bound === "min" ? width < Number(value) : width > Number(value)) return;
      }
    }
    rule.walkDecls(declaration => { result[declaration.prop] = declaration.value; });
  });
  return result;
}

for (const width of [1024, 1440, 1920]) test(`desktop feed keeps its original card sizing at ${width}px`, () => {
  assert.equal(declarations(".discovery-feed .discovery-content", width).height, undefined);
  assert.equal(declarations(".discovery-feed .swipe-deck", width).height, undefined);
  assert.equal(declarations(".discovery-feed .swipe-artwork", width)["aspect-ratio"], undefined);
  assert.equal(declarations(".swipe-deck", width)["max-width"], "480px");
  assert.equal(declarations(".swipe-artwork", width)["aspect-ratio"], "1 / 1.08");
});

for (const width of [390, 663, 767, 768, 1023]) test(`phone/tablet feed keeps its pre-UX card proportions at ${width}px`, () => {
  assert.equal(declarations(".discovery-feed .discovery-content", width).height, undefined);
  assert.equal(declarations(".discovery-feed .swipe-deck", width).height, undefined);
  assert.equal(declarations(".discovery-feed .swipe-card", width).height, undefined);
  assert.equal(declarations(".discovery-feed .swipe-artwork", width)["aspect-ratio"], undefined);
  assert.equal(declarations(".swipe-deck", width)["max-width"], "480px");
  assert.equal(declarations(".swipe-artwork", width)["aspect-ratio"], width <= 767 ? "1 / 1" : "1 / 1.08");
});

test("map filter collapse is mobile-only and does not use the global hidden attribute", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const controls = app.match(/<div id="atlas-filter-controls"[^>]*>/)?.[0];
  assert.ok(controls);
  assert.doesNotMatch(controls, /\bhidden=/);
  assert.match(controls, /data-expanded=\{filtersOpen\}/);
  for (const width of [390, 767, 768, 1023]) {
    assert.equal(declarations('.atlas-filter-controls[data-expanded="false"]', width).display, "none");
    assert.equal(declarations(".atlas-mobile-filter-toggle", width).display, "flex");
  }
  for (const width of [1024, 1440, 1920]) {
    assert.equal(declarations(".atlas-filter-controls", width).display, "block");
    assert.equal(declarations('.atlas-filter-controls[data-expanded="false"]', width).display, undefined);
    assert.equal(declarations(".atlas-mobile-filter-toggle", width).display, "none");
  }
});

test("solo participation changes color without stretching the action row", () => {
  const row = declarations(".event-modal-actions", 1440);
  assert.equal(row["align-items"], "start");
  assert.equal(row["grid-template-columns"], "1fr 1fr");
  assert.equal(declarations(".event-modal-actions button", 1440)["min-height"], "54px");
  assert.equal(declarations('.event-modal-action-primary[data-joined="true"]', 1440).background, "var(--ink)");
  assert.equal(declarations('.event-modal-action-primary[data-joined="true"]', 1440).color, "var(--lime)");
});

for (const width of [320, 393, 402, 440, 767]) test(`event popup can shrink and wrap long venue names at ${width}px`, () => {
  const panel = declarations(".event-modal-panel", width);
  assert.equal(panel["min-width"], "0");
  assert.equal(panel["max-width"], "100%");
  assert.equal(panel["overflow-x"], "hidden");
  assert.equal(declarations(".event-modal-facts > div > span:last-child", width)["min-width"], "0");
  const text = declarations(".event-modal-facts strong", width);
  assert.equal(text["white-space"], "normal");
  assert.equal(text["overflow-wrap"], "anywhere");
});

for (const width of [320, 375, 402, 768, 1440]) test(`coffee cards, form and dialog adapt at ${width}px`, () => {
  assert.equal(declarations(".coffee-dialog", width)["min-width"], "0");
  assert.equal(declarations(".coffee-dialog", width)["max-width"], "100%");
  assert.equal(declarations(".coffee-form-field > input", width)["font-size"], "16px");
  assert.equal(declarations(".coffee-form-fields", width)["grid-template-columns"], width < 768 ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))");
  assert.equal(declarations(".coffee-grid", width)["grid-template-columns"], width < 768 ? "minmax(0, 1fr)" : width < 1024 ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))");
  if (width < 1024) assert.equal(declarations('.site-nav-link[data-view="coffee"]', width).display, "none", "keep the existing five-item mobile tab bar");
});
