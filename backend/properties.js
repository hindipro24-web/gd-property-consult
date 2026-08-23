(function () {
  if (!window.isSupabaseConfigured || !window.isSupabaseConfigured()) return;
  if (!window.supabase) return;

  const client = window.KeyAssetsSupabaseClient || window.supabase.createClient(
    window.KEYASSETS_SUPABASE_URL,
    window.KEYASSETS_SUPABASE_ANON_KEY
  );
  window.KeyAssetsSupabaseClient = client;

  const grid = document.getElementById("propertyGrid");
  if (!grid) return;

  const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));

  function normalizeCategory(type = "apartment") {
    const value = String(type).toLowerCase();
    if (value.includes("villa")) return "villa";
    if (value.includes("plot") || value.includes("land")) return "plot";
    if (value.includes("commercial") || value.includes("office") || value.includes("shop")) return "commercial";
    return "apartment";
  }

  function listingPurpose(property) {
    return property?.listing_purpose === "Rent" ? "Rent" : "Sale";
  }

  function professionalStatus(value = "") {
    const status = String(value || "").trim();
    if (/^move\s*to\s*go$/i.test(status)) return "Ready to move";
    return status || "Available";
  }

  function displayPrice(property, configuration = null) {
    const label = String(configuration?.price_label || property?.price_label || "").trim();
    const amount = Number(configuration?.price_amount || property?.price_amount || 0);
    const invalidRentalPrice = listingPurpose(property) === "Rent" && (amount >= 1000000 || /\b(?:cr|crore|lakh|lac)\b/i.test(label));
    return {
      label: invalidRentalPrice ? "Rent on request" : (label || "On request"),
      amount: invalidRentalPrice ? 0 : amount
    };
  }

  function priceCaption(property) {
    return listingPurpose(property) === "Rent" ? "Monthly rent" : "Starting from";
  }

  function publishedConfigurations(property) {
    const list = Array.isArray(property.configurations) ? property.configurations : [];
    return list
      .filter(item => item && item.published !== false && item.name)
      .map(item => {
        const price = displayPrice(property, item);
        return {
          ...item,
          price_label: price.label,
          price_amount: price.amount,
          status_label: professionalStatus(item.status_label || property.status_label)
        };
      });
  }

  function startingConfiguration(property) {
    const list = publishedConfigurations(property);
    if (!list.length) return null;
    return list.find(item => item.featured) || [...list].sort((a,b) => {
      const av = Number(a.price_amount || Number.MAX_SAFE_INTEGER);
      const bv = Number(b.price_amount || Number.MAX_SAFE_INTEGER);
      return av - bv;
    })[0];
  }

  function propertyImages(property) {
    const gallery = Array.isArray(property.gallery_images) ? property.gallery_images : [];
    return [...new Set([property.main_image, ...gallery].filter(Boolean))].slice(0, 8);
  }

  function propertyMedia(property, title, index) {
    const images = propertyImages(property);
    if (!images.length) images.push("assets/gd-property-consult/gd-hero-wide.jpg");
    const slides = images.map((image, slideIndex) => `
      <figure class="property-slide${slideIndex === 0 ? " is-active" : ""}" data-property-slide="${slideIndex}" aria-hidden="${slideIndex !== 0}">
        <img src="${escapeHtml(image)}" alt="${title}${images.length > 1 ? ` — image ${slideIndex + 1}` : ""}" loading="${slideIndex === 0 ? "eager" : "lazy"}">
      </figure>`).join("");
    const controls = images.length > 1 ? `
      <div class="property-slider-controls" aria-label="Property gallery controls">
        <button class="property-slider-arrow prev" type="button" data-slider-prev aria-label="Previous property image">‹</button>
        <div class="property-gallery-progress" aria-hidden="true"><i></i></div>
        <button class="property-slider-arrow next" type="button" data-slider-next aria-label="Next property image">›</button>
      </div>
      <span class="property-image-count"><b>1</b> / ${images.length}</span>` : "";
    return `<div class="property-media property-slider" data-property-slider data-slider-index="0" data-slider-total="${images.length}">
      <div class="property-slider-track">${slides}</div>
      <div class="property-shade"></div>
      ${controls}
      <div class="property-labels">
        ${property.verified ? '<span class="verified-badge">✓ Verified</span>' : ""}
        <span class="listing-purpose-badge ${listingPurpose(property).toLowerCase()}">For ${listingPurpose(property)}</span>
        <span>${escapeHtml(professionalStatus(property.status_label))}</span>
      </div>
      <button class="wishlist-btn" type="button" aria-label="Save ${title}">♡</button>
      <div class="property-index">${String(index + 1).padStart(2, "0")}</div>
    </div>`;
  }

  function card(property, index) {
    const category = normalizeCategory(property.property_type);
    const featuredClass = index === 0 ? " property-card-featured" : "";
    const title = escapeHtml(property.title || "Property");
    const location = [property.location, property.city].filter(Boolean).join(", ");
    const detailHref = `property-details.html?id=${encodeURIComponent(property.id)}`;
    const configurations = publishedConfigurations(property);
    const starting = startingConfiguration(property);
    const price = displayPrice(property, starting);
    const displayPriceLabel = price.label;
    const displayPriceAmount = price.amount;
    const configurationNames = configurations.map(item => item.name).join(" / ");
    const displayBhk = configurationNames || property.bhk || property.property_type || "Property";
    const displayArea = configurations.length > 1 ? `${configurations.length} options` : (starting?.area || property.area || "Area on request");

    if (index === 0) {
      return `
        <article class="property-card${featuredClass} reveal visible" data-category="${category}" data-location="${escapeHtml(location)}" data-price="${displayPriceAmount}" data-title="${title}" data-property-id="${escapeHtml(property.id || "")}" data-property-configuration-id="${escapeHtml(starting?.id || "")}" data-property-name="${title}" data-property-price="${escapeHtml(displayPriceLabel)}" data-property-price-amount="${displayPriceAmount}" data-property-bhk="${escapeHtml(starting?.name || property.bhk || "Not Applicable")}" data-property-configuration-count="${configurations.length}" data-property-configurations="${escapeHtml(JSON.stringify(configurations))}" data-listing-purpose="${listingPurpose(property)}" data-property-type="${escapeHtml(property.property_type || "Property")}" data-property-location="${escapeHtml(location)}" data-property-area="${escapeHtml(starting?.area || property.area || "Area on request")}" data-tilt>
          ${propertyMedia(property, title, index)}
          <div class="property-body">
            <div class="property-heading">
              <div><small class="property-location">${escapeHtml(location)}</small><h3>${title}</h3></div>
              <div class="property-price"><span>${priceCaption(property)}</span><strong>${escapeHtml(displayPriceLabel)}</strong></div>
            </div>
            <div class="property-meta">
              <span>${escapeHtml(displayBhk)}</span>
              <span>${escapeHtml(displayArea)}</span>
              <span>${escapeHtml(property.property_type || "Property")}</span>
            </div>
            <div class="property-actions">
              <a class="property-btn property-btn-outline" href="${detailHref}">View details</a>
              <button class="property-btn property-btn-primary open-lead-form" type="button">Enquire now ↗</button>
            </div>
          </div>
        </article>`;
    }

    return `
      <article class="property-card reveal visible" data-category="${category}" data-location="${escapeHtml(location)}" data-price="${displayPriceAmount}" data-title="${title}" data-property-id="${escapeHtml(property.id || "")}" data-property-configuration-id="${escapeHtml(starting?.id || "")}" data-property-name="${title}" data-property-price="${escapeHtml(displayPriceLabel)}" data-property-price-amount="${displayPriceAmount}" data-property-bhk="${escapeHtml(starting?.name || property.bhk || "Not Applicable")}" data-property-configuration-count="${configurations.length}" data-property-configurations="${escapeHtml(JSON.stringify(configurations))}" data-listing-purpose="${listingPurpose(property)}" data-property-type="${escapeHtml(property.property_type || "Property")}" data-property-location="${escapeHtml(location)}" data-property-area="${escapeHtml(starting?.area || property.area || "Area on request")}" data-tilt>
        ${propertyMedia(property, title, index)}
        <div class="property-body">
          <small class="property-location">${escapeHtml(location)}</small>
          <h3>${title}</h3>
          <div class="property-meta">
            <span>${escapeHtml(displayBhk)}</span>
            <span>${escapeHtml(displayArea)}</span>
            <span>${escapeHtml(property.property_type || "Property")}</span>
          </div>
          <div class="property-price inline-price"><span>${priceCaption(property)}</span><strong>${escapeHtml(displayPriceLabel)}</strong></div>
          <div class="property-actions">
            <a class="property-btn property-btn-outline" href="${detailHref}">View details</a>
            <button class="property-btn property-btn-primary open-lead-form" type="button">Enquire ↗</button>
          </div>
        </div>
      </article>`;
  }

  function propertyTimestamp(property) {
    const timestamp = Date.parse(property?.created_at || "");
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function orderPropertiesForHero(items) {
    const newest = [...items].sort((a, b) => propertyTimestamp(b) - propertyTimestamp(a));
    const manualHero = newest
      .filter(property => property.featured)
      .sort((a, b) => propertyTimestamp(b) - propertyTimestamp(a))[0] || null;

    if (!manualHero) {
      return {
        mode: "auto",
        hero: newest[0] || null,
        ordered: newest
      };
    }

    return {
      mode: "manual",
      hero: manualHero,
      ordered: newest
    };
  }

  function setHeroText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function applyHeroProperty(property, mode) {
    if (!property) return;

    const configurations = publishedConfigurations(property);
    const starting = startingConfiguration(property);
    const purpose = listingPurpose(property);
    const image = property.main_image || document.getElementById("cmsHeroImage")?.src || "";
    const location = [property.location, property.city].filter(Boolean).join(", ");
    const price = displayPrice(property, starting).label;
    const detailHref = `property-details.html?id=${encodeURIComponent(property.id)}`;

    const imageElement = document.getElementById("cmsHeroImage");
    if (imageElement) {
      imageElement.src = image;
      imageElement.alt = `${property.title || "Property"} — ${location || "GD Property Consult"}`;
    }

    setHeroText(
      "heroFeaturedTag",
      `${mode === "manual" ? "Featured selection" : "Latest listing"} • For ${purpose}`
    );
    setHeroText("heroFeaturedTitle", property.title || "Property");
    setHeroText("heroFeaturedLocation", location || "Location on request");
    setHeroText("heroFeaturedPriceCaption", purpose === "Rent" ? "Monthly rent" : "From");
    setHeroText("heroFeaturedPrice", price);

    const detailsLink = document.getElementById("heroFeaturedDetails");
    if (detailsLink) {
      detailsLink.href = detailHref;
      detailsLink.setAttribute("aria-label", `View ${property.title || "property"} details`);
    }

    const visual = document.getElementById("heroFeaturedVisual");
    if (visual) {
      visual.dataset.propertyId = property.id || "";
      visual.dataset.heroMode = mode;
    }
  }

  async function loadProperties() {
    const { data, error } = await client
      .from("properties")
      .select("*")
      .eq("published", true);

    if (error) {
      console.warn("Supabase property load failed; fallback cards retained.", error.message);
      return;
    }
    if (!data || !data.length) return;

    const display = orderPropertiesForHero(data);
    applyHeroProperty(display.hero, display.mode);

    // Keep the full published inventory available to the filters. Cards stay
    // ordered by creation date so every newly added property appears first.
    grid.innerHTML = display.ordered.map(card).join("");
    window.KeyAssetsFrontend?.observeReveals(grid);
    window.KeyAssetsFrontend?.initTilt(grid);
    window.KeyAssetsFrontend?.initPropertySliders?.(grid);
    window.KeyAssetsFrontend?.applyPropertyFilters?.();
  }

  loadProperties();
})();
