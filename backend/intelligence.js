(function () {
  if (!window.isSupabaseConfigured?.() || !window.KeyAssetsSupabaseClient) return;

  const client = window.KeyAssetsSupabaseClient;

  const money = value => {
    const amount = Number(value || 0);
    if (!amount) return "On request";
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(amount % 10000000 ? 1 : 0)} Cr`;
    }
    return `₹${(amount / 100000).toFixed(amount % 100000 ? 1 : 0)} L`;
  };

  const set = (id, value) => {
    const element = document.getElementById(id);
    if (element && value != null && String(value).trim()) {
      element.textContent = String(value);
    }
  };

  const applyManualStats = settings => {
    set("marketActiveListings", settings?.market_listings_value || "3");
    set("marketAveragePrice", settings?.market_average_value || "₹2.0 CR");
    set("marketTopLocation", settings?.market_top_location_value || "BANER");
  };

  async function loadIntelligence() {
    const [settingsResult, propertiesResult] = await Promise.all([
      client.from("site_settings").select("*").eq("id", 1).maybeSingle(),
      client
        .from("properties")
        .select("price_amount,location,city,property_type,listing_purpose")
        .eq("published", true)
    ]);

    const settings = settingsResult.data || {};
    const autoCalculate = settings.market_stats_auto !== false;

    if (!autoCalculate) {
      applyManualStats(settings);
      return;
    }

    const data = propertiesResult.data;
    if (propertiesResult.error || !Array.isArray(data)) {
      applyManualStats(settings);
      return;
    }

    // Keep the homepage average meaningful: monthly rents are not mixed into sale prices.
    const priced = data.filter(item =>
      item.listing_purpose !== "Rent" &&
      Number(item.price_amount) > 0
    );
    const average = priced.length
      ? priced.reduce((sum, item) => sum + Number(item.price_amount), 0) / priced.length
      : 0;

    const locationCounts = data.reduce((accumulator, item) => {
      const key = item.location || item.city || "Surat";
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});

    const topLocation =
      Object.entries(locationCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      settings.market_top_location_value ||
      "Surat";

    set("marketActiveListings", String(data.length));
    set("marketAveragePrice", money(average));
    set("marketTopLocation", topLocation);
  }

  loadIntelligence().catch(error => {
    console.warn("Market intelligence failed", error);
  });
})();
