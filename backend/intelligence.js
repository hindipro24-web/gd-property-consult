(function () {
  const panel = document.getElementById("intelligenceInsightPanel");
  const marketInterface = document.querySelector(".market-interface");
  const backdrop = document.getElementById("intelligencePanelBackdrop");
  if (!panel || !marketInterface) return;

  const client = window.KeyAssetsSupabaseClient || null;
  let properties = [];
  let selectedLocation = "";
  let selectedNode = null;
  let currentTopLocation = "";

  const byId = id => document.getElementById(id);
  const setText = (id, value) => {
    const element = byId(id);
    if (element) element.textContent = value == null || value === "" ? "—" : String(value);
  };

  const normalize = value => String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\bsurat\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const parsePrice = value => {
    const text = String(value || "").replace(/,/g, "").toLowerCase();
    const numeric = Number((text.match(/[\d.]+/) || [0])[0]);
    if (!numeric) return 0;
    if (text.includes("cr")) return numeric * 10000000;
    if (text.includes("lakh") || text.includes("lac")) return numeric * 100000;
    return numeric;
  };

  const money = (value, purpose = "Sale") => {
    const amount = Number(value || 0);
    if (!amount) return "On request";
    if (purpose === "Rent") {
      if (amount >= 100000) return `₹${(amount / 100000).toFixed(amount % 100000 ? 1 : 0)}L/mo`;
      return `₹${Math.round(amount / 1000)}K/mo`;
    }
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(amount % 10000000 ? 1 : 0)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(amount % 100000 ? 1 : 0)} L`;
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  function markTopLocation(location) {
    currentTopLocation = String(location || "").trim();
    const wanted = normalize(currentTopLocation);
    let marked = false;
    document.querySelectorAll("[data-intelligence-location]").forEach(node => {
      const nodeLocation = normalize(node.dataset.intelligenceLocation);
      const matches = !marked && wanted && nodeLocation && (nodeLocation.includes(wanted) || wanted.includes(nodeLocation));
      node.classList.toggle("is-top-match", Boolean(matches));
      if (matches) marked = true;
    });
  }

  function fallbackPropertiesFromCards() {
    return [...document.querySelectorAll("#propertyGrid .property-card")].map((card, index) => {
      const image = card.querySelector(".property-media img");
      const title = card.dataset.propertyName || card.querySelector("h3")?.textContent.trim() || `Property ${index + 1}`;
      const priceLabel = card.dataset.propertyPrice || card.querySelector(".property-price strong")?.textContent.trim() || "On request";
      const propertyId = card.dataset.propertyId || "";
      return {
        id: propertyId,
        title,
        location: card.dataset.propertyLocation || card.dataset.location || card.querySelector(".property-location")?.textContent.trim() || "",
        city: "",
        price_label: priceLabel,
        price_amount: Number(card.dataset.propertyPriceAmount || card.dataset.price || 0) || parsePrice(priceLabel),
        property_type: card.dataset.propertyType || card.dataset.category || "Property",
        listing_purpose: card.dataset.listingPurpose === "Rent" ? "Rent" : "Sale",
        bhk: card.dataset.propertyBhk || "",
        area: card.dataset.propertyArea || "",
        main_image: image?.currentSrc || image?.src || "",
        detail_url: propertyId
          ? `property-details.html?id=${encodeURIComponent(propertyId)}`
          : `property-details.html?property=${encodeURIComponent(title)}`,
        created_at: ""
      };
    });
  }

  function propertyMatchesLocation(property, location) {
    const propertyLocation = normalize([property.location, property.city].filter(Boolean).join(" "));
    const wanted = normalize(location);
    if (!propertyLocation || !wanted) return false;
    if (propertyLocation.includes(wanted) || wanted.includes(propertyLocation)) return true;
    const tokens = wanted.split(" ").filter(token => token.length >= 3);
    const combinedArea = /[-–—/]/.test(String(location || ""));
    return tokens.length > 0 && (combinedArea
      ? tokens.some(token => propertyLocation.includes(token))
      : tokens.every(token => propertyLocation.includes(token)));
  }

  function propertyTimestamp(property) {
    const timestamp = Date.parse(property?.created_at || "");
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function sortedNewest(items) {
    return [...items].sort((a, b) => {
      const timestampDifference = propertyTimestamp(b) - propertyTimestamp(a);
      if (timestampDifference) return timestampDifference;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });
  }

  function renderPropertyTypes(items) {
    const host = byId("intelligencePropertyTypes");
    if (!host) return;
    const types = [...new Set(items.map(item => String(item.property_type || "Property").trim()).filter(Boolean))].slice(0, 4);
    host.replaceChildren(...types.map(type => {
      const chip = document.createElement("span");
      chip.textContent = type;
      return chip;
    }));
    if (!types.length) {
      const chip = document.createElement("span");
      chip.textContent = "Advisor shortlist";
      host.append(chip);
    }
  }

  function renderLatestProperty(property, location) {
    const latestLink = byId("intelligenceLatestProperty");
    const image = byId("intelligenceLatestImage");
    if (!latestLink || !image) return;
    latestLink.hidden = !property;
    if (!property) return;

    const title = property.title || "Property";
    const detailUrl = property.detail_url || (property.id
      ? `property-details.html?id=${encodeURIComponent(property.id)}`
      : "#properties");
    latestLink.href = detailUrl;
    image.src = property.main_image || "assets/gd-property-consult/gd-hero-wide.jpg";
    image.alt = `${title} in ${location}`;
    setText("intelligenceLatestTitle", title);
    setText(
      "intelligenceLatestMeta",
      `${property.bhk || property.property_type || "Property"} • ${property.price_label || money(property.price_amount, property.listing_purpose)}`
    );
  }

  function renderLocation(location) {
    const matches = sortedNewest(properties.filter(property => propertyMatchesLocation(property, location)));
    const sale = matches.filter(property => property.listing_purpose !== "Rent");
    const rent = matches.filter(property => property.listing_purpose === "Rent");
    const pricedSale = sale.map(property => Number(property.price_amount || 0)).filter(Boolean);
    const pricedRent = rent.map(property => Number(property.price_amount || 0)).filter(Boolean);
    const startingPurpose = pricedSale.length ? "Sale" : "Rent";
    const startingAmount = pricedSale.length ? Math.min(...pricedSale) : (pricedRent.length ? Math.min(...pricedRent) : 0);
    const typeCount = new Set(matches.map(property => property.property_type).filter(Boolean)).size;

    setText("intelligencePanelTitle", location);
    setText(
      "intelligencePanelSummary",
      matches.length
        ? `${matches.length} live ${matches.length === 1 ? "listing" : "listings"} across ${typeCount || 1} property ${typeCount === 1 ? "type" : "types"}.`
        : "No published listing is available here right now. Request a private shortlist from our advisor."
    );
    setText("intelligenceAvailable", matches.length);
    setText("intelligenceStartingPrice", money(startingAmount, startingPurpose));
    setText("intelligencePurposeSplit", `${sale.length} / ${rent.length}`);
    renderPropertyTypes(matches);
    renderLatestProperty(matches[0] || null, location);

    const viewButton = byId("intelligenceViewProperties");
    if (viewButton) {
      viewButton.disabled = matches.length === 0;
      viewButton.textContent = matches.length ? `View ${matches.length} ${matches.length === 1 ? "property" : "properties"}` : "No live property";
    }
  }

  function openPanel(location, node) {
    selectedLocation = String(location || "").trim();
    if (!selectedLocation) return;

    selectedNode?.classList.remove("is-selected");
    selectedNode?.setAttribute("aria-expanded", "false");
    selectedNode = node || null;
    selectedNode?.classList.add("is-selected");
    selectedNode?.setAttribute("aria-expanded", "true");

    renderLocation(selectedLocation);
    if (backdrop) backdrop.hidden = false;
    panel.inert = false;
    panel.setAttribute("aria-hidden", "false");
    panel.classList.add("is-open");
    marketInterface.classList.add("intelligence-panel-open");
    window.requestAnimationFrame(() => byId("intelligencePanelClose")?.focus({ preventScroll: true }));
  }

  function closePanel({ restoreFocus = true } = {}) {
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    panel.inert = true;
    marketInterface.classList.remove("intelligence-panel-open");
    if (backdrop) backdrop.hidden = true;
    selectedNode?.classList.remove("is-selected");
    selectedNode?.setAttribute("aria-expanded", "false");
    if (restoreFocus) selectedNode?.focus({ preventScroll: true });
  }

  function applyManualStats(settings = {}) {
    const topLocation = settings.market_top_location_value || "Surat";
    setText("marketActiveListings", settings.market_listings_value || properties.length || "0");
    setText("marketAveragePrice", settings.market_average_value || "On request");
    setText("marketTopLocation", topLocation);
    markTopLocation(topLocation);
  }

  function applyLiveStats(items) {
    const pricedSale = items.filter(item => item.listing_purpose !== "Rent" && Number(item.price_amount) > 0);
    const average = pricedSale.length
      ? pricedSale.reduce((sum, item) => sum + Number(item.price_amount), 0) / pricedSale.length
      : 0;
    const locationCounts = items.reduce((counts, item) => {
      const key = String(item.location || item.city || "Surat").split(",")[0].trim();
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
    const topLocation = Object.entries(locationCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Surat";

    setText("marketActiveListings", items.length);
    setText("marketAveragePrice", money(average));
    setText("marketTopLocation", topLocation);
    markTopLocation(topLocation);
  }

  async function loadIntelligence() {
    properties = fallbackPropertiesFromCards();
    applyLiveStats(properties);

    if (!client) return;

    const [settingsResult, propertiesResult] = await Promise.all([
      client.from(window.GD_SITE_SETTINGS_TABLE || "gd_site_settings").select("*").eq("id", 1).maybeSingle(),
      client.from("properties").select("*").eq("published", true)
    ]);

    const settings = settingsResult.data || {};
    if (!propertiesResult.error && Array.isArray(propertiesResult.data) && propertiesResult.data.length) {
      properties = sortedNewest(propertiesResult.data);
    }

    if (settings.market_stats_auto === false) applyManualStats(settings);
    else applyLiveStats(properties);

    if (selectedLocation) renderLocation(selectedLocation);
  }

  document.addEventListener("click", event => {
    const node = event.target.closest("[data-intelligence-location]");
    if (!node) return;
    event.preventDefault();
    openPanel(node.dataset.intelligenceLocation || node.querySelector("span")?.textContent || "", node);
  });

  byId("intelligencePanelClose")?.addEventListener("click", () => closePanel());
  backdrop?.addEventListener("click", () => closePanel());

  byId("intelligenceViewProperties")?.addEventListener("click", () => {
    if (!selectedLocation) return;
    const location = selectedLocation;
    closePanel({ restoreFocus: false });
    window.KeyAssetsFrontend?.showLocationProperties?.(location);
    window.requestAnimationFrame(() => {
      document.getElementById("properties")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  byId("intelligenceGetOptions")?.addEventListener("click", () => {
    if (!selectedLocation) return;
    const location = selectedLocation;
    closePanel({ restoreFocus: false });
    window.openKeyAssetsLeadModal?.({
      location,
      selectedPropertyLocation: location,
      enquirySource: `Intelligence Radar - ${location}`,
      __liveMatch: true
    });
  });

  window.addEventListener("keyassets:cms-ready", () => {
    if (currentTopLocation) markTopLocation(currentTopLocation);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && panel.classList.contains("is-open")) closePanel();
  });

  loadIntelligence().catch(error => {
    console.warn("Market intelligence failed; local inventory retained.", error);
    applyLiveStats(properties);
  });
})();
