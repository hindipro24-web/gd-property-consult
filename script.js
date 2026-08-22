// Replace this with your n8n PRODUCTION webhook before publishing.
// Example: https://automation.yourdomain.com/webhook/property-enquiry
const WEBHOOK_URL = (window.GD_WEBHOOK_URL || (((location.hostname === "localhost") || (location.hostname === "127.0.0.1")) ? "http://localhost:5678/webhook/property-enquiry" : "")).trim();

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const year = $("#year");
if (year) year.textContent = new Date().getFullYear();

// Header, progress and subtle hero parallax
const header = $(".site-header");
const progressBar = $("#pageProgress");
const heroImage = $(".hero-image");
let ticking = false;

function updateScrollEffects() {
  const scrollY = window.scrollY;
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  if (header) header.classList.toggle("scrolled", scrollY > 18);
  if (progressBar) progressBar.style.width = `${scrollable > 0 ? (scrollY / scrollable) * 100 : 0}%`;
  if (heroImage && !prefersReducedMotion && scrollY < window.innerHeight * 1.15) {
    heroImage.style.transform = `scale(1.04) translate3d(0, ${scrollY * 0.075}px, 0)`;
  }
  ticking = false;
}

window.addEventListener("scroll", () => {
  if (!ticking) {
    requestAnimationFrame(updateScrollEffects);
    ticking = true;
  }
}, { passive: true });
updateScrollEffects();

// Pointer glow
const cursorGlow = $("#cursorGlow");
if (cursorGlow && !prefersReducedMotion && window.matchMedia("(pointer:fine)").matches) {
  window.addEventListener("pointermove", event => {
    cursorGlow.style.left = `${event.clientX}px`;
    cursorGlow.style.top = `${event.clientY}px`;
    cursorGlow.style.opacity = "1";
  }, { passive: true });
  document.addEventListener("mouseleave", () => { cursorGlow.style.opacity = "0"; });
}

// Mobile navigation
const menuBtn = $("#menuBtn");
const mainNav = $("#mainNav");
const navBackdrop = $("#navBackdrop");
const siteHeader = $(".site-header");

function setMobileMenu(open) {
  if (!menuBtn || !mainNav) return;

  mainNav.classList.toggle("open", open);
  navBackdrop?.classList.toggle("open", open);
  siteHeader?.classList.toggle("menu-open", open);
  document.body.classList.toggle("nav-open", open);
  menuBtn.setAttribute("aria-expanded", String(open));
  menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");

  if (open) {
    window.setTimeout(() => mainNav.querySelector("a, button")?.focus(), 120);
  } else {
    menuBtn.focus({ preventScroll: true });
  }
}

if (menuBtn && mainNav) {
  menuBtn.addEventListener("click", () => {
    setMobileMenu(!mainNav.classList.contains("open"));
  });

  navBackdrop?.addEventListener("click", () => setMobileMenu(false));

  $$('a, button', mainNav).forEach(item => {
    item.addEventListener("click", () => setMobileMenu(false));
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && mainNav.classList.contains("open")) {
      setMobileMenu(false);
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900 && mainNav.classList.contains("open")) {
      setMobileMenu(false);
    }
  }, { passive: true });
}

// Reveal animation
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: "0px 0px -35px" });

function observeReveals(root = document) {
  $$(".reveal:not(.visible)", root).forEach(el => revealObserver.observe(el));
}
observeReveals();

// Lightweight 3D tilt. Disabled on touch and reduced-motion devices.
function initTilt(root = document) {
  if (prefersReducedMotion || !window.matchMedia("(pointer:fine)").matches) return;
  $$('[data-tilt]:not([data-tilt-ready])', root).forEach(card => {
    card.dataset.tiltReady = "true";
    card.addEventListener("pointermove", event => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      const rotateX = y * -4.5;
      const rotateY = x * 4.5;
      card.style.transform = `perspective(1100px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-3px)`;
    });
    card.addEventListener("pointerleave", () => {
      card.style.transform = "perspective(1100px) rotateX(0deg) rotateY(0deg) translateY(0)";
    });
  });
}
initTilt();

// Premium property image galleries. Dynamic Supabase cards call this again after rendering.
function initPropertySliders(root = document) {
  root.querySelectorAll?.("[data-property-slider]").forEach(slider => {
    if (slider.dataset.sliderReady === "true") return;
    slider.dataset.sliderReady = "true";
    const slides = [...slider.querySelectorAll("[data-property-slide]")];
    const dots = [...slider.querySelectorAll("[data-slider-dot]")];
    if (slides.length < 2) return;

    let index = Number(slider.dataset.sliderIndex || 0);
    let touchStartX = 0;
    const show = nextIndex => {
      index = (nextIndex + slides.length) % slides.length;
      slider.dataset.sliderIndex = String(index);
      slides.forEach((slide, slideIndex) => {
        const active = slideIndex === index;
        slide.classList.toggle("is-active", active);
        slide.setAttribute("aria-hidden", String(!active));
      });
      dots.forEach((dot, dotIndex) => {
        const active = dotIndex === index;
        dot.classList.toggle("is-active", active);
        dot.setAttribute("aria-current", String(active));
      });
      const counter = slider.querySelector(".property-image-count b");
      if (counter) counter.textContent = String(index + 1);
      const progress = slider.querySelector(".property-gallery-progress i");
      if (progress) progress.style.width = `${((index + 1) / slides.length) * 100}%`;
    };

    slider.addEventListener("click", event => {
      const previous = event.target.closest("[data-slider-prev]");
      const next = event.target.closest("[data-slider-next]");
      const dot = event.target.closest("[data-slider-dot]");
      if (!previous && !next && !dot) return;
      event.preventDefault();
      event.stopPropagation();
      if (previous) show(index - 1);
      if (next) show(index + 1);
      if (dot) show(Number(dot.dataset.sliderDot));
    });
    slider.addEventListener("touchstart", event => {
      touchStartX = event.changedTouches[0]?.clientX || 0;
    }, { passive:true });
    slider.addEventListener("touchend", event => {
      const distance = (event.changedTouches[0]?.clientX || 0) - touchStartX;
      if (Math.abs(distance) > 42) show(index + (distance < 0 ? 1 : -1));
    }, { passive:true });
  });
}
initPropertySliders();

// Featured inventory rail: five properties, numbered progress and large arrows.
(function initV23PropertyRail() {
  const grid = document.getElementById("propertyGrid");
  const previous = document.getElementById("v23PropertyPrevious");
  const next = document.getElementById("v23PropertyNext");
  const current = document.getElementById("v23PropertyCurrent");
  const total = document.getElementById("v23PropertyTotal");
  const progress = document.getElementById("v23PropertyProgress");
  if (!grid || !previous || !next) return;

  const cards = () => [...grid.querySelectorAll(".property-card")]
    .filter(card => getComputedStyle(card).display !== "none")
    .slice(0, 5);
  const nearestIndex = items => items.reduce((best, card, index) =>
    Math.abs(card.offsetLeft - grid.scrollLeft) < Math.abs(items[best].offsetLeft - grid.scrollLeft) ? index : best, 0);
  const update = () => {
    const items = cards();
    if (!items.length) return;
    const index = nearestIndex(items);
    current.textContent = String(index + 1).padStart(2, "0");
    total.textContent = `/ ${String(items.length).padStart(2, "0")}`;
    progress.style.width = `${((index + 1) / items.length) * 100}%`;
  };
  const move = direction => {
    const items = cards();
    if (!items.length) return;
    const target = items[(nearestIndex(items) + direction + items.length) % items.length];
    grid.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
  };
  previous.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));
  grid.addEventListener("scroll", () => requestAnimationFrame(update), { passive:true });
  new MutationObserver(update).observe(grid, { childList:true, attributes:true, subtree:true });
  update();
})();

// Magnetic buttons
if (!prefersReducedMotion && window.matchMedia("(pointer:fine)").matches) {
  $$(".magnetic").forEach(button => {
    button.addEventListener("pointermove", event => {
      const rect = button.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      button.style.transform = `translate(${x * 0.08}px, ${y * 0.11}px) translateY(-2px)`;
    });
    button.addEventListener("pointerleave", () => { button.style.transform = ""; });
  });
}

// Property filters
let activePropertyCategory = "all";
let activeListingPurpose = "all";

function filterProperties() {
  const grid = document.getElementById("propertyGrid");
  const cards = $$("#propertyGrid .property-card");
  const matchingCards = cards.filter(card => {
    const category = String(card.dataset.category || "apartment").trim().toLowerCase();
    const categoryMatches =
      activePropertyCategory === "all" ||
      category === activePropertyCategory;

    const purpose = String(card.dataset.listingPurpose || "Sale").trim().toLowerCase();
    const purposeMatches =
      activeListingPurpose === "all" ||
      purpose === activeListingPurpose;

    return categoryMatches && purposeMatches;
  });

  const visibleCards = matchingCards.slice(0, 5);
  const visibleSet = new Set(visibleCards);
  cards.forEach(card => {
    const show = visibleSet.has(card);
    card.hidden = !show;
    card.setAttribute("aria-hidden", String(!show));
    if (show) requestAnimationFrame(() => card.classList.add("visible"));
  });

  const emptyState = document.getElementById("propertyFilterEmpty");
  if (emptyState) emptyState.hidden = matchingCards.length > 0;

  const rail = document.getElementById("v23PropertyNav");
  if (rail) rail.hidden = visibleCards.length === 0;

  const inventoryText = document.getElementById("propertyInventoryText");
  if (inventoryText) {
    inventoryText.textContent = matchingCards.length > 5
      ? `Showing 5 of ${matchingCards.length} matching properties`
      : matchingCards.length
        ? `${matchingCards.length} matching ${matchingCards.length === 1 ? "property" : "properties"}`
        : "No exact match — try another filter";
  }

  if (grid && visibleCards.length) grid.scrollTo({ left: 0, behavior: "auto" });

  $$(".filter").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.filter === activePropertyCategory));
  });
  $$(".purpose-filter").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.purposeFilter === activeListingPurpose));
  });
}

function resetPropertyFilters() {
  activePropertyCategory = "all";
  activeListingPurpose = "all";
  $$(".filter").forEach(button => button.classList.toggle("active", button.dataset.filter === "all"));
  $$(".purpose-filter").forEach(button => button.classList.toggle("active", button.dataset.purposeFilter === "all"));
  filterProperties();
}

document.addEventListener("click", event => {
  const purposeFilterButton = event.target.closest(".purpose-filter");
  if (purposeFilterButton) {
    $$(".purpose-filter").forEach(btn => btn.classList.remove("active"));
    purposeFilterButton.classList.add("active");
    activeListingPurpose = purposeFilterButton.dataset.purposeFilter || "all";
    filterProperties();
    return;
  }

  if (event.target.closest("#resetPropertyFilters")) {
    resetPropertyFilters();
    return;
  }

  const filterButton = event.target.closest(".filter");
  if (filterButton) {
    $$(".filter").forEach(btn => btn.classList.remove("active"));
    filterButton.classList.add("active");
    activePropertyCategory = filterButton.dataset.filter || "all";
    filterProperties();
    return;
  }

  const wishlist = event.target.closest(".wishlist-btn");
  if (wishlist) {
    wishlist.classList.toggle("active");
    wishlist.textContent = wishlist.classList.contains("active") ? "♥" : "♡";
    return;
  }

  const detailsButton = event.target.closest(".property-details-btn");
  if (detailsButton) {
    const propertyName = detailsButton.dataset.property || "Skyline Residences";
    window.location.href = `property-details.html?property=${encodeURIComponent(propertyName)}`;
  }
});

filterProperties();

// EMI calculator
const loanAmount = $("#loanAmount");
const interestRate = $("#interestRate");
const loanTenure = $("#loanTenure");

function formatINR(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

function calculateEMI() {
  if (!loanAmount || !interestRate || !loanTenure) return;
  const principal = Number(loanAmount.value);
  const annualRate = Number(interestRate.value);
  const years = Number(loanTenure.value);
  const monthlyRate = annualRate / 12 / 100;
  const months = years * 12;
  const emi = monthlyRate === 0
    ? principal / months
    : principal * monthlyRate * Math.pow(1 + monthlyRate, months) /
      (Math.pow(1 + monthlyRate, months) - 1);

  $("#loanOut").textContent = formatINR(principal);
  $("#rateOut").textContent = `${annualRate.toFixed(1)}%`;
  $("#tenureOut").textContent = `${years} years`;
  $("#emiResult").textContent = formatINR(Math.round(emi));
  $("#emiSummary").textContent = `Loan ${formatINR(principal)} • ${annualRate.toFixed(1)}% • ${years} years`;
}

[loanAmount, interestRate, loanTenure].filter(Boolean).forEach(input => input.addEventListener("input", calculateEMI));
calculateEMI();

// Lead modal
const leadModal = $("#leadModal");
const successModal = $("#successModal");
const leadForm = $("#leadForm");
const steps = $$(".form-step");
const prevBtn = $("#prevBtn");
const nextBtn = $("#nextBtn");
const submitBtn = $("#submitBtn");
let currentStep = 1;
let shouldShowLiveMatches = false;
let leadPropertyConfigurations = [];
let leadPropertyBase = null;

function setNamedField(name, value) {
  if (!leadForm || !value) return;
  const field = leadForm.elements[name];
  if (!field) return;
  if (field instanceof RadioNodeList) {
    const radio = leadForm.querySelector(`input[name="${CSS.escape(name)}"][value="${CSS.escape(value)}"]`);
    if (radio) radio.checked = true;
  } else {
    field.value = value;
  }
}

function showStep(step) {
  if (!leadForm) return;
  currentStep = step;
  steps.forEach(section => section.classList.toggle("active", Number(section.dataset.step) === step));
  const percent = Math.round((step / steps.length) * 100);
  $("#stepLabel").textContent = `Step ${step} of ${steps.length}`;
  $("#progressPercent").textContent = `${percent}%`;
  $("#progressBar").style.width = `${percent}%`;
  prevBtn.style.visibility = step === 1 ? "hidden" : "visible";
  nextBtn.style.display = step === steps.length ? "none" : "inline-flex";
  submitBtn.style.display = step === steps.length ? "inline-flex" : "none";
}

function budgetLabelFromPrice(amount = 0) {
  const price = Number(amount || 0);
  if (!price) return "";
  if (price < 5000000) return "Below ₹50 Lakh";
  if (price < 7500000) return "₹50–75 Lakh";
  if (price < 10000000) return "₹75 Lakh–₹1 Crore";
  if (price < 20000000) return "₹1–2 Crore";
  if (price < 50000000) return "₹2–5 Crore";
  return "Above ₹5 Crore";
}

function normalizeLeadPropertyType(value = "") {
  const type = String(value).toLowerCase();
  if (type.includes("villa")) return "Villa";
  if (type.includes("plot") || type.includes("land")) return "Plot";
  if (type.includes("commercial") || type.includes("office") || type.includes("shop")) return "Commercial";
  return "Apartment";
}

function normalizeLeadBhk(value = "", type = "") {
  const bhk = String(value).trim();
  if (/[\/,]/.test(bhk) || /multiple|options/i.test(bhk)) return "";
  const exact = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "5+ BHK", "Not Applicable"];
  if (exact.includes(bhk)) return bhk;
  if (/1\s*bhk/i.test(bhk)) return "1 BHK";
  if (/2\s*bhk/i.test(bhk)) return "2 BHK";
  if (/3\s*bhk/i.test(bhk)) return "3 BHK";
  if (/4\s*bhk/i.test(bhk)) return "4 BHK";
  if (/5/i.test(bhk)) return "5+ BHK";
  return /plot|commercial/i.test(type) ? "Not Applicable" : "";
}

function setPropertyFieldLocked(fieldId, locked) {
  const wrapper = document.getElementById(fieldId);
  if (!wrapper) return;
  wrapper.classList.toggle("property-field-locked", locked);
}

function setPropertyEnquiryLocks(locked) {
  const lookingForInputs = $$('input[name="lookingFor"]', leadForm);
  lookingForInputs.forEach(input => {
    input.disabled = locked;
    input.setAttribute("aria-disabled", String(locked));
  });

  const typeInputs = $$('input[name="propertyType"]', leadForm);
  typeInputs.forEach(input => {
    input.disabled = locked;
    input.setAttribute("aria-disabled", String(locked));
  });

  const location = leadForm?.elements.location;
  if (location) {
    location.readOnly = locked;
    location.setAttribute("aria-readonly", String(locked));
  }

  const bhk = leadForm?.elements.bhk;
  if (bhk) {
    bhk.disabled = locked;
    bhk.setAttribute("aria-disabled", String(locked));
  }

  const budget = leadForm?.elements.budget;
  if (budget) {
    budget.disabled = locked;
    budget.setAttribute("aria-disabled", String(locked));
  }

  setPropertyFieldLocked("leadLookingForField", locked);
  setPropertyFieldLocked("leadPropertyTypeField", locked);
  setPropertyFieldLocked("leadLocationField", locked);
  setPropertyFieldLocked("leadBhkField", locked);
  setPropertyFieldLocked("leadBudgetField", locked);
}

function clearPropertyEnquiryContext() {
  const context = $("#propertyEnquiryContext");
  if (context) context.hidden = true;

  const picker = $("#propertyConfigurationPicker");
  const select = $("#propertyConfigurationSelect");
  if (picker) picker.hidden = true;
  if (select) select.innerHTML = "";

  leadPropertyConfigurations = [];
  leadPropertyBase = null;
  setPropertyEnquiryLocks(false);

  leadForm?.classList.remove("property-enquiry-mode");
  $("#leadFormTitle").textContent = "Tell us what you are looking for";
  $("#leadFormSubtitle").textContent = "Complete three quick steps. It takes less than two minutes.";
}

function normalizePropertyConfigurations(value) {
  if (Array.isArray(value)) return value.filter(item => item && item.name && item.published !== false);
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.filter(item => item && item.name && item.published !== false) : [];
  } catch {
    return [];
  }
}

function configurationPriceAmount(configuration = {}) {
  return Number(configuration.price_amount || parseIndianPriceText(configuration.price_label || "") || 0);
}

function applyLeadPropertyConfiguration(configuration = {}, base = leadPropertyBase || {}) {
  const propertyType = base.selectedPropertyType || base.propertyType || "Property";
  const location = base.selectedPropertyLocation || base.location || "";
  const name = configuration.name || base.selectedPropertyBhk || base.bhk || "Not specified";
  const price = configuration.price_label || base.propertyPrice || "On request";
  const priceAmount = configurationPriceAmount(configuration) || Number(base.propertyPriceAmount || 0);
  const area = configuration.area || base.propertyArea || "";
  const listingPurpose =
    String(base.listingPurpose || base.selectedListingPurpose || "Sale").toLowerCase() === "rent"
      ? "Rent"
      : "Sale";

  setNamedField("propertyConfigurationId", configuration.id || base.propertyConfigurationId || "");
  setNamedField("selectedPropertyBhk", name);
  setNamedField("selectedPropertyType", propertyType);
  setNamedField("selectedPropertyLocation", location);
  setNamedField("propertyPrice", price);
  setNamedField("propertyArea", area);
  setNamedField("selectedPropertyBudgetRange", budgetLabelFromPrice(priceAmount));
  setNamedField("selectedListingPurpose", listingPurpose);

  setNamedField("lookingFor", listingPurpose === "Rent" ? "Rent" : "Buy");
  setNamedField("propertyType", propertyType);
  setNamedField("bhk", normalizeLeadBhk(name, propertyType) || name);
  setNamedField("location", location);
  setNamedField("budget", budgetLabelFromPrice(priceAmount));

  $("#contextPropertyPrice").textContent = price;
  $("#contextPropertyBhk").textContent = name;
  $("#contextPropertyType").textContent = `${propertyType} • For ${listingPurpose}`;
  $("#contextPropertyLocation").textContent = location || "Location on request";
}

function showPropertyEnquiryContext(property = {}) {
  const context = $("#propertyEnquiryContext");
  if (!context || !property.propertyName) {
    clearPropertyEnquiryContext();
    return;
  }

  leadPropertyBase = { ...property };
  leadPropertyConfigurations = normalizePropertyConfigurations(property.propertyConfigurations);

  context.hidden = false;
  leadForm?.classList.add("property-enquiry-mode");
  setPropertyEnquiryLocks(true);

  $("#leadFormTitle").textContent = `Enquire about ${property.propertyName}`;
  $("#leadFormSubtitle").textContent = "Complete your contact details and our advisor will assist you with this listing.";
  $("#contextPropertyName").textContent = property.propertyName || "Selected property";

  const picker = $("#propertyConfigurationPicker");
  const select = $("#propertyConfigurationSelect");

  if (leadPropertyConfigurations.length > 1 && picker && select) {
    picker.hidden = false;
    select.innerHTML = leadPropertyConfigurations.map(item => {
      const id = String(item.id || "");
      const label = [item.name, item.price_label, item.area].filter(Boolean).join(" • ");
      return `<option value="${id.replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]))}">${label.replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]))}</option>`;
    }).join("");

    const requestedId = String(property.propertyConfigurationId || "");
    const selected =
      leadPropertyConfigurations.find(item => String(item.id || "") === requestedId) ||
      leadPropertyConfigurations.find(item => item.featured || item.is_default) ||
      [...leadPropertyConfigurations].sort((a, b) => configurationPriceAmount(a) - configurationPriceAmount(b))[0];

    select.value = String(selected?.id || "");
    applyLeadPropertyConfiguration(selected || {}, property);
  } else {
    if (picker) picker.hidden = true;
    const onlyConfiguration = leadPropertyConfigurations[0] || {};
    applyLeadPropertyConfiguration(onlyConfiguration, property);
  }
}

$("#propertyConfigurationSelect")?.addEventListener("change", event => {
  const selected = leadPropertyConfigurations.find(item => String(item.id || "") === String(event.target.value));
  if (selected) applyLeadPropertyConfiguration(selected);
});
function propertyPrefillFromCard(card) {
  const meta = $$(".property-meta span, .match-meta span", card).map(item => item.textContent.trim());
  const priceText =
    card.dataset.propertyPrice ||
    $(".property-price strong", card)?.textContent.trim() ||
    "On request";
  const priceAmount =
    Number(card.dataset.propertyPriceAmount || card.dataset.price || 0) ||
    parseIndianPriceText(priceText);
  const propertyType = normalizeLeadPropertyType(
    card.dataset.propertyType ||
    card.dataset.category ||
    meta.find(item => /apartment|villa|plot|commercial|office/i.test(item)) ||
    ""
  );
  const bhk = normalizeLeadBhk(
    card.dataset.propertyBhk ||
    meta.find(item => /bhk|not applicable/i.test(item)) ||
    "",
    propertyType
  );
  const location =
    card.dataset.propertyLocation ||
    $(".property-location", card)?.textContent.trim() ||
    "";
  const propertyName =
    card.dataset.propertyName ||
    $("h3", card)?.textContent.trim() ||
    "Selected Property";
  const area =
    card.dataset.propertyArea ||
    meta.find(item => /sq\.?ft|sqft/i.test(item)) ||
    "";
  const configurations = normalizePropertyConfigurations(card.dataset.propertyConfigurations);
  const listingPurpose =
    String(card.dataset.listingPurpose || "Sale").toLowerCase() === "rent"
      ? "Rent"
      : "Sale";

  return {
    propertyId: card.dataset.propertyId || "",
    propertyConfigurationId: card.dataset.propertyConfigurationId || "",
    propertyConfigurations: configurations,
    propertyName,
    propertyPrice: priceText,
    propertyPriceAmount: priceAmount,
    propertyArea: area,
    selectedPropertyType: propertyType,
    selectedPropertyBhk: bhk || "",
    selectedPropertyLocation: location,
    selectedPropertyBudgetRange: budgetLabelFromPrice(priceAmount),
    selectedListingPurpose: listingPurpose,
    listingPurpose,
    enquirySource: `Property Card Enquiry - ${propertyName}`,
    propertyType,
    bhk: bhk || "",
    location,
    budget: budgetLabelFromPrice(priceAmount),
    lookingFor: listingPurpose === "Rent" ? "Rent" : "Buy"
  };
}
function openLeadModal(prefill = {}) {
  if (!leadModal || !leadForm) return;

  shouldShowLiveMatches = Boolean(prefill.__liveMatch);
  delete prefill.__liveMatch;

  leadForm.reset();
  $("#charCount").textContent = "0/500";
  clearPropertyEnquiryContext();

  leadModal.classList.add("open");
  leadModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  Object.entries(prefill).forEach(([key, value]) => setNamedField(key, value));
  showPropertyEnquiryContext(prefill);
  showStep(1);
}
window.openKeyAssetsLeadModal = openLeadModal;

function closeLeadModal() {
  if (!leadModal) return;
  setPropertyEnquiryLocks(false);
  leadModal.classList.remove("open");
  leadModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

document.addEventListener("click", event => {
  const leadTrigger = event.target.closest(".open-lead-form");
  if (leadTrigger) {
    closeMatchModal();
    const propertyCard = leadTrigger.closest(".property-card, .match-card");
    openLeadModal(propertyCard ? propertyPrefillFromCard(propertyCard) : {});
  }
  if (event.target.closest("[data-close-modal]")) closeLeadModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && leadModal?.classList.contains("open")) closeLeadModal();
  if (event.key === "Escape" && $("#matchModal")?.classList.contains("open")) closeMatchModal();
});

function fieldWrapper(field) {
  if (!field) return null;
  if (field.type === "radio") {
    return field.closest(".field") || field.closest(".choice-grid")?.parentElement;
  }
  return field.closest(".field") || field.parentElement;
}

function setError(field, message) {
  const wrapper = fieldWrapper(field);
  wrapper?.classList.add("invalid");

  const error = $(".error", wrapper);
  if (error) error.textContent = message;

  field?.setAttribute("aria-invalid", "true");
}

function clearFieldError(field) {
  const wrapper = fieldWrapper(field);
  wrapper?.classList.remove("invalid");

  const error = $(".error", wrapper);
  if (error) error.textContent = "";

  field?.removeAttribute("aria-invalid");
}

function clearErrors(stepSection) {
  $$(".invalid", stepSection).forEach(element => element.classList.remove("invalid"));
  $$(".error", stepSection).forEach(element => {
    element.textContent = "";
  });
  $$("[aria-invalid='true']", stepSection).forEach(field => {
    field.removeAttribute("aria-invalid");
  });

  const formError = $("#formError");
  if (formError) formError.textContent = "";
}

function requiredFieldMessage(field) {
  const name = field.name || "";

  if (field.type === "radio") return "Please select an option.";
  if (field.type === "checkbox") return "Please accept this checkbox.";
  if (name === "fullName") return "Please enter your full name.";
  if (name === "mobile") return "Please enter your mobile number.";
  if (name === "email") return "Please enter your email address.";
  if (name === "contactMethod") return "Please choose a contact method.";
  if (name === "location") return "Please enter a preferred location.";
  if (name === "bhk") return "Please choose a BHK or configuration.";
  if (name === "budget") return "Please choose a budget.";
  if (name === "timeline") return "Please choose a purchase timeline.";
  if (name === "loanRequired") return "Please choose a loan option.";
  if (name === "contactTime") return "Please choose a contact time.";

  return "This field is required.";
}

function validateStep(step, options = {}) {
  const { focus = false } = options;
  const section = steps[step - 1];
  if (!section) return true;

  clearErrors(section);

  let valid = true;
  let firstInvalid = null;
  const requiredFields = $$("[required]", section);
  const radioNamesChecked = new Set();

  requiredFields.forEach(field => {
    // Property-specific enquiry values are locked and stored in hidden fields.
    if (field.disabled) return;

    if (field.type === "radio") {
      if (radioNamesChecked.has(field.name)) return;
      radioNamesChecked.add(field.name);

      const selected = section.querySelector(
        `input[name="${CSS.escape(field.name)}"]:checked:not(:disabled)`
      );

      if (!selected) {
        setError(field, requiredFieldMessage(field));
        firstInvalid ||= field;
        valid = false;
      }
      return;
    }

    if (field.type === "checkbox") {
      if (!field.checked) {
        const formError = $("#formError");
        if (formError) formError.textContent = "Please accept before submitting.";
        field.setAttribute("aria-invalid", "true");
        firstInvalid ||= field;
        valid = false;
      }
      return;
    }

    const value = String(field.value || "").trim();

    if (!value) {
      setError(field, requiredFieldMessage(field));
      firstInvalid ||= field;
      valid = false;
      return;
    }

    if (field.name === "fullName" && value.length < 2) {
      setError(field, "Name must contain at least 2 characters.");
      firstInvalid ||= field;
      valid = false;
    }

    if (field.name === "location" && value.length < 2) {
      setError(field, "Enter a valid location.");
      firstInvalid ||= field;
      valid = false;
    }
  });

  const mobile = section.querySelector('input[name="mobile"]:not(:disabled)');
  if (mobile?.value && !/^[6-9]\d{9}$/.test(mobile.value.trim())) {
    setError(mobile, "Enter a valid 10-digit Indian mobile number.");
    firstInvalid ||= mobile;
    valid = false;
  }

  const email = section.querySelector('input[name="email"]:not(:disabled)');
  if (email?.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    setError(email, "Enter a valid email address.");
    firstInvalid ||= email;
    valid = false;
  }

  if (focus && firstInvalid) {
    firstInvalid.focus({ preventScroll: true });
    fieldWrapper(firstInvalid)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center"
    });
  }

  return valid;
}

function validatePropertyEnquiryContext() {
  if (!leadForm?.classList.contains("property-enquiry-mode")) return true;

  const requiredContext = [
    ["propertyName", "Property name"],
    ["selectedPropertyType", "Property type"],
    ["selectedPropertyLocation", "Property location"],
    ["selectedPropertyBhk", "BHK / configuration"],
    ["propertyPrice", "Property price"],
    ["selectedListingPurpose", "Listing purpose"]
  ];

  const missing = requiredContext
    .filter(([name]) => !String(leadForm.elements[name]?.value || "").trim())
    .map(([, label]) => label);

  if (!missing.length) return true;

  const formError = $("#formError");
  if (formError) {
    formError.textContent =
      `Selected property data is incomplete: ${missing.join(", ")}. Please reopen the property enquiry.`;
  }
  return false;
}

function validateAllLeadSteps() {
  let firstInvalidStep = null;

  for (let step = 1; step <= steps.length; step += 1) {
    if (!validateStep(step)) {
      firstInvalidStep ||= step;
    }
  }

  if (!validatePropertyEnquiryContext()) {
    firstInvalidStep ||= 3;
  }

  if (firstInvalidStep) {
    showStep(firstInvalidStep);
    validateStep(firstInvalidStep, { focus: true });

    const formError = $("#formError");
    if (formError && !formError.textContent) {
      formError.textContent = "Please complete every required field before submitting.";
    }
    return false;
  }

  return true;
}

nextBtn?.addEventListener("click", () => {
  if (!validateStep(currentStep, { focus: true })) return;
  showStep(Math.min(currentStep + 1, steps.length));
});

prevBtn?.addEventListener("click", () => {
  showStep(Math.max(currentStep - 1, 1));
});

leadForm?.addEventListener("input", event => {
  const field = event.target.closest("input, select, textarea");
  if (!field) return;

  if (field.type === "radio") {
    const selected = leadForm.querySelector(
      `input[name="${CSS.escape(field.name)}"]:checked`
    );
    if (selected) clearFieldError(field);
    return;
  }

  if (field.type === "checkbox") {
    if (field.checked) {
      field.removeAttribute("aria-invalid");
      const formError = $("#formError");
      if (formError) formError.textContent = "";
    }
    return;
  }

  if (String(field.value || "").trim()) clearFieldError(field);
});

leadForm?.addEventListener("change", event => {
  const field = event.target.closest("input, select, textarea");
  if (!field) return;

  if (field.type === "radio") {
    clearFieldError(field);
  } else if (field.type === "checkbox") {
    if (field.checked) {
      field.removeAttribute("aria-invalid");
      const formError = $("#formError");
      if (formError) formError.textContent = "";
    }
  } else if (String(field.value || "").trim()) {
    clearFieldError(field);
  }
});

leadForm?.addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  if (event.target.matches("textarea")) return;

  // Enter advances only after the current step is complete.
  if (currentStep < steps.length) {
    event.preventDefault();
    if (validateStep(currentStep, { focus: true })) {
      showStep(currentStep + 1);
    }
  }
});

const requirements = leadForm?.elements.requirements;
requirements?.addEventListener("input", () => { $("#charCount").textContent = `${requirements.value.length}/500`; });

// Hero property match console
// This is a private search only: it does not create a lead, call n8n or save to CRM.
$("#heroSearchForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const form = event.currentTarget;
  const locationInput = form.elements.location;
  locationInput.value = String(locationInput.value || "").trim();

  if (locationInput.value.length < 2) {
    locationInput.setCustomValidity("Please enter a valid preferred location.");
  } else {
    locationInput.setCustomValidity("");
  }

  if (!form.reportValidity()) return;

  const data = Object.fromEntries(new FormData(form).entries());
  const search = {
    location: String(data.location || "").trim(),
    propertyType: String(data.propertyType || "").trim(),
    budget: String(data.budget || "").trim()
  };

  try {
    await showLiveMatches(search);
  } catch (error) {
    console.error("Property matching failed", error);
    const results = $("#matchResults");
    const empty = $("#matchEmpty");
    if (results) results.innerHTML = "";
    if (empty) empty.hidden = false;
    if ($("#matchSummary")) {
      $("#matchSummary").textContent = "Properties could not be loaded. Please try again.";
    }
  }
});

function calculateLeadScore(payload) {
  let score = 0;
  if (["Immediately", "Within 1 month"].includes(payload.timeline)) score += 35;
  else if (payload.timeline === "Within 3 months") score += 20;
  else if (payload.timeline === "Within 6 months") score += 10;

  const scoringBudget = payload.budgetRange || payload.selectedPropertyBudgetRange || payload.budget;
  if (["₹1–2 Crore", "₹2–5 Crore", "Above ₹5 Crore"].includes(scoringBudget)) score += 30;
  else if (["₹75 Lakh–₹1 Crore", "₹50–75 Lakh"].includes(scoringBudget)) score += 20;
  else score += 10;

  if (payload.lookingFor === "Buy" || payload.lookingFor === "Invest") score += 20;
  if (payload.loanRequired === "No") score += 10;
  if (payload.email) score += 5;
  return { score, status: score >= 70 ? "HOT" : score >= 45 ? "WARM" : "COLD" };
}

function formDataToObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function budgetRange(label = "") {
  const ranges = {
    "Below ₹50 Lakh": [0, 5000000],
    "₹50–75 Lakh": [5000000, 7500000],
    "₹75 Lakh–₹1 Crore": [7500000, 10000000],
    "₹1–2 Crore": [10000000, 20000000],
    "₹2–5 Crore": [20000000, 50000000],
    "Above ₹5 Crore": [50000000, Infinity]
  };
  return ranges[label] || [0, Infinity];
}

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePropertyType(value = "") {
  const type = normalizeText(value);
  if (type.includes("villa")) return "villa";
  if (type.includes("plot") || type.includes("land")) return "plot";
  if (type.includes("commercial") || type.includes("office") || type.includes("shop")) return "commercial";
  if (type.includes("apartment") || type.includes("flat")) return "apartment";
  return type;
}

function locationMatchScore(propertyLocation, wantedLocation) {
  const location = normalizeText(propertyLocation);
  const wanted = normalizeText(wantedLocation);
  if (!location || !wanted) return 0;
  if (location.includes(wanted)) return 100;

  const tokens = wanted
    .split(" ")
    .filter(token => token.length >= 3 && token !== "pune");

  if (tokens.length && tokens.every(token => location.includes(token))) return 95;
  return 0;
}

function publishedPropertyConfigurations(property) {
  const list = Array.isArray(property.configurations) ? property.configurations : [];
  return list.filter(item => item && item.published !== false && item.name);
}

function expandPropertyConfigurations(properties = []) {
  return properties.flatMap(property => {
    const configurations = publishedPropertyConfigurations(property);
    if (!configurations.length) return [property];
    return configurations.map(configuration => ({
      ...property,
      configuration_id: configuration.id || "",
      configuration_name: configuration.name,
      price_label: configuration.price_label || property.price_label,
      price_amount: Number(configuration.price_amount || property.price_amount || 0),
      bhk: configuration.name || property.bhk,
      area: configuration.area || property.area,
      status_label: configuration.status_label || property.status_label,
      configuration_facilities: Array.isArray(configuration.facilities) ? configuration.facilities : [],
      detail_url: `property-details.html?id=${encodeURIComponent(property.id)}&config=${encodeURIComponent(configuration.id || "")}`
    }));
  });
}

function propertyMatchesSearch(property, search) {
  const locationScore = locationMatchScore(
    `${property.location || ""} ${property.city || ""}`,
    search.location
  );
  const typeMatches =
    normalizePropertyType(property.property_type) ===
    normalizePropertyType(search.propertyType);

  const price = Number(property.price_amount || 0);
  const [minimum, maximum] = budgetRange(search.budget);
  const budgetMatches =
    price > 0 &&
    price >= minimum &&
    (Number.isFinite(maximum) ? price < maximum : true);

  return {
    matches: locationScore > 0 && typeMatches && budgetMatches,
    matchScore: locationScore === 100 ? 100 : 95
  };
}

function parseIndianPriceText(value = "") {
  const text = String(value).replace(/,/g, "").trim().toLowerCase();
  const numeric = Number((text.match(/[\d.]+/) || [0])[0]);
  if (!numeric) return 0;
  if (text.includes("cr")) return numeric * 10000000;
  if (text.includes("lakh") || text.includes("lac")) return numeric * 100000;
  return numeric;
}

function fallbackPropertiesFromCards() {
  return $$(".property-card").map((card, index) => {
    const detailsLink = $(".property-actions a", card);
    const detailsButton = $(".property-details-btn", card);
    const meta = $$(".property-meta span", card).map(item => item.textContent.trim());
    const propertyType =
      card.dataset.category ||
      meta.find(item => /apartment|villa|plot|commercial|office/i.test(item)) ||
      "";

    return {
      id: "",
      title: $("h3", card)?.textContent.trim() || `Property ${index + 1}`,
      location: $(".property-location", card)?.textContent.trim() || "",
      city: "",
      price_label: $(".property-price strong", card)?.textContent.trim() || "Price on request",
      price_amount: parseIndianPriceText($(".property-price strong", card)?.textContent || ""),
      property_type: propertyType,
      listing_purpose: card.dataset.listingPurpose || "Sale",
      bhk: meta.find(item => /bhk/i.test(item)) || "",
      area: meta.find(item => /sq\.?ft|sqft/i.test(item)) || "",
      main_image: $(".property-media img", card)?.src || "",
      detail_url:
        detailsLink?.getAttribute("href") ||
        (detailsButton?.dataset.property
          ? `property-details.html?property=${encodeURIComponent(detailsButton.dataset.property)}`
          : "#properties")
    };
  });
}

function escapeMatchHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[character]));
}

function matchCard(property) {
  const image = property.main_image || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=84";
  const detailHref = property.detail_url || (property.id ? `property-details.html?id=${encodeURIComponent(property.id)}` : "#properties");
  const listingPurpose = property.listing_purpose === "Rent" ? "Rent" : "Sale";
  return `<article class="match-card" data-property-id="${escapeMatchHtml(property.id || "")}" data-property-configuration-id="${escapeMatchHtml(property.configuration_id || "")}" data-property-name="${escapeMatchHtml(property.title || "Property")}" data-property-price="${escapeMatchHtml(property.price_label || "Price on request")}" data-property-price-amount="${Number(property.price_amount || 0)}" data-property-bhk="${escapeMatchHtml(property.bhk || "")}" data-property-type="${escapeMatchHtml(property.property_type || "Property")}" data-listing-purpose="${listingPurpose}" data-property-location="${escapeMatchHtml([property.location, property.city].filter(Boolean).join(", "))}" data-property-area="${escapeMatchHtml(property.area || "")}">
    <div class="match-card-image"><img src="${escapeMatchHtml(image)}" alt="${escapeMatchHtml(property.title)}"><span class="match-score">${property.matchScore}% match</span></div>
    <div class="match-card-body">
      <small>${escapeMatchHtml([property.location, property.city].filter(Boolean).join(", "))}</small>
      <h3>${escapeMatchHtml(property.title || "Property")}</h3>
      <p><small>${listingPurpose === "Rent" ? "Monthly rent" : "Sale price"}</small><strong>${escapeMatchHtml(property.price_label || "Price on request")}</strong></p>
      <div class="match-meta"><span>For ${listingPurpose}</span><span>${escapeMatchHtml(property.property_type || "Property")}</span><span>${escapeMatchHtml(property.bhk || "Configuration on request")}</span><span>${escapeMatchHtml(property.area || "Area on request")}</span></div>
      <div class="match-card-actions"><a class="property-btn property-btn-outline" href="${detailHref}">View details</a><button class="property-btn property-btn-primary open-lead-form" type="button">Site visit ↗</button></div>
    </div>
  </article>`;
}

async function showLiveMatches(search) {
  const modal = $("#matchModal");
  const results = $("#matchResults");
  const empty = $("#matchEmpty");
  if (!modal || !results || !empty) return false;

  results.innerHTML = '<p class="match-loading">Checking live inventory…</p>';
  empty.hidden = true;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  let properties = [];
  const client = window.KeyAssetsSupabaseClient;

  if (client) {
    const { data, error } = await client
      .from("properties")
      .select("*")
      .eq("published", true);

    if (error) {
      console.warn("Supabase match search failed; using visible property cards.", error.message);
    } else {
      properties = data || [];
    }
  }

  // Keeps the demo useful even when Supabase is temporarily unavailable.
  if (!properties.length) {
    properties = fallbackPropertiesFromCards();
  }

  const candidates = expandPropertyConfigurations(properties);

  const matches = candidates
    .map(property => {
      const result = propertyMatchesSearch(property, search);
      return { ...property, matchScore: result.matchScore, __matches: result.matches };
    })
    .filter(property => property.__matches)
    .sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return Number(a.price_amount || 0) - Number(b.price_amount || 0);
    })
    .slice(0, 12);

  results.innerHTML = matches.map(matchCard).join("");
  empty.hidden = matches.length > 0;

  $("#matchSummary").textContent = matches.length
    ? `${matches.length} exact ${matches.length === 1 ? "property" : "properties"} found for ${search.location}, ${search.propertyType} and ${search.budget}.`
    : `No published property currently matches ${search.location}, ${search.propertyType} and ${search.budget}. Try changing one filter.`;

  return true;
}

function closeMatchModal() {
  const modal = $("#matchModal");
  modal?.classList.remove("open");
  modal?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

$("#matchClose")?.addEventListener("click", closeMatchModal);
$("#matchDone")?.addEventListener("click", closeMatchModal);

leadForm?.addEventListener("submit", async event => {
  event.preventDefault();

  // A submit event from Step 1 or Step 2 (for example by pressing Enter)
  // can only advance to the next validated step; it cannot bypass the form.
  if (currentStep < steps.length) {
    if (validateStep(currentStep, { focus: true })) {
      showStep(currentStep + 1);
    }
    return;
  }

  if (!validateAllLeadSteps()) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";
  const payload = formDataToObject(leadForm);

  // A property-card enquiry always keeps the exact selected property context.
  if (payload.propertyName) {
    payload.propertyType = payload.selectedPropertyType || payload.propertyType;
    payload.bhk = payload.selectedPropertyBhk || payload.bhk;
    payload.location = payload.selectedPropertyLocation || payload.location;
    payload.budgetRange = payload.selectedPropertyBudgetRange || "";
    payload.budget = payload.propertyPrice || payload.budget;
  }

  payload.leadType = "PROPERTY_ENQUIRY";
  payload.countryCode = "+91";
  payload.phoneWithCountryCode = `+91${payload.mobile}`;
  payload.leadId = `GD${Date.now().toString().slice(-8)}`;
  payload.submittedAt = new Date().toISOString();
  payload.source = payload.enquirySource || "GD Property Consult Website";
  payload.pageUrl = window.location.href;
  const leadScore = calculateLeadScore(payload);
  payload.leadScore = leadScore.score;
  payload.leadStatus = leadScore.status;

  try {
    let databaseSaved = false;
    let automationSent = false;
    const cmsClient = window.KeyAssetsSupabaseClient;
    if (cmsClient) {
      const { error: leadError } = await cmsClient.from("leads").insert({
        lead_id: payload.leadId,
        full_name: payload.fullName,
        mobile: payload.mobile,
        email: payload.email || null,
        contact_method: payload.contactMethod || null,
        looking_for: payload.lookingFor || null,
        property_type: payload.propertyType || null,
        location: payload.location || null,
        bhk: payload.bhk || null,
        budget: payload.budget || null,
        timeline: payload.timeline || null,
        loan_required: payload.loanRequired || null,
        contact_time: payload.contactTime || null,
        property_id: payload.propertyId || null,
        property_name: payload.propertyName || null,
        property_price: payload.propertyPrice || null,
        property_area: payload.propertyArea || null,
        requirements: payload.requirements || null,
        source: payload.source,
        page_url: payload.pageUrl,
        lead_score: payload.leadScore,
        status: payload.leadStatus
      });
      if (!leadError) databaseSaved = true;
      else console.warn("Lead database save failed", leadError.message);
    }

    if (WEBHOOK_URL) {
      try {
        const response = await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        automationSent = response.ok;
        if (!response.ok) console.warn("n8n webhook returned", response.status);
      } catch (webhookError) {
        console.warn("n8n webhook request failed", webhookError);
      }
    }

    if (!databaseSaved && !automationSent) throw new Error("Lead could not be saved. Run the V11 Supabase schema or connect the production n8n webhook.");

    closeLeadModal();
    $("#successLeadId").textContent = payload.leadId;
    successModal.classList.add("open");
    successModal.setAttribute("aria-hidden", "false");
    leadForm.reset();
    shouldShowLiveMatches = false;
    $("#charCount").textContent = "0/500";
    showStep(1);
  } catch (error) {
    console.error(error);
    $("#formError").textContent = error.message || "Submission failed. Please try again.";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit enquiry";
  }
});

$("#successClose")?.addEventListener("click", () => {
  successModal.classList.remove("open");
  successModal.setAttribute("aria-hidden", "true");
});

// Reinitialize interactions after Supabase replaces the fallback cards.
window.KeyAssetsFrontend = {
  observeReveals,
  initTilt,
  initPropertySliders,
  applyPropertyFilters: filterProperties
};


// Start Property Match button
// Always scrolls directly to the three-field Property Match Console.
// It never opens the consultation/CRM form.
const startPropertyMatchButton = document.querySelector("[data-scroll-to-property-match]");
const propertyMatchConsole = document.getElementById("heroSearchForm");

startPropertyMatchButton?.addEventListener("click", event => {
  event.preventDefault();
  if (!propertyMatchConsole) return;

  propertyMatchConsole.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "center"
  });

  propertyMatchConsole.classList.remove("property-match-highlight");
  requestAnimationFrame(() => {
    propertyMatchConsole.classList.add("property-match-highlight");
  });

  window.setTimeout(() => {
    propertyMatchConsole.classList.remove("property-match-highlight");
  }, 1500);

  window.setTimeout(() => {
    propertyMatchConsole.querySelector('input[name="location"]')?.focus({
      preventScroll: true
    });
  }, 550);
});

// The page-level mobile CTA is useful elsewhere, but property cards already have
// their own actions. Hide it while the property rail is in view so it cannot cover a card.
(() => {
  const mobileCta = document.querySelector(".mobile-cta");
  const propertiesSection = document.getElementById("properties");
  if (!mobileCta || !propertiesSection || !("IntersectionObserver" in window)) return;

  const update = isVisible => {
    mobileCta.classList.toggle(
      "is-context-hidden",
      isVisible && window.matchMedia("(max-width: 640px)").matches
    );
  };
  const observer = new IntersectionObserver(entries => update(entries[0]?.isIntersecting), {
    threshold: 0.08
  });
  observer.observe(propertiesSection);
})();


// GD V17.1 — Testimonial poster lightbox
(() => {
  const lightbox = document.getElementById("testimonialPosterLightbox");
  const lightboxImage = document.getElementById("testimonialPosterLightboxImage");
  const lightboxTitle = document.getElementById("testimonialPosterLightboxTitle");
  const closeButton = document.getElementById("testimonialPosterClose");
  if (!lightbox || !lightboxImage) return;

  let previouslyFocused = null;

  const closePosterLightbox = () => {
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    lightboxImage.src = "";
    lightboxImage.alt = "";
    document.body.classList.remove("testimonial-lightbox-open");
    previouslyFocused?.focus?.();
  };

  document.addEventListener("click", event => {
    const trigger = event.target.closest("[data-testimonial-poster]");
    if (!trigger) return;

    const source = trigger.dataset.testimonialPoster;
    const title = trigger.dataset.testimonialTitle || "Client success";
    if (!source) return;

    previouslyFocused = trigger;
    lightboxImage.src = source;
    lightboxImage.alt = `${title} client success poster`;
    if (lightboxTitle) lightboxTitle.textContent = title;
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("testimonial-lightbox-open");
    closeButton?.focus();
  });

  closeButton?.addEventListener("click", closePosterLightbox);

  lightbox.addEventListener("click", event => {
    if (event.target === lightbox) closePosterLightbox();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && lightbox.classList.contains("open")) {
      closePosterLightbox();
    }
  });
})();


// GD V17.4 — Four-card testimonial slider
(() => {
  const grid = document.getElementById("testimonialPosterGrid");
  const shell = grid?.closest(".testimonial-gallery-shell");
  const previous = document.getElementById("testimonialGalleryPrevious");
  const next = document.getElementById("testimonialGalleryNext");
  const dots = document.getElementById("testimonialGalleryDots");

  if (!grid || !shell) return;

  let currentPage = 0;
  let pageCount = 1;
  let autoplayTimer = null;
  let resizeTimer = null;
  const AUTOPLAY_DELAY = 5200;

  const cards = () => [...grid.querySelectorAll(".testimonial-poster-card")];

  const visibleCards = () => {
    if (window.matchMedia("(max-width: 600px)").matches) return 1;
    if (window.matchMedia("(max-width: 850px)").matches) return 2;
    if (window.matchMedia("(max-width: 1150px)").matches) return 3;
    return 4;
  };

  const reducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const targetCardForPage = page => {
    const items = cards();
    const index = Math.min(page * visibleCards(), Math.max(0, items.length - 1));
    return items[index] || null;
  };

  const updateArrowState = () => {
    const multiplePages = pageCount > 1;
    shell.classList.toggle("has-pages", multiplePages);

    if (previous) {
      previous.disabled = !multiplePages;
      previous.setAttribute("aria-hidden", String(!multiplePages));
    }

    if (next) {
      next.disabled = !multiplePages;
      next.setAttribute("aria-hidden", String(!multiplePages));
    }
  };

  const updateDots = () => {
    if (!dots) return;

    dots.innerHTML = Array.from({ length: pageCount }, (_, index) => `
      <button
        type="button"
        class="${index === currentPage ? "active" : ""}"
        data-testimonial-page="${index}"
        aria-label="Show testimonial group ${index + 1}"
        aria-current="${index === currentPage ? "true" : "false"}"
      ></button>
    `).join("");

    dots.classList.toggle("visible", pageCount > 1);
  };

  const updateActiveDot = () => {
    dots?.querySelectorAll("[data-testimonial-page]").forEach((dot, index) => {
      const active = index === currentPage;
      dot.classList.toggle("active", active);
      dot.setAttribute("aria-current", String(active));
    });
  };

  const goToPage = (page, options = {}) => {
    if (pageCount <= 1) {
      currentPage = 0;
      grid.scrollTo({ left: 0, behavior: "auto" });
      updateActiveDot();
      return;
    }

    const loopedPage = ((page % pageCount) + pageCount) % pageCount;
    const target = targetCardForPage(loopedPage);
    if (!target) return;

    currentPage = loopedPage;
    grid.scrollTo({
      left: target.offsetLeft,
      behavior: options.instant || reducedMotion() ? "auto" : "smooth"
    });
    updateActiveDot();
  };

  const calculatePages = () => {
    const total = cards().length;
    pageCount = Math.max(1, Math.ceil(total / visibleCards()));
    currentPage = Math.min(currentPage, pageCount - 1);

    updateArrowState();
    updateDots();
    goToPage(currentPage, { instant: true });
    restartAutoplay();
  };

  const nextPage = () => goToPage(currentPage + 1);
  const previousPage = () => goToPage(currentPage - 1);

  const stopAutoplay = () => {
    if (autoplayTimer) {
      window.clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  };

  const startAutoplay = () => {
    stopAutoplay();
    if (pageCount <= 1 || reducedMotion() || document.hidden) return;

    autoplayTimer = window.setInterval(() => {
      goToPage(currentPage + 1);
    }, AUTOPLAY_DELAY);
  };

  function restartAutoplay() {
    stopAutoplay();
    startAutoplay();
  }

  previous?.addEventListener("click", () => {
    previousPage();
    restartAutoplay();
  });

  next?.addEventListener("click", () => {
    nextPage();
    restartAutoplay();
  });

  dots?.addEventListener("click", event => {
    const button = event.target.closest("[data-testimonial-page]");
    if (!button) return;
    goToPage(Number(button.dataset.testimonialPage));
    restartAutoplay();
  });

  shell.addEventListener("mouseenter", stopAutoplay);
  shell.addEventListener("mouseleave", startAutoplay);
  shell.addEventListener("focusin", stopAutoplay);
  shell.addEventListener("focusout", event => {
    if (!shell.contains(event.relatedTarget)) startAutoplay();
  });

  grid.addEventListener("touchstart", stopAutoplay, { passive: true });
  grid.addEventListener("touchend", startAutoplay, { passive: true });

  grid.addEventListener("scroll", () => {
    window.clearTimeout(grid._testimonialScrollTimer);
    grid._testimonialScrollTimer = window.setTimeout(() => {
      const items = cards();
      const perPage = visibleCards();
      if (!items.length) return;

      let nearestIndex = 0;
      let nearestDistance = Infinity;

      items.forEach((card, index) => {
        const distance = Math.abs(card.offsetLeft - grid.scrollLeft);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      currentPage = Math.min(
        pageCount - 1,
        Math.max(0, Math.round(nearestIndex / perPage))
      );
      updateActiveDot();
    }, 90);
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAutoplay();
    else startAutoplay();
  });

  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(calculatePages, 160);
  });

  const observer = new MutationObserver(calculatePages);
  observer.observe(grid, { childList: true });

  calculatePages();
})();
