(function () {
  if (!window.isSupabaseConfigured || !window.isSupabaseConfigured() || !window.supabase) return;

  const client = window.KeyAssetsSupabaseClient || window.supabase.createClient(
    window.KEYASSETS_SUPABASE_URL,
    window.KEYASSETS_SUPABASE_ANON_KEY
  );
  window.KeyAssetsSupabaseClient = client;

  const SETTINGS_TABLE = window.GD_SITE_SETTINGS_TABLE || 'gd_site_settings';
  const SETTINGS_CACHE_KEY = window.GD_SITE_SETTINGS_CACHE_KEY || 'gd-property-consult-settings-v177';
  const safeText = (value, fallback = '') => value == null ? fallback : String(value);

  function presentationHeroCopy(settings) {
    const title = safeText(settings.hero_title).trim();
    const highlight = safeText(settings.hero_highlight).trim();
    const subtitle = safeText(settings.hero_subtitle).trim();
    const legacyCopy = /trusted partner/i.test(title) || /buy\s*,?\s*sell\s*&\s*rent in surat/i.test(`${title} ${highlight}`);

    if (!legacyCopy) return { title, highlight, subtitle };
    return {
      title: 'Exceptional Surat properties.',
      highlight: 'Personally shortlisted.',
      subtitle: 'Residential, commercial and investment opportunities selected around your location, budget and next move.'
    };
  }

  function verifiedSocialUrl(value, allowedHosts, fallback = '') {
    const candidates = [value, fallback].map(item => safeText(item).trim()).filter(Boolean);
    for (const candidate of candidates) {
      try {
        const parsed = new URL(candidate, window.location.href);
        const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
        if (parsed.protocol === 'https:' && allowedHosts.some(host => hostname === host || hostname.endsWith(`.${host}`))) {
          return parsed.href;
        }
      } catch {}
    }
    return '';
  }

  function readCachedSettings() {
    try {
      const cached = JSON.parse(localStorage.getItem(SETTINGS_CACHE_KEY) || 'null');
      return cached && typeof cached === 'object' ? cached : null;
    } catch {
      return null;
    }
  }

  function cacheSettings(settings) {
    try { localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings)); } catch {}
  }

  const setText = (selector, value) => document.querySelectorAll(selector).forEach(el => { if (value != null) el.textContent = value; });
  const setHref = (selector, value) => document.querySelectorAll(selector).forEach(el => { if (value) el.setAttribute('href', value); });
  const setSection = (id, visible) => { const el = document.getElementById(id); if (el) el.hidden = visible === false; };

  function applyBrand(settings) {
    document.querySelectorAll('.brand').forEach(brand => {
      const mark = brand.querySelector('.brand-mark');
      const strong = brand.querySelector('.brand-text strong');
      const small = brand.querySelector('.brand-text small');
      if (strong) strong.textContent = safeText(settings.site_name, 'GD Property');
      if (small) small.textContent = safeText(settings.site_suffix, 'CONSULT');
      if (mark) {
        if (settings.logo_url) {
          mark.classList.add('has-logo');
          mark.innerHTML = `<img src="${String(settings.logo_url).replace(/"/g, '&quot;')}" alt="${safeText(settings.site_name, 'Website')} logo">`;
        } else {
          mark.classList.remove('has-logo');
          const initials = `${safeText(settings.site_name, 'G').charAt(0)}${safeText(settings.site_suffix, 'D').charAt(0)}`.toUpperCase();
          mark.innerHTML = `<span>${initials}</span>`;
        }
      }
    });
  }

  function applySettings(settings) {
    const root = document.documentElement;
    if (settings.primary_color) root.style.setProperty('--teal', settings.primary_color);
    if (settings.secondary_color) root.style.setProperty('--teal-2', settings.secondary_color);
    if (settings.dark_color) root.style.setProperty('--ink', settings.dark_color);
    if (settings.light_color) root.style.setProperty('--paper', settings.light_color);

    applyBrand(settings);

    const heroCopy = presentationHeroCopy(settings);
    setText('#cmsHeroKicker', settings.hero_kicker);
    setText('#heroTitleMain', heroCopy.title);
    setText('#heroTitleHighlight', heroCopy.highlight);
    setText('#cmsHeroSubtitle', heroCopy.subtitle);
    const heroImage = document.getElementById('cmsHeroImage');
    if (heroImage && settings.hero_image_url) heroImage.src = settings.hero_image_url;
    setText('#cmsHeroPrimary', settings.hero_primary_label);
    const heroPrimaryLink = document.querySelector('#cmsHeroPrimaryLink');
    if (heroPrimaryLink) {
      heroPrimaryLink.href = '#heroSearchForm';
      heroPrimaryLink.setAttribute('data-scroll-to-property-match', '');
    }
    setText('#cmsHeroSecondary', settings.hero_secondary_label || 'View properties');
    setHref('#cmsHeroSecondaryLink', settings.hero_secondary_url || '#properties');

    setText('#cmsPropertiesEyebrow', settings.properties_eyebrow);
    setText('#cmsPropertiesHeading', settings.properties_heading);
    setText('#cmsPropertiesDescription', settings.properties_description);
    setText('#cmsMarketHeading', settings.market_heading);
    setText('#cmsMarketEyebrow', settings.market_eyebrow);
    setText('#cmsMarketDescription', settings.market_description);
    setText('#cmsIntelligenceTitle', settings.intelligence_title);
    setText('#cmsIntelligenceStatus', settings.intelligence_status);
    setText('#cmsListingsLabel', settings.market_listings_label);
    setText('#cmsAverageLabel', settings.market_average_label);
    setText('#cmsTopLocationLabel', settings.market_top_location_label);
    const radar = document.querySelector('.market-interface');
    if (radar) radar.hidden = settings.show_intelligence_radar === false;
    const core = document.querySelector('.radar-core');
    if (core && settings.market_core_text) core.textContent = settings.market_core_text;
    const nodeHost = document.getElementById('cmsIntelligenceNodes');
    if (nodeHost) {
      const raw = safeText(settings.intelligence_nodes_text, 'Vesu | Premium Residential\nParvat Patiya | Commercial\nGodadara | Buy & Rent\nBamroli | 2 & 3 BHK');
      const nodes = raw.split(/\n/).map(line => line.trim()).filter(Boolean).slice(0, 8).map(line => {
        const parts = line.split('|');
        return { name: (parts[0] || '').trim(), type: (parts[1] || 'Property').trim() };
      }).filter(item => item.name);
      const positions = [[17,25],[72,18],[77,67],[14,72],[44,10],[88,43],[46,82],[5,47]];
      nodeHost.innerHTML = nodes.map((item,index) => {
        const [left,top] = positions[index] || [50,50];
        const name = item.name.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const type = item.type.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        return `<button class="map-node cms-map-node" style="left:${left}%;top:${top}%" type="button"><span>${name}</span><small>${type}</small></button>`;
      }).join('');
    }
    setText('#cmsServicesHeading', settings.services_heading);
    setText('#cmsAboutHeading', settings.about_heading);
    setText('#cmsAboutText1', settings.about_text_1);
    setText('#cmsAboutText2', settings.about_text_2);
    const aboutOwnerImage = document.getElementById('cmsAboutOwnerImage');
    if (aboutOwnerImage && settings.about_image_url) aboutOwnerImage.src = settings.about_image_url;
    setText('#cmsTestimonialsHeading', settings.testimonials_heading);
    setText('#cmsInsightsEyebrow', String(settings.insights_eyebrow || '').trim() || 'PROPERTY INSIGHTS');
    setText('#cmsInsightsHeading', String(settings.insights_heading || '').trim() || 'Smarter guidance for confident property decisions.');
    setText('#cmsInsightsDescription', String(settings.insights_description || '').trim() || 'Explore location insights, buying guidance and investment perspectives curated for today’s property buyers.');
    setText('#cmsFaqHeading', settings.faq_heading);
    setText('#cmsCtaHeading', settings.cta_heading);
    setText('#cmsCtaButton', settings.cta_button_label);

    setText('#cmsFooterDescription', settings.footer_description);
    setText('#cmsFooterPhone', settings.phone);
    setText('#cmsFooterEmail', settings.email);
    const footerEmail = document.getElementById('cmsFooterEmail');
    if (footerEmail) footerEmail.hidden = !String(settings.email || '').trim();
    setText('#cmsFooterAddress', settings.address);
    setText('#cmsFooterHours', settings.business_hours);
    setText('#cmsFooterSlogan', settings.footer_slogan);
    setText('[data-cms-site-name]', `${safeText(settings.site_name, 'GD Property')} ${safeText(settings.site_suffix, 'Realty')}`.trim());

    const phoneDigits = safeText(settings.phone).replace(/[^0-9+]/g, '');
    setHref('#cmsFooterPhone', phoneDigits ? `tel:${phoneDigits}` : '');
    setHref('#cmsFooterEmail', settings.email ? `mailto:${settings.email}` : '');
    const socialLinks = [
      ['#cmsInstagram', verifiedSocialUrl(settings.instagram_url, ['instagram.com'], 'https://www.instagram.com/gd_property_consult/')],
      ['#cmsFacebook', verifiedSocialUrl(settings.facebook_url, ['facebook.com', 'fb.com'])],
      ['#cmsX', verifiedSocialUrl(settings.x_url, ['x.com', 'twitter.com'])],
      ['#cmsLinkedin', verifiedSocialUrl(settings.linkedin_url, ['linkedin.com'])]
    ];
    socialLinks.forEach(([selector, value]) => {
      const element = document.querySelector(selector);
      const usable = Boolean(value);
      if (element) element.hidden = !usable;
      setHref(selector, usable ? value : '');
    });

    const wa = safeText(settings.whatsapp_number).replace(/\D/g, '');
    const waMessage = encodeURIComponent(safeText(settings.whatsapp_message, 'Hello, I am interested in a property.'));
    const waLink = wa ? `https://wa.me/${wa}?text=${waMessage}` : '#';
    setHref('#cmsWhatsapp', waLink);
    const waEl = document.getElementById('cmsWhatsapp');
    if (waEl) waEl.setAttribute('aria-label', `Chat on WhatsApp ${settings.phone || ''}`.trim());

    setSection('properties', settings.show_properties);
    setSection('market', settings.show_market);
    setSection('services', settings.show_services);
    setSection('emi', settings.show_emi);
    setSection('about', settings.show_about);
    setSection('testimonials', settings.show_testimonials);
    setSection('blog', settings.show_blog);
    setSection('faq', settings.show_faq);
    setSection('contact', settings.show_contact);

    if (settings.seo_title) document.title = settings.seo_title;
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription && settings.seo_description) metaDescription.content = settings.seo_description;
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.name = 'keywords';
      document.head.appendChild(metaKeywords);
    }
    if (settings.seo_keywords) metaKeywords.content = settings.seo_keywords;
    if (settings.favicon_url) {
      let favicon = document.querySelector('link[rel="icon"]');
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
      }
      favicon.href = settings.favicon_url;
    }

    if (settings.custom_css) {
      let style = document.getElementById('cmsCustomCss');
      if (!style) {
        style = document.createElement('style');
        style.id = 'cmsCustomCss';
        document.head.appendChild(style);
      }
      style.textContent = settings.custom_css;
    }

    if (settings.maintenance_mode && !location.pathname.includes('/admin')) {
      document.body.innerHTML = `<main class="cms-maintenance"><div><span>GD PROPERTY CONSULT</span><h1>Website update in progress</h1><p>We are improving the experience. Please check again shortly.</p></div></main>`;
    }
  }

  const escapeTestimonialHtml = value => safeText(value, '').replace(/[&<>"']/g, character => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[character]));

  function testimonialImage(item) {
    return safeText(item.poster_image_url || item.avatar_url, '').trim();
  }

  function testimonialPosterCard(item) {
    const image = testimonialImage(item);
    if (!image) return '';

    const client = safeText(item.client_name, 'Verified client');
    const project = safeText(item.project_name, 'Property success');
    const location = safeText(item.location || item.client_role, 'Surat');
    const featured = item.featured ? '<span class="testimonial-featured-label">Featured</span>' : '';

    return `<button
      class="testimonial-poster-card reveal visible${item.featured ? ' is-featured' : ''}"
      type="button"
      data-testimonial-poster="${escapeTestimonialHtml(image)}"
      data-testimonial-title="${escapeTestimonialHtml(client)}"
      aria-label="Open ${escapeTestimonialHtml(client)} client success poster"
    >
      ${featured}
      <img
        src="${escapeTestimonialHtml(image)}"
        alt="${escapeTestimonialHtml(client)} testimonial poster for ${escapeTestimonialHtml(project)}, ${escapeTestimonialHtml(location)}"
        loading="lazy"
      >
      <span class="testimonial-poster-action">
        <span>
          <small>CLIENT SUCCESS</small>
          <strong>${escapeTestimonialHtml(project)}</strong>
          <em>${escapeTestimonialHtml(location)}</em>
        </span>
        <b>View full image ↗</b>
      </span>
    </button>`;
  }

  async function loadTestimonials() {
    const grid = document.getElementById('testimonialPosterGrid');
    if (!grid) return;

    const { data, error } = await client
      .from('testimonials')
      .select('*')
      .eq('published', true)
      .order('featured', { ascending: false })
      .order('sort_order')
      .order('created_at', { ascending: false })
      .limit(8);

    if (error) {
      console.warn('Testimonial load failed; fallback posters retained.', error.message);
      return;
    }

    const posterItems = (data || []).filter(item => testimonialImage(item)).slice(0, 8);
    if (!posterItems.length) return;

    grid.innerHTML = posterItems.map(testimonialPosterCard).join('');

    const count = document.getElementById('testimonialGalleryCount');
    if (count) count.textContent = `${posterItems.length} client ${posterItems.length === 1 ? 'story' : 'stories'}`;

    window.KeyAssetsFrontend?.observeReveals?.(grid);
  }

  function blogCard(post) {
    const image = post.cover_image || 'assets/gd-property-consult/gd-hero-wide.jpg';
    return `<article class="insight-card reveal visible">
      <div class="insight-media"><img src="${image}" alt="${safeText(post.title, 'Property insight').replace(/"/g, '&quot;')}" loading="lazy"></div>
      <div class="insight-body"><small>${safeText(post.category, 'PROPERTY GUIDE')}</small><h3>${safeText(post.title, '')}</h3><p>${safeText(post.excerpt, '')}</p></div>
    </article>`;
  }

  async function loadBlog() {
    const grid = document.getElementById('blogGrid');
    if (!grid) return;
    const { data, error } = await client.from('blog_posts').select('*').eq('published', true).order('featured', { ascending: false }).order('published_at', { ascending: false }).limit(6);
    if (!error && data?.length) grid.innerHTML = data.map(blogCard).join('');
  }

  async function init() {
    const cached = readCachedSettings();
    if (cached) applySettings(cached);

    let freshSettings = null;
    try {
      const request = client.from(SETTINGS_TABLE).select('*').eq('id', 1).maybeSingle();
      const timeout = new Promise(resolve => {
        window.setTimeout(() => resolve({ data: null, error: new Error('CMS request timeout') }), 1800);
      });
      const { data, error } = await Promise.race([request, timeout]);
      if (!error && data) {
        freshSettings = data;
        applySettings(data);
        cacheSettings(data);
      }
    } catch (error) {
      console.warn('GD CMS settings could not be refreshed.', error);
    }

    window.dispatchEvent(new CustomEvent('keyassets:cms-ready', {
      detail: freshSettings || cached || null
    }));

    Promise.allSettled([loadTestimonials(), loadBlog()]);
  }

  init().catch(error => {
    console.warn('GD CMS initialization failed.', error);
    window.dispatchEvent(new CustomEvent('keyassets:cms-ready', { detail: null }));
  });
})();
