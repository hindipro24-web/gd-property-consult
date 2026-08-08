// STEP 1: Supabase dashboard > Project Settings > API se values paste karein.
window.KEYASSETS_SUPABASE_URL = "https://dfegilgonjmzxywesvzj.supabase.co";
window.KEYASSETS_SUPABASE_ANON_KEY = "sb_publishable_7mdXlv8T-y1XM7IAPl8SNQ_pqfw1ard";

window.isSupabaseConfigured = function () {
  return Boolean(
    window.KEYASSETS_SUPABASE_URL &&
    window.KEYASSETS_SUPABASE_ANON_KEY &&
    !window.KEYASSETS_SUPABASE_URL.includes("YOUR_") &&
    !window.KEYASSETS_SUPABASE_ANON_KEY.includes("YOUR_")
  );
};


// GD Property Consult V17.7 — isolated CMS configuration
window.GD_SITE_SETTINGS_TABLE = "gd_site_settings";
window.GD_SITE_SETTINGS_CACHE_KEY = "gd-property-consult-settings-v177";
