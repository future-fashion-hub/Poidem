const cardSelector = ".event-card, .atlas-card, .plans-event, .favorites-card, .nearby-card, .coffee-card";
const activeClass = "is-scroll-hover";

// One observer for all lists, including asynchronously loaded cards and portals.
// No scroll handlers, layout polling, React renders, or synthetic focus/clicks.
export function observeScrollCards() {
  if (typeof IntersectionObserver === "undefined" || typeof MutationObserver === "undefined") return () => {};

  const media = window.matchMedia("(hover: none) and (pointer: coarse) and (prefers-reduced-motion: no-preference)");
  const cards = new Set<Element>();
  let intersection: IntersectionObserver | null = null;
  let mutations: MutationObserver | null = null;

  const syncCards = () => {
    if (!intersection) return;
    const present = new Set(document.body.querySelectorAll(cardSelector));
    for (const card of cards) {
      if (!present.has(card)) {
        intersection.unobserve(card);
        card.classList.remove(activeClass);
        cards.delete(card);
      }
    }
    for (const card of present) {
      if (!cards.has(card)) {
        cards.add(card);
        intersection.observe(card);
      }
    }
  };

  const stop = () => {
    intersection?.disconnect();
    mutations?.disconnect();
    intersection = null;
    mutations = null;
    for (const card of cards) card.classList.remove(activeClass);
    cards.clear();
  };

  const update = () => {
    stop();
    if (!media.matches) return;
    const observer = new IntersectionObserver(entries => {
      if (intersection !== observer) return;
      for (const entry of entries) {
        if (!cards.has(entry.target)) continue;
        // Tall cards still activate in landscape or in a short scroll container.
        const availableHeight = Math.min(entry.boundingClientRect.height, entry.rootBounds?.height ?? entry.boundingClientRect.height);
        const visible = availableHeight > 0 ? entry.intersectionRect.height / availableHeight : 0;
        const active = entry.target.classList.contains(activeClass);
        // Different enter/leave thresholds prevent flicker at the boundary.
        entry.target.classList.toggle(activeClass, entry.isIntersecting && visible >= (active ? .3 : .55));
      }
    }, {
      rootMargin: "-64px 0px -80px 0px",
      threshold: Array.from({ length: 21 }, (_, index) => index / 20),
    });
    intersection = observer;
    syncCards();
    mutations = new MutationObserver(syncCards);
    mutations.observe(document.body, { childList: true, subtree: true });
  };

  update();
  media.addEventListener("change", update);
  return () => {
    media.removeEventListener("change", update);
    stop();
  };
}
