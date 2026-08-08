(() => {
  const root = document.documentElement;
  let frame = 0;

  function clampRadarNodes() {
    document
      .querySelectorAll(".radar-wrap .map-node, .radar-wrap .cms-map-node")
      .forEach(node => {
        const parent = node.closest(".radar-wrap");
        if (!parent || node.offsetParent === null) return;

        node.style.translate = "0px 0px";

        const parentRect = parent.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();
        const margin = 8;

        let moveX = 0;
        let moveY = 0;

        if (nodeRect.left < parentRect.left + margin) {
          moveX = parentRect.left + margin - nodeRect.left;
        } else if (nodeRect.right > parentRect.right - margin) {
          moveX = parentRect.right - margin - nodeRect.right;
        }

        if (nodeRect.top < parentRect.top + margin) {
          moveY = parentRect.top + margin - nodeRect.top;
        } else if (nodeRect.bottom > parentRect.bottom - margin) {
          moveY = parentRect.bottom - margin - nodeRect.bottom;
        }

        node.style.translate = `${Math.round(moveX)}px ${Math.round(moveY)}px`;
      });
  }

  function syncViewport() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      root.style.setProperty("--app-height", `${Math.round(viewportHeight)}px`);

      const compact =
        window.innerWidth <= 1050 ||
        window.matchMedia("(pointer:coarse)").matches;

      document.body.classList.toggle("compact-device", compact);

      if (compact) {
        document.querySelectorAll("[data-tilt], .magnetic").forEach(element => {
          element.style.transform = "";
        });
      }

      clampRadarNodes();
    });
  }

  syncViewport();

  window.addEventListener("load", syncViewport, { passive: true });
  window.addEventListener("resize", syncViewport, { passive: true });
  window.addEventListener("orientationchange", syncViewport, { passive: true });
  window.visualViewport?.addEventListener("resize", syncViewport, { passive: true });

  const radarObserver = new MutationObserver(mutations => {
    const changed = mutations.some(mutation =>
      [...mutation.addedNodes].some(node =>
        node.nodeType === 1 &&
        (node.matches?.(".map-node, .cms-map-node") ||
          node.querySelector?.(".map-node, .cms-map-node"))
      )
    );
    if (changed) syncViewport();
  });

  radarObserver.observe(document.body, { childList: true, subtree: true });
})();
