const configured = Boolean(window.isSupabaseConfigured?.());
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const byId = id => document.getElementById(id);
const setupNotice = byId('setupNotice');
if (!configured) setupNotice.classList.remove('hidden');

const client = configured ? window.supabase.createClient(window.KEYASSETS_SUPABASE_URL, window.KEYASSETS_SUPABASE_ANON_KEY) : null;
let siteSettings = {};
let properties = [];
let leads = [];
let testimonials = [];
let posts = [];
let currentProfile = null;
let salesAgents = [];
let automationRules = [];
let automationJobs = [];
let salesAutomationAvailable = false;
let pendingGalleryUrls = [];
let commandModeTransitionTimer = null;
let commandModeHideTimer = null;
let commandModeNavigationTimer = null;

const panelMeta = {
  overview:['SALES MANAGER OS','Command Center'], branding:['IDENTITY SYSTEM','Branding & Theme'], homepage:['PAGE BUILDER','Homepage'], properties:['INVENTORY CONTROL','Properties'], leads:['SALES OPERATIONS','Leads & CRM'], automation:['REVENUE OPERATIONS','Sales Automation'], testimonials:['SOCIAL PROOF','Testimonials'], blog:['CONTENT ENGINE','Blog / Insights'], footer:['CONTACT SYSTEM','Footer & Contact'], seo:['ADVANCED CONTROL','SEO & Custom CSS'], media:['ASSET STORAGE','Media Library']
};

function setStatus(text, type='') {
  const el = byId('saveStatus');
  if (!el) return;
  el.textContent = text;
  el.className = `save-status ${type}`.trim();
}
const adminAuthLoader = byId('adminAuthLoader');

function showAuthLoading(message='Checking secure admin session…'){
  document.body.classList.add('auth-pending');
  adminAuthLoader?.classList.remove('hidden');
  byId('authView').classList.add('hidden');
  byId('dashboardView').classList.add('hidden');
  const text=byId('adminAuthLoaderText');
  if(text)text.textContent=message;
}

function finishAuthLoading(){
  document.body.classList.remove('auth-pending');
  adminAuthLoader?.classList.add('hidden');
}

function showAuth(){
  currentProfile = null;
  document.body.classList.remove('super-admin-capable','super-command-mode');
  if (byId('standardCommandLaunch')) byId('standardCommandLaunch').hidden = true;
  byId('authView').classList.remove('hidden');
  byId('dashboardView').classList.add('hidden');
  finishAuthLoading();
}

function showDashboard(){
  byId('authView').classList.add('hidden');
  byId('dashboardView').classList.remove('hidden');
  finishAuthLoading();
}

function isSuperAdminProfile(){
  return currentProfile?.role === 'super_admin';
}

function runCommandModeTransition(active){
  const overlay = byId('commandModeTransition');
  if (!overlay) return;
  window.clearTimeout(commandModeTransitionTimer);
  window.clearTimeout(commandModeHideTimer);
  byId('commandTransitionTitle').textContent = active ? 'GD Intelligence Online' : 'Admin Workspace Restored';
  byId('commandTransitionText').textContent = active
    ? 'Synchronizing live CRM command systems…'
    : 'Returning to focused website management…';
  overlay.classList.remove('hidden');
  requestAnimationFrame(()=>overlay.classList.add('active'));
  commandModeTransitionTimer = window.setTimeout(()=>{
    overlay.classList.remove('active');
    commandModeHideTimer = window.setTimeout(()=>overlay.classList.add('hidden'),240);
  },1050);
}

function setAdminCommandMode(enabled,{animate=true,navigate=true}={}){
  const active = Boolean(enabled && isSuperAdminProfile());
  document.body.classList.toggle('super-command-mode',active);
  if (animate) runCommandModeTransition(active);
  window.clearTimeout(commandModeNavigationTimer);
  if (navigate){
    commandModeNavigationTimer = window.setTimeout(()=>{
      if (active){openPanel('leads');setCrmView('workspace')}
      else openPanel('overview');
    },animate?620:0);
  }
}
function escapeHtml(value=''){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function slugify(value=''){return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function arrayFromLines(value=''){return String(value).split(/[\n,]/).map(x=>x.trim()).filter(Boolean)}
function formatDate(value){return value?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'—'}
function toDateTimeLocal(value){
  if(!value)return '';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return '';
  const local=new Date(date.getTime()-date.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,16);
}
function automationSchemaMissing(error){
  const message=String(error?.message||'');
  return ['42P01','42703','PGRST204','PGRST205'].includes(error?.code)||/automation_(rules|jobs)|assigned_to|follow_up_at|next_action|schema cache|does not exist/i.test(message);
}
function agentDisplayName(agent={}){
  return agent.full_name||agent.email||(agent.user_id===currentProfile?.user_id?'Super Admin':`${String(agent.team_role||agent.role||'sales').replace(/_/g,' ')} agent`);
}
function populateLeadAgentSelect(selected=''){
  const select=byId('leadAssignedTo');
  if(!select)return;
  select.innerHTML=`<option value="">Unassigned</option>${salesAgents.map(agent=>`<option value="${escapeHtml(agent.user_id)}">${escapeHtml(agentDisplayName(agent))}</option>`).join('')}`;
  select.value=selected||'';
}

function renderSalesAutomation(){
  const active=leads.filter(lead=>!isDeletedLead(lead)&&!['WON','LOST'].includes(lead.status));
  const now=new Date();
  const endToday=new Date(now);endToday.setHours(23,59,59,999);
  const due=active.filter(lead=>lead.follow_up_at&&new Date(lead.follow_up_at)>=now&&new Date(lead.follow_up_at)<=endToday);
  const overdue=active.filter(lead=>lead.follow_up_at&&new Date(lead.follow_up_at)<now);
  const queued=automationJobs.filter(job=>['queued','processing'].includes(job.status));
  if(byId('automationBackendStatus'))byId('automationBackendStatus').textContent=salesAutomationAvailable?'Live':'Setup required';
  if(byId('automationDueCount'))byId('automationDueCount').textContent=due.length;
  if(byId('automationOverdueCount'))byId('automationOverdueCount').textContent=overdue.length;
  if(byId('automationQueueCount'))byId('automationQueueCount').textContent=queued.length;
  if(byId('automationDatabaseLabel'))byId('automationDatabaseLabel').textContent=salesAutomationAvailable?'Queue online':'Migration pending';
  byId('automationMigrationNotice')?.classList.toggle('hidden',salesAutomationAvailable);

  const enabled=automationRules.filter(rule=>rule.enabled).length;
  if(byId('automationRuleCount'))byId('automationRuleCount').textContent=`${enabled} enabled`;
  const rulesHost=byId('automationRules');
  if(rulesHost)rulesHost.innerHTML=automationRules.map(rule=>`<button type="button" class="v32-rule ${rule.enabled?'active':''}" data-automation-rule="${escapeHtml(rule.id)}" aria-pressed="${Boolean(rule.enabled)}">
    <span class="v32-rule-icon">${rule.channel==='whatsapp'?'WA':rule.channel==='email'?'@':'↻'}</span>
    <span><strong>${escapeHtml(rule.name)}</strong><small>${escapeHtml(rule.description||`${rule.channel} automation`)}</small></span>
    <i>${rule.enabled?'ON':'OFF'}</i>
  </button>`).join('')||'<div class="v32-empty">Run the V32 database migration to install sales rules.</div>';

  if(byId('automationAgentCount'))byId('automationAgentCount').textContent=`${salesAgents.length} agents`;
  const agentsHost=byId('automationAgents');
  if(agentsHost)agentsHost.innerHTML=salesAgents.map(agent=>{
    const owned=active.filter(lead=>lead.assigned_to===agent.user_id);
    const late=owned.filter(lead=>lead.follow_up_at&&new Date(lead.follow_up_at)<now).length;
    const initials=agentDisplayName(agent).split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase();
    return `<article class="v32-agent"><span>${escapeHtml(initials||'SA')}</span><div><strong>${escapeHtml(agentDisplayName(agent))}</strong><small>${escapeHtml(agent.team_role||'Sales agent')} • ${owned.length} open leads</small></div><b class="${late?'warning':''}">${late?`${late} late`:'On track'}</b></article>`;
  }).join('')||'<div class="v32-empty">Add active sales agents in admin_profiles.</div>';

  const failed=automationJobs.filter(job=>job.status==='failed').length;
  if(byId('automationJobSummary'))byId('automationJobSummary').textContent=automationJobs.length?`${queued.length} queued • ${failed} failed`:'No jobs';
  const jobsHost=byId('automationJobs');
  if(jobsHost)jobsHost.innerHTML=automationJobs.slice(0,18).map(job=>`<article class="v32-job">
    <span class="v32-job-channel">${job.channel==='whatsapp'?'WA':job.channel==='email'?'@':'↻'}</span>
    <div><strong>${escapeHtml(job.rule_key||job.template_name||'Sales automation')}</strong><small>${escapeHtml(job.recipient||'Recipient pending')} • ${formatDate(job.created_at)}</small></div>
    <em class="status-${escapeHtml(job.status||'queued')}">${escapeHtml(job.status||'queued')}</em>
    ${job.status==='failed'?`<button type="button" data-retry-job="${escapeHtml(job.id)}">Retry</button>`:''}
  </article>`).join('')||'<div class="v32-empty">Outbound WhatsApp and email jobs will appear here.</div>';
}

async function loadSalesAutomation(){
  if(!client||!isSuperAdminProfile())return;
  let agentsResult=await client.from('admin_profiles').select('user_id,role,active,full_name,email,phone,team_role').eq('active',true);
  if(automationSchemaMissing(agentsResult.error))agentsResult=await client.from('admin_profiles').select('user_id,role,active').eq('active',true);
  salesAgents=(agentsResult.data||[]).filter(agent=>['super_admin','admin'].includes(agent.role));
  const [rulesResult,jobsResult]=await Promise.all([
    client.from('automation_rules').select('*').order('sort_order',{ascending:true}),
    client.from('automation_jobs').select('*').order('created_at',{ascending:false}).limit(40)
  ]);
  if(rulesResult.error||jobsResult.error){
    const error=rulesResult.error||jobsResult.error;
    if(!automationSchemaMissing(error))console.warn('Sales automation unavailable:',error.message);
    automationRules=[];automationJobs=[];salesAutomationAvailable=false;
  }else{
    automationRules=rulesResult.data||[];automationJobs=jobsResult.data||[];salesAutomationAvailable=true;
  }
  populateLeadAgentSelect();
  renderSalesAutomation();
}

async function uploadFile(file, folder='general') {
  if (!file) return '';
  const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g,'-');
  const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0,8)}-${safe}`;
  setStatus('Uploading…','saving');
  const { error } = await client.storage.from('site-media').upload(path, file, { cacheControl:'3600', upsert:false, contentType:file.type || undefined });
  if (error) throw error;
  const { data } = client.storage.from('site-media').getPublicUrl(path);
  setStatus('Upload complete','success');
  return data.publicUrl;
}

async function ensureAdmin() {
  const { data:{ session } } = await client.auth.getSession();
  if (!session) return false;
  let { data: profile } = await client.from('admin_profiles').select('*').eq('user_id',session.user.id).maybeSingle();
  if (!profile) {
    const claim = await client.rpc('claim_super_admin', {});
    if (claim.error) throw claim.error;
    profile = Array.isArray(claim.data) ? claim.data[0] : claim.data;
  }
  if (!profile?.active) throw new Error('This admin account is disabled.');
  currentProfile = profile;
  byId('roleText').textContent = profile.role === 'super_admin' ? 'Super Admin' : profile.role;
  const superAdmin = profile.role === 'super_admin';
  document.body.classList.toggle('super-admin-capable',superAdmin);
  if (byId('standardCommandLaunch')) byId('standardCommandLaunch').hidden = !superAdmin;
  setAdminCommandMode(superAdmin,{animate:false,navigate:false});
  openPanel('overview');
  return true;
}

async function enterDashboard(){
  showAuthLoading('Opening secure admin dashboard…');

  try {
    const authorised=await ensureAdmin();

    if(!authorised){
      showAuth();
      return;
    }

    await loadAll();
    showDashboard();
  } catch (error) {
    showAuth();
    byId('loginMessage').textContent =
      error.message.includes('super admin already exists')
        ? 'This user is not authorised for the admin panel.'
        : error.message;
  }
}

byId('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!client) return byId('loginMessage').textContent='Supabase configuration is incomplete.';
  byId('loginMessage').textContent='Signing in…';
  const { error } = await client.auth.signInWithPassword({ email:byId('email').value.trim(), password:byId('password').value });
  if (error) return byId('loginMessage').textContent=error.message;
  byId('loginMessage').textContent='';
  await enterDashboard();
});
byId('logoutBtn').addEventListener('click',async()=>{
  setAdminCommandMode(false,{animate:false,navigate:false});
  showAuthLoading('Signing out securely…');
  await client.auth.signOut();
  showAuth();
});

byId('standardCommandLaunch')?.addEventListener('click',()=>{
  if (isSuperAdminProfile()) setAdminCommandMode(true);
});

function openPanel(name){
  if (['leads','automation','seo'].includes(name) && (!isSuperAdminProfile() || !document.body.classList.contains('super-command-mode'))) return;
  $$('[data-admin-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.adminPanel===name));
  $$('#adminNav button').forEach(button=>button.classList.toggle('nav-active',button.dataset.panel===name));
  const standardOverview = name === 'overview' && !document.body.classList.contains('super-command-mode');
  const [kicker,title]=standardOverview ? ['ADMIN WORKSPACE','Overview'] : (panelMeta[name]||['CONTROL','Admin']);
  byId('panelKicker').textContent=kicker;byId('panelTitle').textContent=title;
  if (name==='media') loadMedia();
}
byId('mobileAdminMenu')?.addEventListener('click',()=>{
  const open=document.body.classList.toggle('mobile-admin-menu-open');
  byId('mobileAdminMenu').setAttribute('aria-expanded',String(open));
  byId('mobileAdminMenu').setAttribute('aria-label',open?'Close admin navigation':'Open admin navigation');
});
byId('adminNav').addEventListener('click',event=>{
  const button=event.target.closest('[data-panel]');
  if(!button)return;
  openPanel(button.dataset.panel);
  document.body.classList.remove('mobile-admin-menu-open');
  byId('mobileAdminMenu')?.setAttribute('aria-expanded','false');
});
document.addEventListener('click',event=>{const button=event.target.closest('[data-go-panel]');if(button)openPanel(button.dataset.goPanel)});

const settingFields = {
  siteName:'site_name',siteSuffix:'site_suffix',tagline:'tagline',logoUrl:'logo_url',faviconUrl:'favicon_url',primaryColor:'primary_color',secondaryColor:'secondary_color',darkColor:'dark_color',lightColor:'light_color',
  heroKicker:'hero_kicker',heroTitle:'hero_title',heroHighlight:'hero_highlight',heroSubtitle:'hero_subtitle',heroImageUrl:'hero_image_url',heroPrimaryLabel:'hero_primary_label',heroPrimaryUrl:'hero_primary_url',heroSecondaryLabel:'hero_secondary_label',heroSecondaryUrl:'hero_secondary_url',
  propertiesEyebrow:'properties_eyebrow',propertiesHeading:'properties_heading',propertiesDescription:'properties_description',marketHeading:'market_heading',marketEyebrow:'market_eyebrow',marketDescription:'market_description',marketCoreText:'market_core_text',intelligenceTitle:'intelligence_title',intelligenceStatus:'intelligence_status',intelligenceNodes:'intelligence_nodes_text',listingsLabel:'market_listings_label',listingsValue:'market_listings_value',averageLabel:'market_average_label',averageValue:'market_average_value',topLocationLabel:'market_top_location_label',topLocationValue:'market_top_location_value',marketStatsAuto:'market_stats_auto',showIntelligenceRadar:'show_intelligence_radar',servicesHeading:'services_heading',aboutHeading:'about_heading',aboutText1:'about_text_1',aboutText2:'about_text_2',aboutImageUrl:'about_image_url',testimonialsHeading:'testimonials_heading',insightsEyebrow:'insights_eyebrow',insightsHeading:'insights_heading',insightsDescription:'insights_description',faqHeading:'faq_heading',ctaHeading:'cta_heading',ctaButtonLabel:'cta_button_label',
  phone:'phone',whatsappNumber:'whatsapp_number',whatsappMessage:'whatsapp_message',contactEmail:'email',businessHours:'business_hours',address:'address',instagramUrl:'instagram_url',facebookUrl:'facebook_url',xUrl:'x_url',linkedinUrl:'linkedin_url',footerDescription:'footer_description',footerSlogan:'footer_slogan',
  seoTitle:'seo_title',seoDescription:'seo_description',seoKeywords:'seo_keywords',customCss:'custom_css',maintenanceMode:'maintenance_mode'
};
const sectionFields = {showProperties:'show_properties',showMarket:'show_market',showServices:'show_services',showEmi:'show_emi',showAbout:'show_about',showTestimonials:'show_testimonials',showBlog:'show_blog',showFaq:'show_faq',showContact:'show_contact'};
const sectionLabels = {showProperties:'Properties',showMarket:'Market intelligence',showServices:'Process',showEmi:'EMI calculator',showAbout:'About',showTestimonials:'Testimonials',showBlog:'Blog / insights',showFaq:'FAQ',showContact:'Contact CTA'};

function buildSectionToggles(){
  byId('sectionToggles').innerHTML=Object.entries(sectionFields).map(([id,key])=>`<label class="switch"><input id="${id}" type="checkbox"><span></span><div><strong>${sectionLabels[id]}</strong><small>Show on website</small></div></label>`).join('');
}
buildSectionToggles();

function fillSettings(){
  Object.entries(settingFields).forEach(([id,key])=>{const field=byId(id);if(!field)return;if(field.type==='checkbox')field.checked=Boolean(siteSettings[key]);else field.value=siteSettings[key]??''});
  Object.entries(sectionFields).forEach(([id,key])=>{const field=byId(id);if(field)field.checked=siteSettings[key]!==false});
  byId('statMode').textContent=siteSettings.maintenance_mode?'MAINTENANCE':'LIVE';
  const preview=byId('themePreview');preview.style.background=`linear-gradient(135deg,${siteSettings.primary_color||'#daa43d'},${siteSettings.secondary_color||'#f6d77e'})`;
}
function collect(ids){const payload={id:1};ids.forEach(id=>{const key=settingFields[id]||sectionFields[id];const field=byId(id);if(!key||!field)return;payload[key]=field.type==='checkbox'?field.checked:field.value.trim()});return payload}
async function saveSettings(payload){
  setStatus('Saving…','saving');
  const {data,error}=await client.from(window.GD_SITE_SETTINGS_TABLE || 'gd_site_settings').upsert(payload,{onConflict:'id'}).select().single();

  if(error){
    const message=String(error.message||'');
    const schemaError=
      error.code==='PGRST204' ||
      /schema cache/i.test(message) ||
      /Could not find the ['"][^'"]+['"] column/i.test(message);

    if(schemaError){
      const missingColumn=
        message.match(/Could not find the ['"]([^'"]+)['"] column/i)?.[1] ||
        'required homepage column';

      setStatus('Database update required','error');
      throw new Error(
        `Homepage CMS database update is missing (${missingColumn}). ` +
        `Run backend/UPGRADE-V16.3-HOMEPAGE-CMS-REPAIR.sql once in Supabase SQL Editor, ` +
        `then refresh the Admin Panel.`
      );
    }

    setStatus('Save failed','error');
    throw error;
  }

  siteSettings=data;
  fillSettings();
  setStatus('Saved','success');
  setTimeout(()=>setStatus('Ready'),1800);
}

byId('brandingForm').addEventListener('submit',async event=>{event.preventDefault();try{let payload=collect(['siteName','siteSuffix','tagline','logoUrl','faviconUrl','primaryColor','secondaryColor','darkColor','lightColor']);if(byId('logoFile').files[0])payload.logo_url=await uploadFile(byId('logoFile').files[0],'logos');if(byId('faviconFile').files[0])payload.favicon_url=await uploadFile(byId('faviconFile').files[0],'logos');await saveSettings(payload)}catch(e){alert(e.message)}});
byId('homepageForm').addEventListener('submit',async event=>{event.preventDefault();try{const ids=['heroKicker','heroTitle','heroHighlight','heroSubtitle','heroImageUrl','heroPrimaryLabel','heroPrimaryUrl','heroSecondaryLabel','heroSecondaryUrl','propertiesEyebrow','propertiesHeading','propertiesDescription','marketHeading','marketEyebrow','marketDescription','marketCoreText','intelligenceTitle','intelligenceStatus','intelligenceNodes','listingsLabel','listingsValue','averageLabel','averageValue','topLocationLabel','topLocationValue','marketStatsAuto','showIntelligenceRadar','servicesHeading','aboutHeading','aboutText1','aboutText2','aboutImageUrl','testimonialsHeading','insightsEyebrow','insightsHeading','insightsDescription','faqHeading','ctaHeading','ctaButtonLabel',...Object.keys(sectionFields)];let payload=collect(ids);if(byId('heroImageFile').files[0])payload.hero_image_url=await uploadFile(byId('heroImageFile').files[0],'hero');if(byId('aboutImageFile')?.files?.[0])payload.about_image_url=await uploadFile(byId('aboutImageFile').files[0],'about');await saveHeroPropertyPreference();await saveSettings(payload);await loadProperties()}catch(e){alert(e.message)}});
byId('footerForm').addEventListener('submit',async event=>{event.preventDefault();try{await saveSettings(collect(['phone','whatsappNumber','whatsappMessage','contactEmail','businessHours','address','instagramUrl','facebookUrl','xUrl','linkedinUrl','footerDescription','footerSlogan']))}catch(e){alert(e.message)}});
byId('seoForm').addEventListener('submit',async event=>{event.preventDefault();try{await saveSettings(collect(['seoTitle','seoDescription','seoKeywords','customCss','maintenanceMode']))}catch(e){alert(e.message)}});

async function loadSettings(){const {data,error}=await client.from(window.GD_SITE_SETTINGS_TABLE || 'gd_site_settings').select('*').eq('id',1).single();if(error)throw error;siteSettings=data;fillSettings()}

// Properties
async function loadProperties(){const {data,error}=await client.from('properties').select('*').order('featured',{ascending:false}).order('created_at',{ascending:false});if(error)throw error;properties=data||[];renderProperties();renderHeroPropertyManager()}
function renderProperties(){const q=byId('propertySearch').value.toLowerCase().trim();const list=properties.filter(p=>`${p.title} ${p.location} ${p.property_type} ${p.listing_purpose||'Sale'}`.toLowerCase().includes(q));byId('propertyRows').innerHTML=list.map(p=>{const count=Array.isArray(p.configurations)?p.configurations.length:0;const purpose=p.listing_purpose==='Rent'?'Rent':'Sale';return `<tr><td><div class="item-cell"><img src="${escapeHtml(p.main_image||'')}" alt=""><div><strong>${escapeHtml(p.title)}</strong><small>${escapeHtml([p.location,p.city].filter(Boolean).join(', '))}</small></div></div></td><td><span class="property-purpose-badge ${purpose.toLowerCase()}">For ${purpose}</span></td><td>${escapeHtml(p.property_type)}</td><td><strong>${escapeHtml(p.price_label)}</strong><small class="property-price-period">${purpose==='Rent'?'Monthly rent':'Sale price'}</small>${count?`<small class="property-config-count">${count} configuration${count===1?'':'s'}</small>`:''}</td><td><span class="badge">${escapeHtml(p.status_label||'Available')}</span></td><td>${p.published?'Published':'Hidden'}</td><td><div class="table-actions"><button data-edit-property="${p.id}">Edit</button><button class="delete" data-delete-property="${p.id}">Delete</button></div></td></tr>`}).join('');byId('propertyEmpty').classList.toggle('hidden',list.length>0);byId('statProperties').textContent=properties.length}
byId('propertySearch').addEventListener('input',renderProperties);

function updatePropertyPurposeUI(){
  const purpose=byId('propertyListingPurpose')?.value==='Rent'?'Rent':'Sale';
  const price=byId('propertyPriceLabel');
  const numeric=byId('propertyPriceAmount');
  const hint=byId('propertyPricePurposeHint');

  if(price)price.placeholder=purpose==='Rent'?'₹35,000 / month':'₹95 Lakh';
  if(numeric)numeric.placeholder=purpose==='Rent'?'35000':'9500000';
  if(hint)hint.textContent=purpose==='Rent'
    ?'Rent example: ₹35,000 / month. Numeric price should be monthly rent.'
    :'Sale example: ₹95 Lakh or ₹1.35 Cr';
}

byId('propertyListingPurpose')?.addEventListener('change',updatePropertyPurposeUI);

function propertyTimestamp(property){
  const timestamp=Date.parse(property?.created_at||'');
  return Number.isFinite(timestamp)?timestamp:0;
}

function publishedAdminProperties(){
  return properties
    .filter(property=>property.published)
    .sort((a,b)=>propertyTimestamp(b)-propertyTimestamp(a));
}

function currentManualHeroProperty(){
  return publishedAdminProperties()
    .filter(property=>property.featured)
    .sort((a,b)=>propertyTimestamp(b)-propertyTimestamp(a))[0]||null;
}

function chosenHeroAdminProperty(){
  const mode=byId('heroPropertyMode')?.value||'auto';
  const published=publishedAdminProperties();

  if(mode==='manual'){
    const selectedId=byId('heroPropertyId')?.value;
    return published.find(property=>property.id===selectedId)||null;
  }

  return published[0]||null;
}

function populateHeroPropertyOptions(){
  const select=byId('heroPropertyId');
  if(!select)return;

  const currentValue=select.value;
  const published=publishedAdminProperties();

  select.innerHTML=[
    '<option value="">Select published property</option>',
    ...published.map(property=>`<option value="${escapeHtml(property.id)}">${escapeHtml(property.title)} — ${escapeHtml(property.location||property.city||'Location not set')}</option>`)
  ].join('');

  const manual=currentManualHeroProperty();
  const preferred=currentValue||manual?.id||'';
  if(published.some(property=>property.id===preferred))select.value=preferred;
}

function renderHeroPropertyManager(options={}){
  const {syncMode=true}=options;
  const mode=byId('heroPropertyMode');
  const select=byId('heroPropertyId');
  if(!mode||!select)return;

  populateHeroPropertyOptions();

  const manual=currentManualHeroProperty();
  if(syncMode){
    mode.value=manual?'manual':'auto';
    if(manual)select.value=manual.id;
  }

  const manualMode=mode.value==='manual';
  select.disabled=!manualMode;
  select.required=manualMode;
  byId('heroPropertyManualField')?.classList.toggle('is-disabled',!manualMode);

  const chosen=chosenHeroAdminProperty();
  const badge=byId('heroPropertyModeBadge');
  badge.textContent=manualMode?'MANUAL':'AUTO';
  badge.classList.toggle('manual',manualMode);

  const note=byId('heroPropertyManagerNote');
  note.textContent=manualMode
    ?'Manual mode is active. The selected property will also appear first in the collection.'
    :'Auto mode is active. Every newly published property automatically becomes the hero property and first collection card.';

  const preview=byId('heroPropertyAdminPreview');
  const image=byId('heroPropertyPreviewImage');

  if(!chosen){
    preview.classList.add('empty');
    image.removeAttribute('src');
    byId('heroPropertyPreviewTag').textContent=manualMode?'SELECT PROPERTY':'NO PROPERTY';
    byId('heroPropertyPreviewTitle').textContent='No published property';
    byId('heroPropertyPreviewMeta').textContent='Add and publish a property first.';
    byId('heroPropertyPreviewPrice').textContent='—';
    return;
  }

  preview.classList.remove('empty');
  image.src=chosen.main_image||'';
  image.alt=`${chosen.title||'Property'} preview`;
  byId('heroPropertyPreviewTag').textContent=manualMode?'MANUAL SELECTION':'LATEST LISTING';
  byId('heroPropertyPreviewTitle').textContent=chosen.title||'Property';
  byId('heroPropertyPreviewMeta').textContent=[
    chosen.listing_purpose==='Rent'?'For Rent':'For Sale',
    chosen.location,
    chosen.property_type
  ].filter(Boolean).join(' • ');
  byId('heroPropertyPreviewPrice').textContent=chosen.price_label||'On request';
}

async function saveHeroPropertyPreference(){
  const mode=byId('heroPropertyMode').value;
  const published=publishedAdminProperties();

  if(mode==='manual'){
    const selectedId=byId('heroPropertyId').value;
    if(!selectedId)throw new Error('Select a manual hero property.');

    const selected=published.find(property=>property.id===selectedId);
    if(!selected)throw new Error('The selected hero property must be published.');

    const {error:clearError}=await client
      .from('properties')
      .update({featured:false})
      .eq('featured',true)
      .neq('id',selectedId);
    if(clearError)throw clearError;

    const {error:setError}=await client
      .from('properties')
      .update({featured:true})
      .eq('id',selectedId);
    if(setError)throw setError;
    return;
  }

  const {error}=await client
    .from('properties')
    .update({featured:false})
    .eq('featured',true);
  if(error)throw error;
}

byId('heroPropertyMode')?.addEventListener('change',()=>renderHeroPropertyManager({syncMode:false}));
byId('heroPropertyId')?.addEventListener('change',()=>renderHeroPropertyManager({syncMode:false}));
function openModal(id){
  const modal=byId(id);
  if(!modal)return;
  modal.classList.remove('hidden');
  document.body.classList.add('admin-modal-open');

  if(id==='leadDetailModal'){
    const scroller=byId('leadDetailScroll');
    if(scroller)scroller.scrollTop=0;
    requestAnimationFrame(()=>byId('leadDetailModal')?.querySelector('[data-close]')?.focus());
  }
}

function closeModal(id){
  const modal=byId(id);
  if(!modal)return;
  modal.classList.add('hidden');

  if(!document.querySelector('.modal:not(.hidden)')){
    document.body.classList.remove('admin-modal-open');
  }
}

document.addEventListener('click',event=>{
  const close=event.target.closest('[data-close]');
  if(close){
    closeModal(close.dataset.close);
    return;
  }

  const modal=event.target.closest('.modal');
  if(modal&&event.target===modal)closeModal(modal.id);
});

document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  const openModals=[...document.querySelectorAll('.modal:not(.hidden)')];
  const topModal=openModals.at(-1);
  if(topModal)closeModal(topModal.id);
});
function renderGalleryPreview(){const urls=[...arrayFromLines(byId('propertyGallery').value),...pendingGalleryUrls];byId('propertyGalleryPreview').innerHTML=urls.map((url,i)=>`<article><img src="${escapeHtml(url)}" alt="Gallery image ${i+1}"><button type="button" data-remove-gallery="${i}">×</button></article>`).join('')||'<small>No gallery images selected.</small>'}

function configurationId(){return crypto.randomUUID?crypto.randomUUID():`cfg-${Date.now()}-${Math.random().toString(16).slice(2)}`}

function valueOrBlank(value){
  return value===null||value===undefined?'':value;
}

function configurationTemplate(config={},displayNumber=2){
  const id=config.id||configurationId();
  const facilities=Array.isArray(config.facilities)?config.facilities.join(', '):(config.facilities||'');
  const title=config.name||`Configuration ${displayNumber}`;
  return `<article class="configuration-editor" data-configuration-id="${escapeHtml(id)}" data-configuration-number="${displayNumber}">
    <div class="configuration-editor-head"><div><strong data-configuration-heading>${escapeHtml(title)}</strong><small>Additional configuration ${displayNumber}</small></div><button type="button" data-remove-configuration>Remove</button></div>
    <div class="configuration-editor-grid">
      <label class="span-2">Configuration name<input data-config-field="name" value="${escapeHtml(config.name||'')}" placeholder="${displayNumber===2?'3 BHK':'Configuration name'}" required></label>
      <label>Price label<input data-config-field="price_label" value="${escapeHtml(config.price_label||'')}" placeholder="₹1.35 Cr" required></label>
      <label>Numeric price<input data-config-field="price_amount" type="number" min="0" value="${escapeHtml(valueOrBlank(config.price_amount))}"></label>
      <label>Area<input data-config-field="area" value="${escapeHtml(config.area||'')}" placeholder="1,450 sq.ft."></label>
      <label>Bedrooms<input data-config-field="bedrooms" type="number" min="0" value="${escapeHtml(valueOrBlank(config.bedrooms))}"></label>
      <label>Bathrooms<input data-config-field="bathrooms" type="number" min="0" value="${escapeHtml(valueOrBlank(config.bathrooms))}"></label>
      <label>Balconies<input data-config-field="balconies" type="number" min="0" value="${escapeHtml(valueOrBlank(config.balconies))}"></label>
      <label>Parking<input data-config-field="parking" type="number" min="0" value="${escapeHtml(valueOrBlank(config.parking))}"></label>
      <label>Furnishing<input data-config-field="furnishing" value="${escapeHtml(config.furnishing||'')}" placeholder="Unfurnished"></label>
      <label>Status<input data-config-field="status_label" value="${escapeHtml(config.status_label||'Available')}" placeholder="Available"></label>
      <label class="span-2">Floor-plan image URL<input data-config-field="floor_plan_url" type="url" value="${escapeHtml(config.floor_plan_url||'')}" placeholder="https://..."></label>
      <label class="span-4">Configuration facilities<textarea data-config-field="facilities" rows="2" placeholder="Larger kitchen, 2 parking, 2 balconies">${escapeHtml(facilities)}</textarea></label>

      <details class="configuration-overview-editor span-4">
        <summary>
          <div>
            <strong>Website configuration overview</strong>
            <small>Edit the two text cards for this configuration.</small>
          </div>
          <span>EDIT</span>
        </summary>
        <div class="configuration-overview-fields">
          <label class="check span-4"><input data-config-field="show_floor_plan_overview" type="checkbox" ${config.show_floor_plan_overview===false?'':'checked'}> Show configuration overview</label>
          <label class="span-4">Section heading<input data-config-field="floor_overview_heading" value="${escapeHtml(config.floor_overview_heading||'Configuration overview')}" placeholder="Configuration overview"></label>
          <label>Card 1 label<input data-config-field="plan_a_label" value="${escapeHtml(config.plan_a_label||'PLAN A')}" placeholder="PLAN A"></label>
          <label class="span-2">Card 1 title<input data-config-field="plan_a_title" value="${escapeHtml(config.plan_a_title||'')}" placeholder="3 BHK layout"></label>
          <label class="span-4">Card 1 description<textarea data-config-field="plan_a_description" rows="2" placeholder="1,450 sq.ft. • 3 bathrooms • 2 balconies">${escapeHtml(config.plan_a_description||'')}</textarea></label>
          <label>Card 2 label<input data-config-field="plan_b_label" value="${escapeHtml(config.plan_b_label||'PLAN B')}" placeholder="PLAN B"></label>
          <label class="span-2">Card 2 title<input data-config-field="plan_b_title" value="${escapeHtml(config.plan_b_title||'')}" placeholder="Configuration highlights"></label>
          <label class="span-4">Card 2 description<textarea data-config-field="plan_b_description" rows="2" placeholder="2 parking • Semi-furnished">${escapeHtml(config.plan_b_description||'')}</textarea></label>
        </div>
      </details>

      <div class="config-checks"><label><input data-config-field="published" type="checkbox" ${config.published===false?'':'checked'}> Published</label></div>
    </div>
  </article>`;
}

function refreshAdditionalConfigurationNumbers(){
  [...byId('propertyConfigurations').querySelectorAll('.configuration-editor')].forEach((row,index)=>{
    const displayNumber=index+2;
    row.dataset.configurationNumber=String(displayNumber);
    const name=row.querySelector('[data-config-field="name"]')?.value.trim();
    const heading=row.querySelector('[data-configuration-heading]');
    const subtitle=row.querySelector('.configuration-editor-head small');
    if(heading)heading.textContent=name||`Configuration ${displayNumber}`;
    if(subtitle)subtitle.textContent=`Additional configuration ${displayNumber}`;
  });
}

function renderPropertyConfigurations(configurations=[]){
  const container=byId('propertyConfigurations');
  if(!container)return;
  const list=Array.isArray(configurations)?configurations:[];
  container.innerHTML=list.length
    ?list.map((config,index)=>configurationTemplate(config,index+2)).join('')
    :'<div class="configuration-empty">No additional configurations. Configuration 1 is available above.</div>';
  refreshAdditionalConfigurationNumbers();
}

function propertyConfigurationState(property){
  const list=Array.isArray(property?.configurations)?property.configurations.filter(Boolean):[];
  const base=list.find(item=>item.is_default===true)||list.find(item=>item.featured===true)||list[0]||null;
  return {
    base,
    additional:base?list.filter(item=>item!==base):[]
  };
}

function fillDefaultConfiguration(property,base){
  byId('propertyDefaultConfigurationId').value=base?.id||'';
  byId('propertyHadConfigurations').value=base?'true':'false';
  byId('propertyPriceLabel').value=base?.price_label||property?.price_label||'';
  byId('propertyPriceAmount').value=valueOrBlank(base?.price_amount??property?.price_amount);
  byId('propertyBhk').value=base?.name||property?.bhk||'';
  byId('propertyArea').value=base?.area||property?.area||'';
  byId('propertyBedrooms').value=valueOrBlank(base?.bedrooms);
  byId('propertyBathrooms').value=valueOrBlank(base?.bathrooms);
  byId('propertyBalconies').value=valueOrBlank(base?.balconies);
  byId('propertyParking').value=valueOrBlank(base?.parking);
  byId('propertyFurnishing').value=base?.furnishing||'';
  byId('propertyStatus').value=base?.status_label||property?.status_label||'Available';
  byId('propertyFloorPlanUrl').value=base?.floor_plan_url||'';
  byId('propertyConfigurationFacilities').value=Array.isArray(base?.facilities)?base.facilities.join(', '):(base?.facilities||'');
  byId('propertyShowFloorOverview').checked=base?.show_floor_plan_overview!==false;
  byId('propertyFloorOverviewHeading').value=base?.floor_overview_heading||'Configuration overview';
  byId('propertyPlanALabel').value=base?.plan_a_label||'PLAN A';
  byId('propertyPlanATitle').value=base?.plan_a_title||'';
  byId('propertyPlanADescription').value=base?.plan_a_description||'';
  byId('propertyPlanBLabel').value=base?.plan_b_label||'PLAN B';
  byId('propertyPlanBTitle').value=base?.plan_b_title||'';
  byId('propertyPlanBDescription').value=base?.plan_b_description||'';
}

function collectDefaultConfiguration(){
  const number=id=>byId(id).value!==''?Number(byId(id).value):null;
  return {
    id:byId('propertyDefaultConfigurationId').value||configurationId(),
    name:byId('propertyBhk').value.trim()||byId('propertyType').value||'Main Configuration',
    price_label:byId('propertyPriceLabel').value.trim(),
    price_amount:number('propertyPriceAmount'),
    area:byId('propertyArea').value.trim(),
    bedrooms:number('propertyBedrooms'),
    bathrooms:number('propertyBathrooms'),
    balconies:number('propertyBalconies'),
    parking:number('propertyParking'),
    furnishing:byId('propertyFurnishing').value.trim(),
    status_label:byId('propertyStatus').value.trim()||'Available',
    floor_plan_url:byId('propertyFloorPlanUrl').value.trim(),
    show_floor_plan_overview:byId('propertyShowFloorOverview').checked,
    floor_overview_heading:byId('propertyFloorOverviewHeading').value.trim()||'Configuration overview',
    plan_a_label:byId('propertyPlanALabel').value.trim()||'PLAN A',
    plan_a_title:byId('propertyPlanATitle').value.trim(),
    plan_a_description:byId('propertyPlanADescription').value.trim(),
    plan_b_label:byId('propertyPlanBLabel').value.trim()||'PLAN B',
    plan_b_title:byId('propertyPlanBTitle').value.trim(),
    plan_b_description:byId('propertyPlanBDescription').value.trim(),
    facilities:arrayFromLines(byId('propertyConfigurationFacilities').value),
    featured:true,
    is_default:true,
    published:true,
    sort_order:0
  };
}

function defaultConfigurationHasExtraDetails(){
  return [
    byId('propertyBedrooms').value,
    byId('propertyBathrooms').value,
    byId('propertyBalconies').value,
    byId('propertyParking').value,
    byId('propertyFurnishing').value.trim(),
    byId('propertyFloorPlanUrl').value.trim(),
    byId('propertyConfigurationFacilities').value.trim(),
    byId('propertyFloorOverviewHeading').value.trim()!=='Configuration overview' ? byId('propertyFloorOverviewHeading').value.trim() : '',
    byId('propertyPlanALabel').value.trim()!=='PLAN A' ? byId('propertyPlanALabel').value.trim() : '',
    byId('propertyPlanATitle').value.trim(),
    byId('propertyPlanADescription').value.trim(),
    byId('propertyPlanBLabel').value.trim()!=='PLAN B' ? byId('propertyPlanBLabel').value.trim() : '',
    byId('propertyPlanBTitle').value.trim(),
    byId('propertyPlanBDescription').value.trim(),
    byId('propertyShowFloorOverview').checked ? '' : 'hidden'
  ].some(value=>value!==''&&value!==null);
}

function collectPropertyConfigurations(){
  const rows=[...byId('propertyConfigurations').querySelectorAll('.configuration-editor')];
  return rows.map((row,index)=>{
    const field=name=>row.querySelector(`[data-config-field="${name}"]`);
    const number=name=>field(name)?.value!==''?Number(field(name).value):null;
    return {
      id:row.dataset.configurationId||configurationId(),
      name:field('name')?.value.trim()||'',
      price_label:field('price_label')?.value.trim()||'',
      price_amount:number('price_amount'),
      area:field('area')?.value.trim()||'',
      bedrooms:number('bedrooms'),
      bathrooms:number('bathrooms'),
      balconies:number('balconies'),
      parking:number('parking'),
      furnishing:field('furnishing')?.value.trim()||'',
      status_label:field('status_label')?.value.trim()||'Available',
      floor_plan_url:field('floor_plan_url')?.value.trim()||'',
      show_floor_plan_overview:Boolean(field('show_floor_plan_overview')?.checked),
      floor_overview_heading:field('floor_overview_heading')?.value.trim()||'Configuration overview',
      plan_a_label:field('plan_a_label')?.value.trim()||'PLAN A',
      plan_a_title:field('plan_a_title')?.value.trim()||'',
      plan_a_description:field('plan_a_description')?.value.trim()||'',
      plan_b_label:field('plan_b_label')?.value.trim()||'PLAN B',
      plan_b_title:field('plan_b_title')?.value.trim()||'',
      plan_b_description:field('plan_b_description')?.value.trim()||'',
      facilities:arrayFromLines(field('facilities')?.value||''),
      featured:false,
      is_default:false,
      published:Boolean(field('published')?.checked),
      sort_order:index+1
    };
  }).filter(item=>item.name||item.price_label);
}

function collectAllPropertyConfigurations(){
  const additional=collectPropertyConfigurations();
  const hadConfigurations=byId('propertyHadConfigurations').value==='true';
  const shouldStore=hadConfigurations||additional.length>0||defaultConfigurationHasExtraDetails();
  return shouldStore?[collectDefaultConfiguration(),...additional]:[];
}

byId('addPropertyConfiguration').addEventListener('click',()=>{
  const container=byId('propertyConfigurations');
  if(container.querySelector('.configuration-empty'))container.innerHTML='';
  const displayNumber=container.querySelectorAll('.configuration-editor').length+2;
  container.insertAdjacentHTML('beforeend',configurationTemplate({},displayNumber));
  refreshAdditionalConfigurationNumbers();
  container.lastElementChild?.querySelector('[data-config-field="name"]')?.focus();
});

byId('propertyConfigurations').addEventListener('input',event=>{
  if(event.target.matches('[data-config-field="name"]'))refreshAdditionalConfigurationNumbers();
});

byId('propertyConfigurations').addEventListener('click',event=>{
  const remove=event.target.closest('[data-remove-configuration]');
  if(!remove)return;
  remove.closest('.configuration-editor')?.remove();
  if(!byId('propertyConfigurations').querySelector('.configuration-editor'))renderPropertyConfigurations([]);
  else refreshAdditionalConfigurationNumbers();
});

function openProperty(property=null){
  byId('propertyForm').reset();
  pendingGalleryUrls=[];

  const configurationState=propertyConfigurationState(property);

  byId('propertyId').value=property?.id||'';
  byId('propertyModalTitle').textContent=property?'Edit property':'Add property';
  byId('propertyTitle').value=property?.title||'';
  byId('propertySlug').value=property?.slug||'';
  byId('propertyType').value=property?.property_type||'Apartment';
  byId('propertyListingPurpose').value=property?.listing_purpose==='Rent'?'Rent':'Sale';
  updatePropertyPurposeUI();
  byId('propertyLocation').value=property?.location||'';
  byId('propertyCity').value=property?.city||'Surat';

  fillDefaultConfiguration(property,configurationState.base);

  byId('propertyBuilder').value=property?.builder_name||'';
  byId('propertyRera').value=property?.rera_number||'';
  byId('propertyImage').value=property?.main_image||'';
  byId('propertyGallery').value=(property?.gallery_images||[]).join('\n');
  byId('propertyAmenities').value=(property?.amenities||[]).join(', ');
  byId('propertyMapLabel').value=property?.map_label||property?.location||'';
  byId('propertyLatitude').value=property?.latitude??'';
  byId('propertyLongitude').value=property?.longitude??'';
  byId('propertyMapEmbed').value=property?.map_embed_url||'';
  byId('propertyMapDescription').value=property?.map_description||'';
  byId('propertyShowMap').checked=property?.show_map??true;
  byId('propertyDescription').value=property?.description||'';
  byId('propertyVerified').checked=property?.verified??true;
  byId('propertyFeatured').checked=property?.featured??false;
  byId('propertyPublished').checked=property?.published??true;
  byId('propertyMessage').textContent='';

  renderGalleryPreview();
  renderPropertyConfigurations(configurationState.additional);
  openModal('propertyModal');
}
byId('addPropertyBtn').addEventListener('click',()=>openProperty());byId('quickAddProperty').addEventListener('click',()=>setTimeout(()=>openProperty(),0));
byId('propertyTitle').addEventListener('input',()=>{if(!byId('propertyId').value)byId('propertySlug').value=slugify(byId('propertyTitle').value)});
byId('propertyRows').addEventListener('click',async event=>{const edit=event.target.closest('[data-edit-property]');if(edit)return openProperty(properties.find(p=>p.id===edit.dataset.editProperty));const del=event.target.closest('[data-delete-property]');if(del&&confirm('Delete this property permanently?')){const{error}=await client.from('properties').delete().eq('id',del.dataset.deleteProperty);if(error)alert(error.message);else loadProperties()}});
byId('propertyGallery').addEventListener('input',renderGalleryPreview);
byId('propertyGalleryFiles').addEventListener('change',async event=>{try{const files=[...event.target.files];if(!files.length)return;byId('propertyMessage').textContent=`Uploading ${files.length} gallery image(s)…`;for(const file of files){pendingGalleryUrls.push(await uploadFile(file,'properties/gallery'))}event.target.value='';renderGalleryPreview();byId('propertyMessage').textContent=`${files.length} gallery image(s) uploaded.`}catch(e){byId('propertyMessage').textContent=e.message}});
byId('propertyGalleryPreview').addEventListener('click',event=>{const btn=event.target.closest('[data-remove-gallery]');if(!btn)return;const index=Number(btn.dataset.removeGallery);const existing=arrayFromLines(byId('propertyGallery').value);const combined=[...existing,...pendingGalleryUrls];combined.splice(index,1);byId('propertyGallery').value=combined.join('\n');pendingGalleryUrls=[];renderGalleryPreview()});
byId('propertyMapLinkPreview')?.addEventListener('click',()=>{
  const input=byId('propertyMapEmbed');
  const raw=input.value.trim();

  if(!raw){
    byId('propertyMessage').textContent='Pehle Google Maps location link paste karo.';
    input.focus();
    return;
  }

  try{
    const url=new URL(raw,window.location.href);
    if(!['http:','https:'].includes(url.protocol))throw new Error('Only HTTP/HTTPS links are supported');
    const opened=window.open(url.href,'_blank','noopener,noreferrer');
    if(opened)opened.opener=null;
    byId('propertyMessage').textContent='';
  }catch(error){
    byId('propertyMessage').textContent='Valid Google Maps link paste karo.';
    input.focus();
  }
});

byId('propertyForm').addEventListener('submit',async event=>{event.preventDefault();try{byId('propertyMessage').textContent='Saving…';let image=byId('propertyImage').value.trim();if(byId('propertyImageFile').files[0])image=await uploadFile(byId('propertyImageFile').files[0],'properties');const payload={title:byId('propertyTitle').value.trim(),slug:byId('propertySlug').value.trim(),property_type:byId('propertyType').value,listing_purpose:byId('propertyListingPurpose').value,location:byId('propertyLocation').value.trim(),city:byId('propertyCity').value.trim(),price_label:byId('propertyPriceLabel').value.trim(),price_amount:byId('propertyPriceAmount').value?Number(byId('propertyPriceAmount').value):null,bhk:byId('propertyBhk').value.trim(),area:byId('propertyArea').value.trim(),status_label:byId('propertyStatus').value.trim(),builder_name:byId('propertyBuilder').value.trim(),rera_number:byId('propertyRera').value.trim(),main_image:image,gallery_images:[...new Set([...arrayFromLines(byId('propertyGallery').value),...pendingGalleryUrls])],amenities:arrayFromLines(byId('propertyAmenities').value),configurations:collectAllPropertyConfigurations(),map_label:byId('propertyMapLabel').value.trim(),latitude:byId('propertyLatitude').value?Number(byId('propertyLatitude').value):null,longitude:byId('propertyLongitude').value?Number(byId('propertyLongitude').value):null,map_embed_url:byId('propertyMapEmbed').value.trim(),map_description:byId('propertyMapDescription').value.trim(),show_map:byId('propertyShowMap').checked,description:byId('propertyDescription').value.trim(),verified:byId('propertyVerified').checked,featured:byId('propertyFeatured').checked,published:byId('propertyPublished').checked};const id=byId('propertyId').value;if(payload.featured){let clearQuery=client.from('properties').update({featured:false}).eq('featured',true);if(id)clearQuery=clearQuery.neq('id',id);const{error:clearFeaturedError}=await clearQuery;if(clearFeaturedError)throw clearFeaturedError}const query=id?client.from('properties').update(payload).eq('id',id):client.from('properties').insert(payload);const{error}=await query;if(error)throw error;closeModal('propertyModal');await loadProperties();setStatus('Property saved','success')}catch(e){byId('propertyMessage').textContent=e.message}});

// Leads CRM V15.7
let leadTypeFilter = "all";
let activeLeadId = null;
let selectedLeadIds = new Set();
let leadPage = 1;
let leadPageSize = 10;
let leadSort = "newest";
let leadSmartFilter = "all";
let crmView = "workspace";

function isDeletedLead(lead = {}) {
  return Boolean(lead.deleted_at);
}

function isVisitLead(lead = {}) {
  const source = String(lead.source || "").toLowerCase();
  const leadId = String(lead.lead_id || "").toUpperCase();
  return (
    lead.status === "VISIT BOOKED" ||
    leadId.startsWith("KV") ||
    source.includes("site visit") ||
    source.includes("guided visit")
  );
}

function leadRecordType(lead) {
  return isVisitLead(lead) ? "visit" : "inquiry";
}

function valueOrDash(value) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
}

function leadPriorityWeight(lead = {}) {
  const statusWeight = {
    HOT: 100, VISIT_BOOKED: 92, NEW: 82, WARM: 72,
    CONTACTED: 58, COLD: 30, WON: 15, LOST: 0
  }[String(lead.status || 'NEW').replace(' ', '_')] || 40;
  const activityDate = new Date(lead.updated_at || lead.created_at || 0);
  const ageHours = Number.isNaN(activityDate.getTime())
    ? 720
    : Math.max(0,(Date.now() - activityDate.getTime()) / 36e5);
  const recencyWeight = Math.max(0,28 - Math.min(28,ageHours / 4));
  return statusWeight + Number(lead.lead_score || 0) + recencyWeight;
}

function leadAgeHours(lead = {}) {
  const value = new Date(lead.updated_at || lead.created_at || 0);
  return Number.isNaN(value.getTime()) ? Infinity : Math.max(0,(Date.now() - value.getTime()) / 36e5);
}

function visitScheduleDate(lead = {}) {
  const schedule = String(lead.contact_time || '').split('•')[0].trim();
  const match = schedule.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;
  const months = {january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11};
  const month = months[match[2].toLowerCase()];
  if (month === undefined) return null;
  const date = new Date(Number(match[3]),month,Number(match[1]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function leadNextActionText(lead = {}) {
  const status = String(lead.status || 'NEW');
  if (status === 'NEW') return 'Call within 10 minutes';
  if (status === 'HOT') return 'Share shortlist and schedule visit';
  if (status === 'WARM') return 'Follow up with matching options';
  if (status === 'COLD') return 'Add to nurture follow-up';
  if (status === 'CONTACTED') return 'Confirm interest and next step';
  if (status === 'VISIT BOOKED') return 'Confirm site-visit attendance';
  if (status === 'WON') return 'Complete documentation follow-up';
  if (status === 'LOST') return 'Record reason and close';
  return 'Contact customer';
}

function leadSearchText(lead) {
  return [
    lead.lead_id, lead.full_name, lead.mobile, lead.email,
    lead.property_name, lead.property_type, lead.bhk,
    lead.location, lead.status, lead.source, lead.requirements
  ].filter(Boolean).join(" ").toLowerCase();
}

function sortLeadRecords(list) {
  const sorted = [...list];

  if (leadSort === "oldest") {
    return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
  if (leadSort === "score-high") {
    return sorted.sort((a, b) => Number(b.lead_score || 0) - Number(a.lead_score || 0));
  }
  if (leadSort === "score-low") {
    return sorted.sort((a, b) => Number(a.lead_score || 0) - Number(b.lead_score || 0));
  }
  if (leadSort === "name-az") {
    return sorted.sort((a, b) =>
      String(a.full_name || "").localeCompare(String(b.full_name || ""), "en", { sensitivity:"base" })
    );
  }

  return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function filteredLeads() {
  const status = byId("leadFilter").value;
  const query = byId("leadSearch").value.trim().toLowerCase();

  const list = leads.filter(lead => {
    const deletionMatches =
      leadTypeFilter === "trash" ? isDeletedLead(lead) : !isDeletedLead(lead);

    const typeMatches =
      leadTypeFilter === "all" ||
      leadTypeFilter === "trash" ||
      leadRecordType(lead) === leadTypeFilter;

    const statusMatches = status === "all" || lead.status === status;
    const searchMatches = !query || leadSearchText(lead).includes(query);
    const smartMatches =
      leadSmartFilter === "all" ||
      (leadSmartFilter === "today" && isToday(lead.created_at)) ||
      (leadSmartFilter === "priority" && (lead.status === "HOT" || Number(lead.lead_score || 0) >= 70)) ||
      (leadSmartFilter === "visits" && isVisitLead(lead)) ||
      (leadSmartFilter === "won" && lead.status === "WON") ||
      (leadSmartFilter === "uncontacted" && ["NEW", "HOT", "WARM"].includes(lead.status));

    return deletionMatches && typeMatches && statusMatches && searchMatches && smartMatches;
  });

  return sortLeadRecords(list);
}

function pagedLeads() {
  const list = filteredLeads();
  const totalPages = Math.max(1, Math.ceil(list.length / leadPageSize));
  leadPage = Math.min(Math.max(1, leadPage), totalPages);
  const start = (leadPage - 1) * leadPageSize;
  return list.slice(start, start + leadPageSize);
}

function updateLeadFilterUI() {
  $$("[data-lead-type-filter]").forEach(button => {
    button.classList.toggle("active", button.dataset.leadTypeFilter === leadTypeFilter);
  });
}

function updateLeadCounts() {
  const activeLeads = leads.filter(lead => !isDeletedLead(lead));
  const inquiryCount = activeLeads.filter(lead => !isVisitLead(lead)).length;
  const visitCount = activeLeads.filter(isVisitLead).length;
  const trashCount = leads.filter(isDeletedLead).length;
  const activeCount = activeLeads.filter(lead =>
    ["NEW", "HOT", "WARM", "CONTACTED", "VISIT BOOKED"].includes(lead.status)
  ).length;

  byId("crmAllCount").textContent = activeLeads.length;
  byId("crmInquiryCount").textContent = inquiryCount;
  byId("crmVisitCount").textContent = visitCount;
  byId("crmTrashCount").textContent = trashCount;
  byId("crmActiveCount").textContent = activeCount;

  const wonCount = activeLeads.filter(lead => lead.status === "WON").length;
  const todayCount = activeLeads.filter(lead => isToday(lead.created_at)).length;
  const hotCount = activeLeads.filter(lead => lead.status === "HOT" || Number(lead.lead_score || 0) >= 70).length;
  const conversion = activeLeads.length ? Math.round((wonCount / activeLeads.length) * 100) : 0;

  if (byId("crmTodayCount")) byId("crmTodayCount").textContent = todayCount;
  if (byId("crmHotCount")) byId("crmHotCount").textContent = hotCount;
  if (byId("crmVisitPipelineCount")) byId("crmVisitPipelineCount").textContent = visitCount;
  if (byId("crmWonCount")) byId("crmWonCount").textContent = wonCount;
  if (byId("crmConversionRate")) byId("crmConversionRate").textContent = `${conversion}%`;
}

function pruneLeadSelection() {
  const existingIds = new Set(leads.map(lead => lead.id));
  selectedLeadIds = new Set([...selectedLeadIds].filter(id => existingIds.has(id)));
}

async function loadLeads(options = {}) {
  if (!isSuperAdminProfile()) {
    leads = [];
    selectedLeadIds.clear();
    return;
  }
  const { preserveSelection = false } = options;
  const { data, error } = await client
    .from("leads")
    .select("*")
    .order("created_at", { ascending:false });

  if (error) throw error;

  leads = data || [];
  if (!preserveSelection) selectedLeadIds.clear();
  pruneLeadSelection();
  updateLeadCounts();
  renderLeads();
  renderRecentLeads();
}

function leadBadge(status) {
  const normalized = status || "NEW";
  const cls =
    normalized === "HOT" ? "hot" :
    normalized === "WARM" ? "warm" :
    normalized === "VISIT BOOKED" ? "visit" :
    normalized === "WON" ? "won" :
    normalized === "LOST" ? "lost" : "";
  return `<span class="badge ${cls}">${escapeHtml(normalized)}</span>`;
}

function leadTypeBadge(lead) {
  return isVisitLead(lead)
    ? '<span class="crm-type-badge visit">SITE VISIT</span>'
    : '<span class="crm-type-badge enquiry">ENQUIRY</span>';
}

function leadScheduleSummary(lead) {
  if (isVisitLead(lead)) {
    return `<strong>${escapeHtml(valueOrDash(lead.contact_time))}</strong><small>Scheduled site visit</small>`;
  }

  const requirement = [lead.looking_for, lead.timeline].filter(Boolean).join(" • ");
  return `<strong>${escapeHtml(requirement || "Property enquiry")}</strong><small>${escapeHtml(lead.requirements || "Open full data for details")}</small>`;
}

function updateLeadPagination() {
  const list = filteredLeads();
  const totalPages = Math.max(1, Math.ceil(list.length / leadPageSize));
  leadPage = Math.min(Math.max(1, leadPage), totalPages);

  const start = list.length ? (leadPage - 1) * leadPageSize + 1 : 0;
  const end = Math.min(leadPage * leadPageSize, list.length);

  byId("leadPageInfo").textContent =
    `${start}–${end} of ${list.length} • Page ${leadPage} of ${totalPages}`;

  byId("leadPreviousPage").disabled = leadPage <= 1;
  byId("leadNextPage").disabled = leadPage >= totalPages;
}

function selectedLeadRecords() {
  return leads.filter(lead => selectedLeadIds.has(lead.id));
}

function updateLeadBulkBar() {
  const selected = selectedLeadRecords();
  const bulkBar = byId("leadBulkBar");
  const isTrashView = leadTypeFilter === "trash";

  bulkBar.classList.toggle("hidden", selected.length === 0);
  byId("leadSelectedCount").textContent = `${selected.length} selected`;

  byId("leadBulkActiveActions").classList.toggle("hidden", isTrashView);
  byId("leadBulkTrashActions").classList.toggle("hidden", !isTrashView);

  byId("exportSelectedLeads").disabled = selected.length === 0;
}

function updateLeadPageCheckbox() {
  const currentPage = pagedLeads();
  const checkbox = byId("selectLeadPage");
  const selectedOnPage = currentPage.filter(lead => selectedLeadIds.has(lead.id)).length;

  checkbox.disabled = currentPage.length === 0;
  checkbox.checked = currentPage.length > 0 && selectedOnPage === currentPage.length;
  checkbox.indeterminate = selectedOnPage > 0 && selectedOnPage < currentPage.length;
}

function renderLeads() {
  const list = pagedLeads();
  const trashView = leadTypeFilter === "trash";

  byId("leadRows").innerHTML = list.map(lead => `
    <tr class="${isDeletedLead(lead) ? "crm-deleted-row" : ""}">
      <td class="crm-check-column">
        <input
          type="checkbox"
          data-select-lead="${lead.id}"
          aria-label="Select ${escapeHtml(lead.full_name || "lead")}"
          ${selectedLeadIds.has(lead.id) ? "checked" : ""}
        >
      </td>
      <td>
        ${leadTypeBadge(lead)}
        <small class="crm-row-id">${escapeHtml(lead.lead_id || "No ID")}</small>
        ${isDeletedLead(lead) ? `<small class="crm-trash-date">Deleted ${escapeHtml(formatDate(lead.deleted_at))}</small>` : ""}
      </td>
      <td>
        <div class="crm-customer-cell">
          <strong>${escapeHtml(valueOrDash(lead.full_name))}</strong>
          <span>${escapeHtml(valueOrDash(lead.mobile))}</span>
          <small>${escapeHtml(valueOrDash(lead.email))}</small>
        </div>
      </td>
      <td>
        <div class="crm-property-cell">
          <strong>${escapeHtml(lead.property_name || "General enquiry")}</strong>
          <span>${escapeHtml([lead.bhk, lead.property_type].filter(Boolean).join(" • ") || "Property not selected")}</span>
          <small>${escapeHtml([lead.property_price || lead.budget, lead.location].filter(Boolean).join(" • ") || "Details on request")}</small>
        </div>
      </td>
      <td>
        <div class="crm-request-cell">
          ${leadScheduleSummary(lead)}
        </div>
      </td>
      <td>
        <select class="crm-status-select" data-lead-status="${lead.id}" ${trashView ? "disabled" : ""}>
          ${["NEW","HOT","WARM","COLD","CONTACTED","VISIT BOOKED","WON","LOST"]
            .map(status => `<option ${lead.status === status ? "selected" : ""}>${status}</option>`)
            .join("")}
        </select>
        <small class="crm-score">Score ${Number(lead.lead_score || 0)}</small>
      </td>
      <td>
        <div class="crm-row-actions">
          <button class="crm-view-btn" type="button" data-view-lead="${lead.id}">
            View full data <span>↗</span>
          </button>
          ${
            trashView
              ? `<button class="crm-icon-action restore" type="button" data-restore-lead="${lead.id}" title="Restore lead">↶</button>
                 <button class="crm-icon-action delete" type="button" data-delete-lead-forever="${lead.id}" title="Delete forever">×</button>`
              : `<button class="crm-icon-action delete" type="button" data-trash-lead="${lead.id}" title="Move to trash">⌫</button>`
          }
        </div>
      </td>
    </tr>
  `).join("");

  byId("leadEmpty").classList.toggle("hidden", list.length > 0);
  byId("statLeads").textContent = leads.filter(lead =>
    !isDeletedLead(lead) && ["NEW","HOT","WARM","VISIT BOOKED"].includes(lead.status)
  ).length;

  updateLeadPagination();
  updateLeadPageCheckbox();
  updateLeadBulkBar();
  renderKanbanBoard();
  renderCrmWorkspace();
  renderExecutiveDashboard();
}

function renderRecentLeads() {
  const recent = leads.filter(lead => !isDeletedLead(lead)).slice(0, 5);

  byId("recentLeads").innerHTML = (
    recent.map(lead => {
      const phone = String(lead.mobile || '').replace(/\D/g, '').slice(-10);
      return `<div class="activity-item advanced-activity-item">
        <div class="activity-lead-avatar">${escapeHtml(String(lead.full_name || 'L').charAt(0).toUpperCase())}</div>
        <div class="activity-lead-copy">
          <strong>${escapeHtml(lead.full_name || 'Unnamed lead')}</strong>
          <small>${escapeHtml(lead.property_name || lead.location || "General enquiry")} • ${escapeHtml(lead.property_price || lead.budget || "Budget not set")}</small>
          <span>${escapeHtml(formatDate(lead.created_at))}</span>
        </div>
        <div class="activity-lead-actions">
          ${leadTypeBadge(lead)}
          <button type="button" data-overview-lead="${lead.id}">Open ↗</button>
          ${phone ? `<a href="https://wa.me/91${phone}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        </div>
      </div>`;
    }).join("") || '<div class="empty">No leads yet.</div>'
  );
}



function renderExecutiveDashboard() {
  const active = leads.filter(lead => !isDeletedLead(lead));
  const actionable = active.filter(lead => ["NEW","HOT","WARM","CONTACTED","VISIT BOOKED"].includes(lead.status));
  const today = active.filter(lead => isToday(lead.created_at));
  const visits = active.filter(isVisitLead);
  const won = active.filter(lead => lead.status === "WON");
  const conversion = active.length ? Math.round((won.length / active.length) * 100) : 0;

  if (byId('statLeads')) byId('statLeads').textContent = actionable.length;
  if (byId('statNewToday')) byId('statNewToday').textContent = today.length;
  if (byId('statVisits')) byId('statVisits').textContent = visits.length;
  if (byId('statWon')) byId('statWon').textContent = won.length;
  if (byId('statConversion')) byId('statConversion').textContent = `${conversion}%`;
  if (byId('overviewSystemText')) byId('overviewSystemText').textContent = isSuperAdminProfile()
    ? `${active.length} CRM records synchronized`
    : 'Website content synchronized';

  const stages = [
    ['NEW', active.filter(lead => lead.status === 'NEW').length],
    ['PRIORITY', active.filter(lead => ['HOT','WARM'].includes(lead.status)).length],
    ['CONTACTED', active.filter(lead => ['CONTACTED','COLD'].includes(lead.status)).length],
    ['VISIT', active.filter(lead => lead.status === 'VISIT BOOKED').length],
    ['WON', won.length]
  ];
  const maximum = Math.max(1, ...stages.map(([, count]) => count));
  const pipeline = byId('overviewPipeline');
  if (pipeline) pipeline.innerHTML = stages.map(([label,count], index) => `
    <button type="button" data-pipeline-stage="${label}" class="overview-pipeline-row">
      <span><i>${String(index + 1).padStart(2,'0')}</i><b>${label}</b></span>
      <div><em style="width:${Math.max(5, (count / maximum) * 100)}%"></em></div>
      <strong>${count}</strong>
    </button>`).join('');

  if (byId('v30PerformanceTotal')) byId('v30PerformanceTotal').textContent = active.length;
  if (byId('v30PerformanceChange')) byId('v30PerformanceChange').textContent = `${actionable.length} opportunities currently need action`;
  const chartHost = byId('v30PerformanceChart');
  if (chartHost) {
    const chartWidth = 720;
    const chartHeight = 190;
    const chartBottom = 154;
    const chartTop = 18;
    const chartLeft = 28;
    const chartRight = 692;
    const chartMax = Math.max(1,...stages.map(([,count]) => count));
    const points = stages.map(([,count],index) => {
      const x = chartLeft + ((chartRight - chartLeft) * index / Math.max(1,stages.length - 1));
      const y = chartBottom - ((chartBottom - chartTop) * count / chartMax);
      return {x,y,count};
    });
    const line = points.map(point => `${point.x},${point.y}`).join(' ');
    const area = `M ${chartLeft} ${chartBottom} L ${points.map(point => `${point.x} ${point.y}`).join(' L ')} L ${chartRight} ${chartBottom} Z`;
    chartHost.innerHTML = `<svg viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="Lead stages performance">
      <defs><linearGradient id="v30AreaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#60a5fa" stop-opacity=".42"/><stop offset="1" stop-color="#60a5fa" stop-opacity=".02"/></linearGradient></defs>
      <line class="v30-chart-grid" x1="${chartLeft}" y1="50" x2="${chartRight}" y2="50"/>
      <line class="v30-chart-grid" x1="${chartLeft}" y1="102" x2="${chartRight}" y2="102"/>
      <line class="v30-chart-grid" x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}"/>
      <path class="v30-chart-area" d="${area}"/>
      <polyline class="v30-chart-line" points="${line}"/>
      ${points.map((point,index) => `<circle class="v30-chart-dot" cx="${point.x}" cy="${point.y}" r="4"/><text class="v30-chart-label" x="${point.x}" y="180">${escapeHtml(stages[index][0])}</text>`).join('')}
    </svg>`;
  }

  const priority = [...active]
    .filter(lead => !['WON','LOST'].includes(lead.status))
    .sort((a,b) => leadPriorityWeight(b) - leadPriorityWeight(a))
    .slice(0,6);
  const priorityHost = byId('priorityLeads');
  if (priorityHost) priorityHost.innerHTML = priority.map((lead,index) => `
    <button type="button" class="priority-lead-item" data-overview-lead="${lead.id}">
      <span class="priority-rank">${String(index + 1).padStart(2,'0')}</span>
      <div><strong>${escapeHtml(lead.full_name || 'Unnamed lead')}</strong><small>${escapeHtml(lead.property_name || lead.location || 'General enquiry')}</small></div>
      <span class="priority-score">${Number(lead.lead_score || 0)}</span>
      ${leadBadge(lead.status)}
    </button>`).join('') || '<div class="empty">No active priority leads.</div>';

  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  const upcomingVisits = active
    .filter(lead => isVisitLead(lead) && !['WON','LOST'].includes(lead.status))
    .map(lead => ({lead,date:visitScheduleDate(lead)}))
    .filter(item => !item.date || item.date >= todayStart)
    .sort((a,b) => {
      if (a.date && b.date) return a.date - b.date;
      if (a.date) return -1;
      if (b.date) return 1;
      return new Date(b.lead.created_at || 0) - new Date(a.lead.created_at || 0);
    })
    .slice(0,4);
  const visitsHost = byId('overviewVisits');
  if (visitsHost) visitsHost.innerHTML = upcomingVisits.map(({lead,date}) => {
    const scheduleParts = String(lead.contact_time || '').split('•').map(part => part.trim()).filter(Boolean);
    const day = date ? String(date.getDate()).padStart(2,'0') : '--';
    const month = date ? date.toLocaleDateString('en-IN',{month:'short'}).toUpperCase() : 'TBD';
    return `<button type="button" class="v30-visit-item" data-overview-lead="${lead.id}">
      <span class="v30-visit-date"><strong>${day}</strong><small>${month}</small></span>
      <span class="v30-visit-copy"><strong>${escapeHtml(lead.property_name || 'Property visit')}</strong><small>${escapeHtml(lead.full_name || 'Customer')} • ${escapeHtml(lead.location || 'Location pending')}</small></span>
      <span class="v30-visit-time">${escapeHtml(scheduleParts[1] || 'Time pending')}</span>
    </button>`;
  }).join('') || '<div class="empty">No upcoming site visits.</div>';

  renderSalesAutomation();
}

function crmStatusClass(value='') {
  return String(value || 'NEW').toLowerCase().replace(/[^a-z0-9]+/g,'-');
}

function renderCrmWorkspace() {
  const active = leads.filter(lead => !isDeletedLead(lead));
  const actionable = active
    .filter(lead => ['NEW','HOT','WARM','CONTACTED','VISIT BOOKED'].includes(lead.status))
    .sort((a,b) => leadPriorityWeight(b) - leadPriorityWeight(a));
  const won = active.filter(lead => lead.status === 'WON');
  const today = new Date();
  today.setHours(0,0,0,0);
  const visits = active
    .filter(lead => isVisitLead(lead) && !['WON','LOST'].includes(lead.status))
    .map(lead => ({lead,date:visitScheduleDate(lead)}))
    .filter(item => !item.date || item.date >= today)
    .sort((a,b) => {
      if (a.date && b.date) return a.date - b.date;
      if (a.date) return -1;
      if (b.date) return 1;
      return new Date(b.lead.created_at) - new Date(a.lead.created_at);
    })
    .map(item => item.lead);
  const averageScore = active.length
    ? active.reduce((total,lead) => total + Number(lead.lead_score || 0),0) / active.length
    : 0;
  const conversion = active.length ? (won.length / active.length) * 100 : 0;
  const open = active.filter(lead => !['WON','LOST'].includes(lead.status));
  const stale = open.filter(lead => ['NEW','HOT','WARM'].includes(lead.status) && leadAgeHours(lead) > 72);
  const followUpCoverage = open.length ? 1 - (stale.length / open.length) : 1;
  const visitMomentum = open.length ? Math.min(12,(visits.length / open.length) * 30) : 0;
  const health = active.length ? Math.min(99,Math.max(0,Math.round(20 + averageScore * .35 + conversion * .2 + followUpCoverage * 30 + visitMomentum))) : 0;

  if (byId('crmAttentionCount')) byId('crmAttentionCount').textContent = `${actionable.length} actionable`;
  if (byId('crmHealthScore')) byId('crmHealthScore').textContent = health;
  if (byId('crmHealthRing')) byId('crmHealthRing').style.setProperty('--crm-health',`${health * 3.6}deg`);
  if (byId('crmHealthMessage')) byId('crmHealthMessage').textContent = !active.length
    ? 'New enquiries will appear here automatically.'
    : health >= 78 ? 'Healthy pipeline. Focus on priority follow-ups and visits.'
    : health >= 55 ? 'Stable pipeline. Move new leads into qualified conversations.'
    : 'Pipeline needs attention. Start with uncontacted enquiries.';
  if (byId('crmWorkspaceSyncTime')) byId('crmWorkspaceSyncTime').textContent = `Updated ${new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`;

  const queue = byId('crmActionQueue');
  if (queue) queue.innerHTML = actionable.slice(0,6).map((lead,index) => {
    const phone = safePhone(lead.mobile);
    return `<article class="crm-v27-action-item" data-workspace-lead="${lead.id}">
      <span class="crm-v27-action-rank">${String(index + 1).padStart(2,'0')}</span>
      <span class="crm-v27-avatar">${escapeHtml(String(lead.full_name || 'L').charAt(0).toUpperCase())}</span>
      <div class="crm-v27-action-copy"><div><strong>${escapeHtml(lead.full_name || 'Unnamed lead')}</strong><span class="crm-v27-stage ${crmStatusClass(lead.status)}">${escapeHtml(lead.status || 'NEW')}</span></div><small>${escapeHtml(lead.property_name || lead.location || 'General property enquiry')}</small><p>${escapeHtml(leadNextActionText(lead))}</p></div>
      <div class="crm-v27-action-meta"><strong>${Number(lead.lead_score || 0)}</strong><small>score</small></div>
      <div class="crm-v27-action-buttons"><button type="button" data-workspace-lead="${lead.id}">Open</button>${phone ? `<a href="tel:+91${phone}" aria-label="Call ${escapeHtml(lead.full_name || 'lead')}">☎</a><a href="https://wa.me/91${phone}" target="_blank" rel="noopener" aria-label="WhatsApp ${escapeHtml(lead.full_name || 'lead')}">◉</a>` : ''}</div>
    </article>`;
  }).join('') || '<div class="crm-v27-empty"><span>✓</span><strong>Action queue is clear</strong><small>New enquiries and follow-ups will appear here.</small></div>';

  const visitHost = byId('crmUpcomingVisits');
  if (visitHost) visitHost.innerHTML = visits.slice(0,4).map(lead => `
    <button type="button" data-workspace-lead="${lead.id}">
      <span>${escapeHtml(String(lead.full_name || 'V').charAt(0).toUpperCase())}</span>
      <div><strong>${escapeHtml(lead.full_name || 'Site visit')}</strong><small>${escapeHtml(lead.property_name || lead.location || 'Property not selected')}</small></div>
      <time>${escapeHtml(lead.contact_time || 'Schedule pending')}</time>
    </button>`).join('') || '<div class="crm-v27-mini-empty">No site visits in the current queue.</div>';
}

function propertyMatchScore(lead={},property={}) {
  let score = 5;
  const leadType = String(lead.property_type || '').toLowerCase();
  const propertyType = String(property.property_type || '').toLowerCase();
  const leadLocation = String(lead.location || '').toLowerCase();
  const propertyLocation = `${property.location || ''} ${property.city || ''}`.toLowerCase();
  const leadBhk = String(lead.bhk || '').toLowerCase();
  const propertyBhk = String(property.bhk || '').toLowerCase();
  const lookingFor = String(lead.looking_for || '').toLowerCase();
  const listingPurpose = String(property.listing_purpose || '').toLowerCase();
  const budgetText = String(lead.budget || '').toLowerCase();
  const budgetValues = [...budgetText.matchAll(/(\d+(?:\.\d+)?)\s*(crore|cr|lakh|lac|lakhs|lacs)?/g)].map(match => {
    const value = Number(match[1]);
    const unit = match[2] || '';
    if (unit === 'crore' || unit === 'cr') return value * 10000000;
    if (unit.startsWith('la')) return value * 100000;
    return value;
  }).filter(Number.isFinite);
  const maxBudget = budgetValues.length ? Math.max(...budgetValues) : 0;
  const propertyPrice = Number(property.price_amount || 0);
  if (lead.property_id && lead.property_id === property.id) score += 70;
  if (leadType && propertyType && (leadType === propertyType || propertyType.includes(leadType) || leadType.includes(propertyType))) score += 26;
  if (leadBhk && propertyBhk && (leadBhk.includes(propertyBhk) || propertyBhk.includes(leadBhk))) score += 20;
  if (leadLocation && propertyLocation && leadLocation.split(/[\s,/-]+/).filter(word => word.length > 2).some(word => propertyLocation.includes(word))) score += 24;
  if ((lookingFor.includes('rent') && listingPurpose.includes('rent')) || (lookingFor.includes('buy') && listingPurpose.includes('sale'))) score += 12;
  if (maxBudget && propertyPrice) score += propertyPrice <= maxBudget * 1.1 ? 18 : -12;
  if (property.featured) score += 3;
  if (property.verified) score += 3;
  return Math.max(0,Math.min(99,score));
}

function matchingPropertiesForLead(lead) {
  return properties
    .filter(property => property.published !== false && !/sold|unavailable/i.test(String(property.status_label || '')))
    .map(property => ({property,score:propertyMatchScore(lead,property)}))
    .filter(item => item.score >= 24 || lead.property_id === item.property.id)
    .sort((a,b) => b.score - a.score)
    .slice(0,3);
}

function renderLeadPropertyMatches(lead) {
  const host = byId('leadPropertyMatches');
  if (!host) return;
  const matches = matchingPropertiesForLead(lead);
  host.innerHTML = matches.map(({property,score},index) => `
    <a href="../property-details.html?id=${encodeURIComponent(property.id)}" target="_blank" rel="noopener" class="lead-property-match">
      <span class="lead-match-rank">${String(index + 1).padStart(2,'0')}</span>
      <div><strong>${escapeHtml(property.title || 'Property')}</strong><small>${escapeHtml([property.bhk,property.property_type,property.location].filter(Boolean).join(' • ') || 'Inventory match')}</small></div>
      <span class="lead-match-score"><b>${score}%</b><small>MATCH</small></span>
      <i>↗</i>
    </a>`).join('') || '<div class="crm-v27-mini-empty">Publish properties to activate inventory matching.</div>';
}

function kanbanBucket(lead) {
  if (lead.status === 'NEW') return 'new';
  if (['HOT','WARM'].includes(lead.status)) return 'priority';
  if (['CONTACTED','COLD'].includes(lead.status)) return 'followup';
  if (lead.status === 'VISIT BOOKED') return 'visits';
  return 'closed';
}

function kanbanCard(lead) {
  const phone = String(lead.mobile || '').replace(/\D/g, '').slice(-10);
  return `<article class="crm-kanban-card" draggable="true" data-kanban-lead="${lead.id}">
    <div class="kanban-card-top"><span>${leadTypeBadge(lead)}</span><b>Score ${Number(lead.lead_score || 0)}</b></div>
    <h3>${escapeHtml(lead.full_name || 'Unnamed lead')}</h3>
    <p>${escapeHtml(lead.property_name || lead.location || 'General property enquiry')}</p>
    <small>${escapeHtml([lead.property_price || lead.budget, lead.bhk].filter(Boolean).join(' • ') || 'Details on request')}</small>
    <div class="kanban-card-meta"><span>${escapeHtml(lead.status || 'NEW')}</span><time>${escapeHtml(formatDate(lead.created_at))}</time></div>
    <select data-kanban-status-select="${lead.id}" aria-label="Change lead stage">
      ${['NEW','HOT','WARM','COLD','CONTACTED','VISIT BOOKED','WON','LOST'].map(status => `<option ${lead.status===status?'selected':''}>${status}</option>`).join('')}
    </select>
    <div class="kanban-card-actions"><button type="button" data-view-lead="${lead.id}">Open</button>${phone ? `<a href="https://wa.me/91${phone}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</div>
  </article>`;
}

function renderKanbanBoard() {
  const board = byId('crmKanbanBoard');
  if (!board) return;
  const list = filteredLeads().filter(lead => !isDeletedLead(lead));
  const buckets = {new:[],priority:[],followup:[],visits:[],closed:[]};
  list.forEach(lead => buckets[kanbanBucket(lead)].push(lead));
  Object.entries(buckets).forEach(([bucket,items]) => {
    const host = board.querySelector(`[data-kanban-list="${bucket}"]`);
    if (host) host.innerHTML = items.map(kanbanCard).join('') || '<div class="kanban-empty">No leads</div>';
  });
  const counts = {
    kanbanNewCount:buckets.new.length,
    kanbanPriorityCount:buckets.priority.length,
    kanbanFollowupCount:buckets.followup.length,
    kanbanVisitsCount:buckets.visits.length,
    kanbanClosedCount:buckets.closed.length
  };
  Object.entries(counts).forEach(([id,count]) => { if(byId(id)) byId(id).textContent=count; });
  if (byId('crmKanbanCount')) byId('crmKanbanCount').textContent = `${list.length} active card${list.length===1?'':'s'}`;
}

function setCrmView(view) {
  crmView = ['workspace','kanban','table'].includes(view) ? view : 'workspace';
  byId('crmWorkspaceView')?.classList.toggle('hidden', crmView !== 'workspace');
  byId('crmTableView')?.classList.toggle('hidden', crmView !== 'table');
  byId('crmKanbanView')?.classList.toggle('hidden', crmView !== 'kanban');
  byId('crmBrowseControls')?.classList.toggle('hidden', crmView === 'workspace');
  $$('[data-crm-view]').forEach(button => button.classList.toggle('active', button.dataset.crmView === crmView));
  if (crmView === 'kanban') renderKanbanBoard();
  if (crmView === 'workspace') renderCrmWorkspace();
}

function populateNewLeadProperties() {
  const select = byId('newLeadProperty');
  if (!select) return;
  select.innerHTML = '<option value="">General enquiry / not selected</option>' + properties
    .filter(property => property.published !== false)
    .map(property => `<option value="${property.id}">${escapeHtml(property.title || 'Property')} — ${escapeHtml(property.location || property.price_label || 'Available')}</option>`)
    .join('');
}

function openLeadCreateModal() {
  byId('leadCreateForm')?.reset();
  if (byId('leadCreateMessage')) byId('leadCreateMessage').textContent = '';
  populateNewLeadProperties();
  openModal('leadCreateModal');
  requestAnimationFrame(() => byId('newLeadName')?.focus());
}

function manualLeadScore(status,values={}) {
  const base = {HOT:78,WARM:60,CONTACTED:55,'VISIT BOOKED':82,NEW:38}[status] || 38;
  const completion = [values.email,values.location,values.budget,values.propertyId,values.requirements].filter(Boolean).length * 3;
  return Math.min(96,base + completion);
}

async function createManualLead(event) {
  event.preventDefault();
  const submit = byId('createLeadSubmit');
  const message = byId('leadCreateMessage');
  const phone = safePhone(byId('newLeadMobile').value);
  if (phone.length !== 10) {
    message.textContent = 'Enter a valid 10-digit mobile number.';
    byId('newLeadMobile').focus();
    return;
  }
  const property = properties.find(item => item.id === byId('newLeadProperty').value);
  const status = byId('newLeadStatus').value;
  const values = {
    email:byId('newLeadEmail').value.trim(),
    location:byId('newLeadLocation').value.trim(),
    budget:byId('newLeadBudget').value.trim(),
    propertyId:property?.id || null,
    requirements:byId('newLeadRequirements').value.trim(),
    contactTime:byId('newLeadContactTime').value.trim()
  };
  const payload = {
    lead_id:`GDM${Date.now().toString(36).toUpperCase()}${crypto.randomUUID().slice(0,4).toUpperCase()}`,
    full_name:byId('newLeadName').value.trim(),
    mobile:`+91 ${phone}`,
    email:values.email || null,
    contact_method:byId('newLeadSource').value === 'WhatsApp' ? 'WhatsApp' : 'Mobile',
    looking_for:byId('newLeadLookingFor').value,
    property_type:byId('newLeadPropertyType').value,
    location:values.location || null,
    bhk:byId('newLeadBhk').value.trim() || null,
    budget:values.budget || null,
    property_id:property?.id || null,
    property_name:property?.title || null,
    property_price:property?.price_label || null,
    property_area:property?.area || null,
    requirements:values.requirements || null,
    contact_time:values.contactTime || null,
    source:byId('newLeadSource').value,
    page_url:'Admin CRM / Manual Entry',
    lead_score:manualLeadScore(status,values),
    status,
    notes:values.requirements || null
  };
  submit.disabled = true;
  submit.textContent = 'Creating lead…';
  message.textContent = '';
  try {
    const {data,error} = await client.from('leads').insert(payload).select('*').single();
    if (error) throw error;
    closeModal('leadCreateModal');
    await loadLeads();
    setCrmView('workspace');
    openLeadDetail(leads.find(lead => lead.id === data.id) || data);
    setStatus('New lead created','success');
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
    submit.textContent = 'Create lead & open profile';
  }
}

function setLeadDetailText(id, value) {
  const element = byId(id);
  if (element) element.textContent = valueOrDash(value);
}

function safePhone(value) {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

function configureLeadDetailTrashActions(lead) {
  const deleted = isDeletedLead(lead);

  byId("leadDetailTrash").classList.toggle("hidden", deleted);
  byId("leadDetailRestore").classList.toggle("hidden", !deleted);
  byId("leadDetailPermanentDelete").classList.toggle("hidden", !deleted);

  byId("leadDetailSave").disabled = deleted;
  byId("leadDetailStatus").disabled = deleted;
  byId("leadDetailNotes").disabled = deleted;
  byId("leadAssignedTo").disabled = deleted;
  byId("leadFollowUpAt").disabled = deleted;
  byId("leadNextActionInput").disabled = deleted;
}

function openLeadDetail(lead) {
  if (!lead) return;

  activeLeadId = lead.id;
  const visit = isVisitLead(lead);
  const phone = safePhone(lead.mobile);

  const typeBadge = byId("leadDetailType");
  typeBadge.textContent = isDeletedLead(lead)
    ? "TRASHED LEAD"
    : visit ? "SITE VISIT" : "PROPERTY ENQUIRY";
  typeBadge.className = `crm-type-badge ${isDeletedLead(lead) ? "trash" : visit ? "visit" : "enquiry"}`;

  setLeadDetailText("leadDetailId", lead.lead_id || lead.id);
  setLeadDetailText(
    "leadDetailTitle",
    isDeletedLead(lead) ? "Deleted CRM record" : visit ? "Site visit booking" : "Property enquiry"
  );
  setLeadDetailText(
    "leadDetailCreated",
    isDeletedLead(lead)
      ? `Created ${formatDate(lead.created_at)} • Deleted ${formatDate(lead.deleted_at)}`
      : formatDate(lead.created_at)
  );

  setLeadDetailText("leadDetailName", lead.full_name);
  setLeadDetailText("leadDetailMobile", lead.mobile);
  setLeadDetailText("leadDetailEmail", lead.email);
  setLeadDetailText("leadDetailContactMethod", lead.contact_method || (visit ? "Mobile / Email" : "Not specified"));

  setLeadDetailText("leadDetailPropertyName", lead.property_name || "General enquiry");
  setLeadDetailText("leadDetailPropertyType", lead.property_type);
  setLeadDetailText("leadDetailBhk", lead.bhk);
  setLeadDetailText("leadDetailPrice", lead.property_price || lead.budget);
  setLeadDetailText("leadDetailArea", lead.property_area);
  setLeadDetailText("leadDetailLocation", lead.location);

  setLeadDetailText("leadDetailLookingFor", lead.looking_for);
  setLeadDetailText("leadDetailPurchaseTimeline", lead.timeline);
  setLeadDetailText("leadDetailLoan", lead.loan_required);
  setLeadDetailText("leadDetailContactTime", lead.contact_time);
  setLeadDetailText("leadDetailVisitSchedule", lead.contact_time);
  setLeadDetailText("leadDetailRequirements", lead.requirements || "No message or additional requirement provided.");
  setLeadDetailText("leadDetailScore", Number(lead.lead_score || 0));
  setLeadDetailText("leadDetailSource", lead.source);
  renderLeadPropertyMatches(lead);

  byId("leadInquirySection").classList.toggle("hidden", visit);
  byId("leadVisitSection").classList.toggle("hidden", !visit);
  byId("leadDetailStatus").value = lead.status || "NEW";
  byId("leadDetailNotes").value = lead.notes || "";
  populateLeadAgentSelect(lead.assigned_to||'');
  byId("leadFollowUpAt").value = toDateTimeLocal(lead.follow_up_at);
  byId("leadNextActionInput").value = lead.next_action || leadNextActionText(lead);
  byId("leadDetailMessage").textContent = "";

  const score = Math.max(0, Math.min(100, Number(lead.lead_score || 0)));
  const scoreMeter = byId("leadScoreMeter");
  if (scoreMeter) scoreMeter.style.setProperty('--lead-score', `${score * 3.6}deg`);
  if (byId("leadScoreLabel")) byId("leadScoreLabel").textContent = score >= 75 ? 'High-conversion opportunity' : score >= 45 ? 'Qualified opportunity' : 'Early-stage opportunity';
  if (byId("leadNextBestAction")) byId("leadNextBestAction").textContent = lead.next_action || leadNextActionText(lead);
  const timeline = byId("leadDetailActivityTimeline");
  if (timeline) timeline.innerHTML = [
    ['Lead received', formatDate(lead.created_at)],
    [`Source: ${valueOrDash(lead.source)}`, isVisitLead(lead) ? 'Site visit request' : 'Property enquiry'],
    [`Current status: ${valueOrDash(lead.status)}`, leadNextActionText(lead)],
    ...(lead.updated_at && lead.updated_at !== lead.created_at ? [['Last CRM update', formatDate(lead.updated_at)]] : [])
  ].map(([title,meta]) => `<div><i></i><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(meta)}</small></span></div>`).join('');

  const callAction = byId("leadCallAction");
  callAction.href = phone ? `tel:+91${phone}` : "#";
  callAction.classList.toggle("disabled", !phone);

  const whatsappAction = byId("leadWhatsappAction");
  whatsappAction.href = phone
    ? `https://wa.me/91${phone}?text=${encodeURIComponent(`Hello ${lead.full_name || ""}, this is GD Property Consult regarding ${lead.property_name || "your property request"}.`)}`
    : "#";
  whatsappAction.classList.toggle("disabled", !phone);

  const emailAction = byId("leadEmailAction");
  emailAction.href = lead.email
    ? `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(`GD Property Consult — ${lead.property_name || "Property enquiry"}`)}`
    : "#";
  emailAction.classList.toggle("disabled", !lead.email);

  const propertyAction = byId("leadPropertyAction");
  if (lead.property_id) {
    propertyAction.href = `../property-details.html?id=${encodeURIComponent(lead.property_id)}`;
    propertyAction.classList.remove("hidden");
  } else {
    propertyAction.classList.add("hidden");
    propertyAction.removeAttribute("href");
  }

  configureLeadDetailTrashActions(lead);
  openModal("leadDetailModal");
}

async function updateLeadRecords(ids, payload) {
  if (!ids.length) return;

  const { error } = await client
    .from("leads")
    .update({ ...payload, updated_at:new Date().toISOString() })
    .in("id", ids);

  if (error) throw error;
}

async function moveLeadsToTrash(ids) {
  if (!ids.length) return;

  const count = ids.length;
  if (!confirm(`Move ${count} selected lead${count === 1 ? "" : "s"} to Trash?`)) return;

  await updateLeadRecords(ids, { deleted_at:new Date().toISOString() });
  selectedLeadIds.clear();
  closeModal("leadDetailModal");
  await loadLeads();
}

async function restoreLeads(ids) {
  if (!ids.length) return;

  await updateLeadRecords(ids, { deleted_at:null });
  selectedLeadIds.clear();
  closeModal("leadDetailModal");
  await loadLeads();
}

async function permanentlyDeleteLeads(ids) {
  if (!ids.length) return;

  const count = ids.length;
  const warning =
    `Permanently delete ${count} lead${count === 1 ? "" : "s"}?\n\n` +
    "This cannot be undone.";

  if (!confirm(warning)) return;

  const { error } = await client.from("leads").delete().in("id", ids);
  if (error) throw error;

  selectedLeadIds.clear();
  closeModal("leadDetailModal");
  await loadLeads();
}

function setLeadView(nextView) {
  leadTypeFilter = nextView;
  leadPage = 1;
  selectedLeadIds.clear();
  updateLeadFilterUI();
  if (nextView === "trash") setCrmView("table");
  renderLeads();
}

$$("[data-lead-type-filter]").forEach(button => {
  button.addEventListener("click", () => {
    setLeadView(button.dataset.leadTypeFilter);
  });
});

byId("leadFilter").addEventListener("change", () => {
  leadPage = 1;
  selectedLeadIds.clear();
  renderLeads();
});

byId("leadSearch").addEventListener("input", () => {
  leadPage = 1;
  selectedLeadIds.clear();
  renderLeads();
});

byId("leadSort").addEventListener("change", event => {
  leadSort = event.target.value;
  leadPage = 1;
  renderLeads();
});

byId("leadPageSize").addEventListener("change", event => {
  leadPageSize = Number(event.target.value) || 10;
  leadPage = 1;
  selectedLeadIds.clear();
  renderLeads();
});

byId("leadPreviousPage").addEventListener("click", () => {
  if (leadPage <= 1) return;
  leadPage -= 1;
  renderLeads();
});

byId("leadNextPage").addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(filteredLeads().length / leadPageSize));
  if (leadPage >= totalPages) return;
  leadPage += 1;
  renderLeads();
});

byId("selectLeadPage").addEventListener("change", event => {
  pagedLeads().forEach(lead => {
    if (event.target.checked) selectedLeadIds.add(lead.id);
    else selectedLeadIds.delete(lead.id);
  });
  renderLeads();
});

byId("selectAllFilteredLeads").addEventListener("click", () => {
  filteredLeads().forEach(lead => selectedLeadIds.add(lead.id));
  renderLeads();
});

byId("clearLeadSelection").addEventListener("click", () => {
  selectedLeadIds.clear();
  renderLeads();
});

byId("leadRows").addEventListener("change", async event => {
  const checkbox = event.target.closest("[data-select-lead]");
  if (checkbox) {
    if (checkbox.checked) selectedLeadIds.add(checkbox.dataset.selectLead);
    else selectedLeadIds.delete(checkbox.dataset.selectLead);
    updateLeadPageCheckbox();
    updateLeadBulkBar();
    return;
  }

  const select = event.target.closest("[data-lead-status]");
  if (!select) return;

  const { error } = await client
    .from("leads")
    .update({ status:select.value, updated_at:new Date().toISOString() })
    .eq("id", select.dataset.leadStatus);

  if (error) alert(error.message);
  else loadLeads({ preserveSelection:true });
});

byId("leadRows").addEventListener("click", async event => {
  const view = event.target.closest("[data-view-lead]");
  if (view) {
    openLeadDetail(leads.find(lead => lead.id === view.dataset.viewLead));
    return;
  }

  const trash = event.target.closest("[data-trash-lead]");
  if (trash) {
    try {
      await moveLeadsToTrash([trash.dataset.trashLead]);
    } catch (error) {
      alert(error.message);
    }
    return;
  }

  const restore = event.target.closest("[data-restore-lead]");
  if (restore) {
    try {
      await restoreLeads([restore.dataset.restoreLead]);
    } catch (error) {
      alert(error.message);
    }
    return;
  }

  const permanent = event.target.closest("[data-delete-lead-forever]");
  if (permanent) {
    try {
      await permanentlyDeleteLeads([permanent.dataset.deleteLeadForever]);
    } catch (error) {
      alert(error.message);
    }
  }
});

byId("applyBulkLeadStatus").addEventListener("click", async () => {
  const status = byId("bulkLeadStatus").value;
  const ids = [...selectedLeadIds];

  if (!status) {
    alert("Choose a status first.");
    return;
  }

  try {
    await updateLeadRecords(ids, { status });
    selectedLeadIds.clear();
    byId("bulkLeadStatus").value = "";
    await loadLeads();
  } catch (error) {
    alert(error.message);
  }
});

byId("moveSelectedToTrash").addEventListener("click", async () => {
  try {
    await moveLeadsToTrash([...selectedLeadIds]);
  } catch (error) {
    alert(error.message);
  }
});

byId("restoreSelectedLeads").addEventListener("click", async () => {
  try {
    await restoreLeads([...selectedLeadIds]);
  } catch (error) {
    alert(error.message);
  }
});

byId("deleteSelectedForever").addEventListener("click", async () => {
  try {
    await permanentlyDeleteLeads([...selectedLeadIds]);
  } catch (error) {
    alert(error.message);
  }
});

byId("leadDetailSave").addEventListener("click", async () => {
  const lead = leads.find(item => item.id === activeLeadId);
  if (!lead || isDeletedLead(lead)) return;

  const button = byId("leadDetailSave");
  button.disabled = true;
  button.textContent = "Saving…";
  byId("leadDetailMessage").textContent = "";

  try {
    const payload = {
      status:byId("leadDetailStatus").value,
      notes:byId("leadDetailNotes").value.trim(),
      updated_at:new Date().toISOString()
    };
    if(salesAutomationAvailable){
      const followUp=byId('leadFollowUpAt').value;
      payload.assigned_to=byId('leadAssignedTo').value||null;
      payload.follow_up_at=followUp?new Date(followUp).toISOString():null;
      payload.next_action=byId('leadNextActionInput').value.trim()||null;
      if(payload.status==='CONTACTED')payload.last_contacted_at=new Date().toISOString();
    }

    const { error } = await client.from("leads").update(payload).eq("id", activeLeadId);
    if (error) throw error;

    byId("leadDetailMessage").textContent = "CRM changes saved.";
    await loadLeads({ preserveSelection:true });
    await loadSalesAutomation();
  } catch (error) {
    byId("leadDetailMessage").textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Save CRM changes";
  }
});

byId("leadDetailTrash").addEventListener("click", async () => {
  try {
    await moveLeadsToTrash([activeLeadId]);
  } catch (error) {
    byId("leadDetailMessage").textContent = error.message;
  }
});

byId("leadDetailRestore").addEventListener("click", async () => {
  try {
    await restoreLeads([activeLeadId]);
  } catch (error) {
    byId("leadDetailMessage").textContent = error.message;
  }
});

byId("leadDetailPermanentDelete").addEventListener("click", async () => {
  try {
    await permanentlyDeleteLeads([activeLeadId]);
  } catch (error) {
    byId("leadDetailMessage").textContent = error.message;
  }
});

function leadCsvData(list) {
  const headers = [
    "Record Type","Lead ID","Name","Mobile","Email","Property ID","Property Name",
    "Property Price","Property Area","BHK","Property Type","Location","Looking For",
    "Budget","Timeline","Loan Required","Contact Method","Visit / Contact Time",
    "Requirements","Score","Status","Source","Internal Notes","Created","Deleted At"
  ];

  const rows = list.map(lead => [
    isVisitLead(lead) ? "Site Visit" : "Property Enquiry",
    lead.lead_id, lead.full_name, lead.mobile, lead.email, lead.property_id,
    lead.property_name, lead.property_price, lead.property_area, lead.bhk,
    lead.property_type, lead.location, lead.looking_for, lead.budget,
    lead.timeline, lead.loan_required, lead.contact_method, lead.contact_time,
    lead.requirements, lead.lead_score, lead.status, lead.source, lead.notes,
    lead.created_at, lead.deleted_at
  ]);

  return [headers, ...rows]
    .map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function downloadLeadCsv(list, label) {
  if (!list.length) {
    alert("No records available to export.");
    return;
  }

  const url = URL.createObjectURL(
    new Blob([leadCsvData(list)], { type:"text/csv;charset=utf-8" })
  );

  const link = document.createElement("a");
  link.href = url;
  link.download = `keyassets-${label}-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

byId("exportLeads").addEventListener("click", () => {
  downloadLeadCsv(filteredLeads(), `${leadTypeFilter}-leads`);
});

byId("exportSelectedLeads").addEventListener("click", () => {
  downloadLeadCsv(selectedLeadRecords(), "selected-leads");
});

// Testimonials V17.2
const MAX_PUBLISHED_TESTIMONIALS = 8;
let testimonialPreviewObjectUrl = '';

function testimonialImage(item){
  return String(item?.poster_image_url || item?.avatar_url || '').trim();
}

function adminTestimonialImageUrl(url){
  const value=String(url||'').trim();
  if(!value)return '';
  if(/^(https?:|data:|blob:)/i.test(value))return value;
  if(value.startsWith('../'))return value;
  return `../${value.replace(/^\/+/,'')}`;
}

function posterTestimonials(){
  return testimonials.filter(item=>testimonialImage(item));
}

function publishedPosterTestimonials(excludeId=''){
  return posterTestimonials().filter(item=>item.published && item.id!==excludeId);
}

function updateTestimonialStats(){
  const posters=posterTestimonials();
  byId('testimonialPublishedCount').textContent=posters.filter(item=>item.published).length;
  byId('testimonialTotalCount').textContent=testimonials.length;
  byId('testimonialFeaturedCount').textContent=posters.filter(item=>item.featured).length;
}

async function loadTestimonials(){
  const{data,error}=await client
    .from('testimonials')
    .select('*')
    .order('sort_order')
    .order('created_at',{ascending:false});

  if(error)throw error;
  testimonials=data||[];
  renderTestimonials();
  updateTestimonialStats();
}

function renderTestimonials(){
  const list=byId('testimonialList');
  if(!testimonials.length){
    list.innerHTML='<div class="empty testimonial-admin-empty"><strong>No testimonials yet.</strong><span>Click “Add testimonial” to upload the first client-success poster.</span></div>';
    return;
  }

  const ordered=[...testimonials].sort((a,b)=>{
    const aPoster=testimonialImage(a)?0:1;
    const bPoster=testimonialImage(b)?0:1;
    return aPoster-bPoster || Number(a.sort_order||0)-Number(b.sort_order||0);
  });

  list.innerHTML=ordered.map((item,index)=>{
    const image=testimonialImage(item);
    const live=item.published&&image;
    const project=item.project_name||'Project not added';
    const location=item.location||item.client_role||'Location not added';
    const imageMarkup=image
      ?`<img src="${escapeHtml(adminTestimonialImageUrl(image))}" alt="${escapeHtml(item.client_name||'Client')} testimonial">`
      :'<div class="testimonial-admin-no-image">NO IMAGE</div>';

    return `<article class="testimonial-admin-row ${live?'is-live':'is-hidden'}">
      <div class="testimonial-admin-thumb">${imageMarkup}<span>${String(index+1).padStart(2,'0')}</span></div>
      <div class="testimonial-admin-content">
        <div class="testimonial-admin-titleline">
          <div>
            <h3>${escapeHtml(item.client_name||'Unnamed client')}</h3>
            <p>${escapeHtml(project)} • ${escapeHtml(location)}</p>
          </div>
          <div class="testimonial-admin-badges">
            ${leadBadge(live?'Published':item.published?'Missing image':'Hidden')}
            ${item.featured?'<span class="badge featured">Featured</span>':''}
            <span class="badge">Order ${Number(item.sort_order||0)}</span>
          </div>
        </div>
        <blockquote>${escapeHtml(item.quote||'No caption added.')}</blockquote>
      </div>
      <div class="testimonial-admin-actions">
        <button type="button" data-move-testimonial="${item.id}" data-direction="-1" title="Move up">↑</button>
        <button type="button" data-move-testimonial="${item.id}" data-direction="1" title="Move down">↓</button>
        <button type="button" data-toggle-testimonial="${item.id}">${item.published?'Hide':'Publish'}</button>
        <button type="button" data-edit-testimonial="${item.id}">Edit</button>
        <button type="button" class="danger-soft" data-delete-testimonial="${item.id}">Delete</button>
      </div>
    </article>`;
  }).join('');
}

function updateTestimonialPreview(source=''){
  const image=byId('testimonialImagePreview');
  const empty=byId('testimonialPreviewEmpty');
  const name=byId('testimonialPreviewName');
  const meta=byId('testimonialPreviewMeta');
  const url=source||byId('testimonialImageUrl').value.trim();

  name.textContent=byId('testimonialName').value.trim()||'Client name';
  meta.textContent=[
    byId('testimonialProject').value.trim()||'Project',
    byId('testimonialLocation').value.trim()||'Location'
  ].join(' • ');

  if(url){
    image.src=/^(blob:|data:|https?:)/i.test(url)?url:adminTestimonialImageUrl(url);
    image.classList.add('visible');
    empty.classList.add('hidden');
  }else{
    image.removeAttribute('src');
    image.classList.remove('visible');
    empty.classList.remove('hidden');
  }
}

function clearTestimonialPreviewObjectUrl(){
  if(testimonialPreviewObjectUrl){
    URL.revokeObjectURL(testimonialPreviewObjectUrl);
    testimonialPreviewObjectUrl='';
  }
}

function openTestimonial(item=null){
  clearTestimonialPreviewObjectUrl();
  byId('testimonialForm').reset();
  byId('testimonialId').value=item?.id||'';
  byId('testimonialModalTitle').textContent=item?'Edit testimonial':'Add testimonial';
  byId('testimonialName').value=item?.client_name||'';
  byId('testimonialProject').value=item?.project_name||'';
  byId('testimonialLocation').value=item?.location||item?.client_role||'';
  byId('testimonialRole').value=item?.client_role||'';
  byId('testimonialQuote').value=item?.quote||'';
  byId('testimonialRating').value=item?.rating||5;
  byId('testimonialImageUrl').value=testimonialImage(item);
  byId('testimonialSortOrder').value=item?.sort_order||Math.max(1,posterTestimonials().length+1);
  byId('testimonialFeatured').checked=item?.featured??false;
  byId('testimonialPublished').checked=item?.published??true;
  byId('testimonialMessage').textContent='';
  byId('testimonialImageFile').value='';
  updateTestimonialPreview();
  openModal('testimonialModal');
}

async function moveTestimonial(id,direction){
  const items=posterTestimonials()
    .sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));
  const index=items.findIndex(item=>item.id===id);
  const target=index+Number(direction);
  if(index<0||target<0||target>=items.length)return;

  [items[index],items[target]]=[items[target],items[index]];
  const updates=items.map((item,position)=>
    client.from('testimonials').update({sort_order:position+1}).eq('id',item.id)
  );
  const results=await Promise.all(updates);
  const failed=results.find(result=>result.error);
  if(failed)throw failed.error;
  await loadTestimonials();
}

async function toggleTestimonialPublished(item){
  const image=testimonialImage(item);
  if(!item.published){
    if(!image)throw new Error('Upload a poster image before publishing this testimonial.');
    if(publishedPosterTestimonials(item.id).length>=MAX_PUBLISHED_TESTIMONIALS){
      throw new Error('Maximum 8 testimonials can be published on the website.');
    }
  }

  const{error}=await client
    .from('testimonials')
    .update({published:!item.published})
    .eq('id',item.id);
  if(error)throw error;
  await loadTestimonials();
}

byId('addTestimonialBtn').addEventListener('click',()=>openTestimonial());

['testimonialName','testimonialProject','testimonialLocation','testimonialImageUrl'].forEach(id=>{
  byId(id)?.addEventListener('input',()=>updateTestimonialPreview());
});

byId('testimonialImageFile')?.addEventListener('change',event=>{
  clearTestimonialPreviewObjectUrl();
  const file=event.target.files?.[0];
  if(!file){
    updateTestimonialPreview();
    return;
  }

  if(!/^image\/(png|jpeg|webp)$/i.test(file.type)){
    event.target.value='';
    byId('testimonialMessage').textContent='Only PNG, JPG and WebP images are allowed.';
    updateTestimonialPreview();
    return;
  }

  if(file.size>8*1024*1024){
    event.target.value='';
    byId('testimonialMessage').textContent='Image must be smaller than 8 MB.';
    updateTestimonialPreview();
    return;
  }

  byId('testimonialMessage').textContent='';
  testimonialPreviewObjectUrl=URL.createObjectURL(file);
  updateTestimonialPreview(testimonialPreviewObjectUrl);
});

byId('testimonialList').addEventListener('click',async event=>{
  try{
    const edit=event.target.closest('[data-edit-testimonial]');
    if(edit){
      openTestimonial(testimonials.find(item=>item.id===edit.dataset.editTestimonial));
      return;
    }

    const move=event.target.closest('[data-move-testimonial]');
    if(move){
      await moveTestimonial(move.dataset.moveTestimonial,move.dataset.direction);
      return;
    }

    const toggle=event.target.closest('[data-toggle-testimonial]');
    if(toggle){
      const item=testimonials.find(entry=>entry.id===toggle.dataset.toggleTestimonial);
      if(item)await toggleTestimonialPublished(item);
      return;
    }

    const del=event.target.closest('[data-delete-testimonial]');
    if(del&&confirm('Delete this testimonial permanently?')){
      const{error}=await client.from('testimonials').delete().eq('id',del.dataset.deleteTestimonial);
      if(error)throw error;
      await loadTestimonials();
    }
  }catch(error){
    alert(error.message);
  }
});

byId('testimonialForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const message=byId('testimonialMessage');
  message.textContent='';

  try{
    const id=byId('testimonialId').value;
    let imageUrl=byId('testimonialImageUrl').value.trim();
    const imageFile=byId('testimonialImageFile').files?.[0];

    if(imageFile){
      imageUrl=await uploadFile(imageFile,'testimonials');
    }

    if(!imageUrl)throw new Error('Testimonial poster image is required.');

    const published=byId('testimonialPublished').checked;
    if(published&&publishedPosterTestimonials(id).length>=MAX_PUBLISHED_TESTIMONIALS){
      throw new Error('Maximum 8 testimonials can be published on the website.');
    }

    const clientName=byId('testimonialName').value.trim();
    const projectName=byId('testimonialProject').value.trim();
    const location=byId('testimonialLocation').value.trim();
    const quote=byId('testimonialQuote').value.trim()||
      `Successful property experience at ${projectName}, ${location}.`;

    const payload={
      client_name:clientName,
      client_role:byId('testimonialRole').value.trim()||'Verified client',
      project_name:projectName,
      location,
      quote,
      rating:Number(byId('testimonialRating').value),
      poster_image_url:imageUrl,
      avatar_url:imageUrl,
      sort_order:Math.max(1,Number(byId('testimonialSortOrder').value)||1),
      featured:byId('testimonialFeatured').checked,
      published
    };

    const query=id
      ?client.from('testimonials').update(payload).eq('id',id)
      :client.from('testimonials').insert(payload);

    const{error}=await query;
    if(error)throw error;

    clearTestimonialPreviewObjectUrl();
    closeModal('testimonialModal');
    await loadTestimonials();
  }catch(error){
    message.textContent=error.message;
  }
});

// Blog
async function loadPosts(){const{data,error}=await client.from('blog_posts').select('*').order('created_at',{ascending:false});if(error)throw error;posts=data||[];renderPosts();byId('statPosts').textContent=posts.filter(p=>p.published).length}
function renderPosts(){byId('postList').innerHTML=posts.map(p=>`<div class="content-row"><div><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.excerpt||'No excerpt')}</p><div class="meta">${leadBadge(p.published?'Published':'Draft')}<span class="badge">${escapeHtml(p.category||'Guide')}</span></div></div><div class="content-row-actions"><button data-edit-post="${p.id}">Edit</button><button data-delete-post="${p.id}">Delete</button></div></div>`).join('')||'<div class="empty">No posts.</div>'}
function openPost(p=null){byId('postForm').reset();byId('postId').value=p?.id||'';byId('postModalTitle').textContent=p?'Edit post':'Add post';byId('postTitle').value=p?.title||'';byId('postSlug').value=p?.slug||'';byId('postCategory').value=p?.category||'Property Guide';byId('postAuthor').value=p?.author||'GD Property Consult';byId('postExcerpt').value=p?.excerpt||'';byId('postImage').value=p?.cover_image||'';byId('postContent').value=p?.content||'';byId('postFeatured').checked=p?.featured??false;byId('postPublished').checked=p?.published??false;byId('postMessage').textContent='';openModal('postModal')}
byId('postTitle').addEventListener('input',()=>{if(!byId('postId').value)byId('postSlug').value=slugify(byId('postTitle').value)});byId('addPostBtn').addEventListener('click',()=>openPost());byId('postList').addEventListener('click',async event=>{const edit=event.target.closest('[data-edit-post]');if(edit)return openPost(posts.find(p=>p.id===edit.dataset.editPost));const del=event.target.closest('[data-delete-post]');if(del&&confirm('Delete post?')){const{error}=await client.from('blog_posts').delete().eq('id',del.dataset.deletePost);if(error)alert(error.message);else loadPosts()}});
byId('postForm').addEventListener('submit',async event=>{event.preventDefault();try{let image=byId('postImage').value.trim();if(byId('postImageFile').files[0])image=await uploadFile(byId('postImageFile').files[0],'blog');const published=byId('postPublished').checked;const payload={title:byId('postTitle').value.trim(),slug:byId('postSlug').value.trim(),category:byId('postCategory').value.trim(),author:byId('postAuthor').value.trim(),excerpt:byId('postExcerpt').value.trim(),cover_image:image,content:byId('postContent').value.trim(),featured:byId('postFeatured').checked,published,published_at:published?new Date().toISOString():null};const id=byId('postId').value;const q=id?client.from('blog_posts').update(payload).eq('id',id):client.from('blog_posts').insert(payload);const{error}=await q;if(error)throw error;closeModal('postModal');loadPosts()}catch(e){byId('postMessage').textContent=e.message}});

// Media Manager V14
let mediaItems=[];
let selectedMedia=new Set();
let mediaView='grid';
const MEDIA_FOLDERS=['general','logos','hero','properties','properties/gallery','blog','documents'];

function bytesLabel(bytes=0){if(bytes<1024)return `${bytes} B`;if(bytes<1048576)return `${(bytes/1024).toFixed(1)} KB`;if(bytes<1073741824)return `${(bytes/1048576).toFixed(1)} MB`;return `${(bytes/1073741824).toFixed(2)} GB`}
function storagePathFromUrl(url=''){try{const marker='/storage/v1/object/public/site-media/';return decodeURIComponent(new URL(url).pathname.split(marker)[1]||'')}catch{return ''}}
function publicUrlFor(path){return client.storage.from('site-media').getPublicUrl(path).data.publicUrl}
function isImageFile(name=''){return /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(name)}
function mediaSelectedItems(){return mediaItems.filter(x=>selectedMedia.has(x.fullPath))}
function updateBulkControls(){const count=selectedMedia.size;byId('mediaDeleteSelected').textContent=`Delete selected (${count})`;byId('mediaSelectAll').checked=count>0&&count===filteredMediaItems().length;const trash=byId('mediaFilter').value==='trash';byId('mediaRestoreSelected').classList.toggle('hidden',!trash);byId('mediaPermanentDelete').classList.toggle('hidden',!trash);byId('mediaDeleteSelected').classList.toggle('hidden',trash)}

function mediaUsage(item){
  const url=item.publicUrl; const usage=[];
  properties.forEach(p=>{if(p.main_image===url||(p.gallery_images||[]).includes(url))usage.push(`Property: ${p.title}`)});
  posts.forEach(p=>{if(p.cover_image===url)usage.push(`Post: ${p.title}`)});
  if(siteSettings.logo_url===url)usage.push('Website logo');
  if(siteSettings.favicon_url===url)usage.push('Favicon');
  if(siteSettings.hero_image_url===url)usage.push('Homepage hero');
  return usage;
}
function filteredMediaItems(){
  const q=(byId('mediaSearch').value||'').toLowerCase().trim(); const filter=byId('mediaFilter').value; const sort=byId('mediaSort').value;
  let list=mediaItems.filter(x=>(!q||x.name.toLowerCase().includes(q))&&(filter==='all'||(filter==='trash'?x.isTrash:x.folder===filter||x.folder.startsWith(filter+'/'))));
  list.sort((a,b)=>sort==='oldest'?new Date(a.created_at||0)-new Date(b.created_at||0):sort==='name-asc'?a.name.localeCompare(b.name):sort==='name-desc'?b.name.localeCompare(a.name):sort==='size-desc'?(b.metadata?.size||0)-(a.metadata?.size||0):sort==='size-asc'?(a.metadata?.size||0)-(b.metadata?.size||0):new Date(b.created_at||0)-new Date(a.created_at||0));
  return list;
}
function renderMedia(){
  const list=filteredMediaItems(); const grid=byId('mediaGrid'); grid.classList.toggle('list-view',mediaView==='list');
  grid.innerHTML=list.map(item=>{const usage=mediaUsage(item);const checked=selectedMedia.has(item.fullPath);return `<article class="media-item ${checked?'selected':''}" data-media-path="${escapeHtml(item.fullPath)}"><label class="media-check"><input type="checkbox" data-media-select="${escapeHtml(item.fullPath)}" ${checked?'checked':''}><span></span></label><div class="media-preview" data-preview-path="${escapeHtml(item.fullPath)}">${isImageFile(item.name)?`<img src="${escapeHtml(item.publicUrl)}" alt="${escapeHtml(item.name)}" loading="lazy">`:'<div class="media-file-placeholder">FILE</div>'}</div><div class="media-info"><strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong><small>${escapeHtml(item.folder)} · ${bytesLabel(item.metadata?.size||0)}</small><small>${formatDate(item.created_at)}</small><div class="media-used-in">${usage.length?`Used in: ${escapeHtml(usage.slice(0,2).join(', '))}${usage.length>2?'…':''}`:'Not currently used'}</div><div class="media-actions"><button type="button" data-preview-path="${escapeHtml(item.fullPath)}">Preview</button><button type="button" data-copy-url="${escapeHtml(item.publicUrl)}">Copy URL</button>${item.isTrash?`<button type="button" data-restore-path="${escapeHtml(item.fullPath)}">Restore</button><button class="danger" type="button" data-permanent-path="${escapeHtml(item.fullPath)}">Delete forever</button>`:`<button type="button" data-rename-path="${escapeHtml(item.fullPath)}">Rename</button><button type="button" data-replace-path="${escapeHtml(item.fullPath)}">Replace</button><button class="danger" type="button" data-trash-path="${escapeHtml(item.fullPath)}">Delete</button>`}</div></div></article>`}).join('')||'<div class="empty">No matching files.</div>';
  byId('mediaMessage').textContent=`${list.length} shown · ${mediaItems.length} total`; updateBulkControls();
}
async function listFolderRecursive(folder,isTrash=false){const out=[];const{data,error}=await client.storage.from('site-media').list(folder,{limit:1000,sortBy:{column:'created_at',order:'desc'}});if(error)return out;for(const item of data||[]){if(item.name==='.emptyFolderPlaceholder')continue;const fullPath=`${folder}/${item.name}`;if(item.id||item.metadata){out.push({...item,folder,fullPath,publicUrl:publicUrlFor(fullPath),isTrash})}else{out.push(...await listFolderRecursive(fullPath,isTrash))}}return out}
async function loadMedia(){
  if(!client)return; byId('mediaMessage').textContent='Loading media…'; selectedMedia.clear();
  const groups=await Promise.all([...MEDIA_FOLDERS.map(f=>listFolderRecursive(f,false)),listFolderRecursive('trash',true)]); mediaItems=groups.flat();
  const total=mediaItems.reduce((n,x)=>n+(x.metadata?.size||0),0); const recent=mediaItems.filter(x=>Date.now()-new Date(x.created_at||0).getTime()<7*86400000).length; const limitMb=Number(siteSettings.media_storage_limit_mb||1024); const remaining=Math.max(0,limitMb*1048576-total);
  byId('mediaTotalFiles').textContent=mediaItems.filter(x=>!x.isTrash).length;byId('mediaStorageUsed').textContent=bytesLabel(total);byId('mediaStorageRemaining').textContent=bytesLabel(remaining);byId('mediaRecentCount').textContent=recent;renderMedia();
}
async function uploadMediaFiles(files){const folder=byId('mediaFolder').value||'general';if(!files.length)throw new Error('Select files first.');for(let i=0;i<files.length;i++){byId('mediaMessage').textContent=`Uploading ${i+1}/${files.length}…`;await uploadFile(files[i],folder)}byId('mediaFile').value='';await loadMedia()}
async function updateReferences(oldUrl,newUrl=''){
  for(const p of properties){let changed=false;const patch={};if(p.main_image===oldUrl){patch.main_image=newUrl;changed=true}const gallery=(p.gallery_images||[]).map(u=>u===oldUrl?newUrl:u).filter(Boolean);if(JSON.stringify(gallery)!==JSON.stringify(p.gallery_images||[])){patch.gallery_images=gallery;changed=true}if(changed)await client.from('properties').update(patch).eq('id',p.id)}
  for(const p of posts){if(p.cover_image===oldUrl)await client.from('blog_posts').update({cover_image:newUrl}).eq('id',p.id)}
  const settingsPatch={};if(siteSettings.logo_url===oldUrl)settingsPatch.logo_url=newUrl;if(siteSettings.favicon_url===oldUrl)settingsPatch.favicon_url=newUrl;if(siteSettings.hero_image_url===oldUrl)settingsPatch.hero_image_url=newUrl;if(Object.keys(settingsPatch).length)await client.from(window.GD_SITE_SETTINGS_TABLE || 'gd_site_settings').update(settingsPatch).eq('id',1);
  await Promise.all([loadProperties(),loadPosts(),loadSettings()]);
}
async function moveToTrash(items){if(!items.length)return;const used=items.flatMap(mediaUsage);if(!confirm(`${items.length} file(s) Recycle Bin me move hongi.${used.length?`\n\nWarning: ${used.length} website reference(s) use kar rahe hain. Property galleries automatically update hongi.`:''}`))return;for(let i=0;i<items.length;i++){const item=items[i];const encoded=btoa(unescape(encodeURIComponent(item.fullPath))).replace(/=/g,'');const trashPath=`trash/${Date.now()}--${encoded}--${item.name}`;byId('mediaMessage').textContent=`Moving ${i+1}/${items.length} to Recycle Bin…`;const{error}=await client.storage.from('site-media').move(item.fullPath,trashPath);if(error)throw error;await client.from('media_trash').insert({original_path:item.fullPath,trash_path:trashPath,file_name:item.name,public_url:item.publicUrl,deleted_by:currentProfile?.user_id||null});await updateReferences(item.publicUrl,'')}await loadMedia()}
async function restoreItems(items){for(const item of items){const{data:row}=await client.from('media_trash').select('*').eq('trash_path',item.fullPath).maybeSingle();if(!row)continue;let target=row.original_path;const exists=mediaItems.some(x=>x.fullPath===target&&!x.isTrash);if(exists){const parts=target.split('/');const name=parts.pop();target=`${parts.join('/')}/${Date.now()}-${name}`};const{error}=await client.storage.from('site-media').move(item.fullPath,target);if(error)throw error;await client.from('media_trash').delete().eq('trash_path',item.fullPath)}await loadMedia()}
async function permanentDelete(items){if(!items.length||!confirm(`Permanently delete ${items.length} file(s)? This cannot be undone.`))return;const paths=items.map(x=>x.fullPath);const{error}=await client.storage.from('site-media').remove(paths);if(error)throw error;await client.from('media_trash').delete().in('trash_path',paths);await loadMedia()}
async function renameMedia(item){const next=prompt('New file name:',item.name);if(!next||next===item.name)return;const safe=next.replace(/[^a-zA-Z0-9._-]+/g,'-');const target=`${item.folder}/${safe}`;const{error}=await client.storage.from('site-media').move(item.fullPath,target);if(error)throw error;await updateReferences(item.publicUrl,publicUrlFor(target));await loadMedia()}
async function replaceMedia(item){const input=document.createElement('input');input.type='file';input.accept='image/*,application/pdf';input.onchange=async()=>{const file=input.files[0];if(!file)return;const{error}=await client.storage.from('site-media').update(item.fullPath,file,{upsert:true,contentType:file.type||undefined});if(error)alert(error.message);else{await loadMedia();alert('File replaced successfully.')}};input.click()}
function previewMedia(item){const overlay=document.createElement('div');overlay.className='media-lightbox';overlay.innerHTML=`<button type="button">×</button><div>${isImageFile(item.name)?`<img src="${escapeHtml(item.publicUrl)}" alt="${escapeHtml(item.name)}">`:`<iframe src="${escapeHtml(item.publicUrl)}"></iframe>`}<strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.folder)} · ${bytesLabel(item.metadata?.size||0)} · ${formatDate(item.created_at)}</small></div>`;overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.tagName==='BUTTON')overlay.remove()});document.body.appendChild(overlay)}
async function moveSelected(){const folder=byId('mediaMoveFolder').value;if(!folder)return alert('Destination folder select karo.');const items=mediaSelectedItems().filter(x=>!x.isTrash);for(const item of items){const target=`${folder}/${item.name}`;const{error}=await client.storage.from('site-media').move(item.fullPath,target);if(error)throw error;await updateReferences(item.publicUrl,publicUrlFor(target))}await loadMedia()}
async function bulkDownload(){for(const item of mediaSelectedItems()){const{data,error}=await client.storage.from('site-media').download(item.fullPath);if(error)continue;const a=document.createElement('a');a.href=URL.createObjectURL(data);a.download=item.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);await new Promise(r=>setTimeout(r,250))}}

byId('refreshMedia').addEventListener('click',loadMedia);
byId('uploadMediaBtn').addEventListener('click',()=>uploadMediaFiles([...byId('mediaFile').files]).catch(e=>byId('mediaMessage').textContent=e.message));
['dragenter','dragover'].forEach(n=>byId('mediaDropZone').addEventListener(n,e=>{e.preventDefault();byId('mediaDropZone').classList.add('dragging')}));
['dragleave','drop'].forEach(n=>byId('mediaDropZone').addEventListener(n,e=>{e.preventDefault();byId('mediaDropZone').classList.remove('dragging')}));
byId('mediaDropZone').addEventListener('drop',e=>uploadMediaFiles([...e.dataTransfer.files]).catch(err=>byId('mediaMessage').textContent=err.message));
['mediaSearch','mediaFilter','mediaSort'].forEach(id=>byId(id).addEventListener(id==='mediaSearch'?'input':'change',renderMedia));
byId('mediaGridView').addEventListener('click',()=>{mediaView='grid';byId('mediaGridView').classList.add('active');byId('mediaListView').classList.remove('active');renderMedia()});
byId('mediaListView').addEventListener('click',()=>{mediaView='list';byId('mediaListView').classList.add('active');byId('mediaGridView').classList.remove('active');renderMedia()});
byId('mediaSelectAll').addEventListener('change',e=>{filteredMediaItems().forEach(x=>e.target.checked?selectedMedia.add(x.fullPath):selectedMedia.delete(x.fullPath));renderMedia()});
byId('mediaDeselectAll').addEventListener('click',()=>{selectedMedia.clear();renderMedia()});
byId('mediaDeleteSelected').addEventListener('click',()=>moveToTrash(mediaSelectedItems()).catch(e=>alert(e.message)));
byId('mediaRestoreSelected').addEventListener('click',()=>restoreItems(mediaSelectedItems()).catch(e=>alert(e.message)));
byId('mediaPermanentDelete').addEventListener('click',()=>permanentDelete(mediaSelectedItems()).catch(e=>alert(e.message)));
byId('mediaMoveSelected').addEventListener('click',()=>moveSelected().catch(e=>alert(e.message)));
byId('mediaDownloadSelected').addEventListener('click',bulkDownload);
byId('mediaCopySelected').addEventListener('click',async()=>{const urls=mediaSelectedItems().map(x=>x.publicUrl).join('\n');if(!urls)return;await navigator.clipboard.writeText(urls);alert('Selected URLs copied.')});
byId('mediaGrid').addEventListener('change',e=>{const box=e.target.closest('[data-media-select]');if(!box)return;box.checked?selectedMedia.add(box.dataset.mediaSelect):selectedMedia.delete(box.dataset.mediaSelect);renderMedia()});
byId('mediaGrid').addEventListener('click',async e=>{try{const path=e.target.closest('[data-preview-path]')?.dataset.previewPath;if(path)return previewMedia(mediaItems.find(x=>x.fullPath===path));const copy=e.target.closest('[data-copy-url]');if(copy){await navigator.clipboard.writeText(copy.dataset.copyUrl);return alert('URL copied.')}const rename=e.target.closest('[data-rename-path]');if(rename)return await renameMedia(mediaItems.find(x=>x.fullPath===rename.dataset.renamePath));const replace=e.target.closest('[data-replace-path]');if(replace)return replaceMedia(mediaItems.find(x=>x.fullPath===replace.dataset.replacePath));const trash=e.target.closest('[data-trash-path]');if(trash)return await moveToTrash([mediaItems.find(x=>x.fullPath===trash.dataset.trashPath)]);const restore=e.target.closest('[data-restore-path]');if(restore)return await restoreItems([mediaItems.find(x=>x.fullPath===restore.dataset.restorePath)]);const permanent=e.target.closest('[data-permanent-path]');if(permanent)return await permanentDelete([mediaItems.find(x=>x.fullPath===permanent.dataset.permanentPath)])}catch(err){alert(err.message)}});


function updateAdminClock() {
  const now = new Date();
  if (byId('adminClock')) byId('adminClock').textContent = now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
  if (byId('adminDate')) byId('adminDate').textContent = now.toLocaleDateString('en-IN',{weekday:'short',day:'2-digit',month:'short'});
  const hour = now.getHours();
  if (byId('adminGreeting')) byId('adminGreeting').textContent = `${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}, Sales Manager. Here is today’s revenue plan and follow-up pressure.`;
}
updateAdminClock();
setInterval(updateAdminClock, 30000);

$$('[data-crm-view]').forEach(button => button.addEventListener('click',()=>setCrmView(button.dataset.crmView)));
byId('addLeadBtn')?.addEventListener('click',openLeadCreateModal);
byId('leadCreateForm')?.addEventListener('submit',createManualLead);
$$('[data-crm-quick-view]').forEach(button => button.addEventListener('click',()=>{
  leadSmartFilter = button.dataset.crmQuickView || 'all';
  leadTypeFilter = 'all';
  leadPage = 1;
  selectedLeadIds.clear();
  byId('leadFilter').value = 'all';
  updateLeadFilterUI();
  $$('[data-crm-smart-filter]').forEach(item => item.classList.toggle('active',item.dataset.crmSmartFilter === leadSmartFilter));
  setCrmView('table');
  renderLeads();
}));
$$('[data-crm-smart-filter]').forEach(button => button.addEventListener('click',()=>{
  leadSmartFilter = button.dataset.crmSmartFilter || 'all';
  leadPage = 1;
  selectedLeadIds.clear();
  $$('[data-crm-smart-filter]').forEach(item => item.classList.toggle('active', item === button));
  renderLeads();
}));

byId('crmKanbanBoard')?.addEventListener('dragstart',event=>{
  const card=event.target.closest('[data-kanban-lead]');
  if(!card)return;
  event.dataTransfer.effectAllowed='move';
  event.dataTransfer.setData('text/plain',card.dataset.kanbanLead);
  card.classList.add('dragging');
});
byId('crmKanbanBoard')?.addEventListener('dragend',event=>event.target.closest('[data-kanban-lead]')?.classList.remove('dragging'));
byId('crmKanbanBoard')?.addEventListener('dragover',event=>{
  const column=event.target.closest('[data-kanban-status]');
  if(!column)return;
  event.preventDefault();
  column.classList.add('drag-over');
});
byId('crmKanbanBoard')?.addEventListener('dragleave',event=>event.target.closest('[data-kanban-status]')?.classList.remove('drag-over'));
byId('crmKanbanBoard')?.addEventListener('drop',async event=>{
  const column=event.target.closest('[data-kanban-status]');
  if(!column)return;
  event.preventDefault();
  column.classList.remove('drag-over');
  const id=event.dataTransfer.getData('text/plain');
  if(!id)return;
  try{await updateLeadRecords([id],{status:column.dataset.kanbanStatus});await loadLeads({preserveSelection:true})}catch(error){alert(error.message)}
});
byId('crmKanbanBoard')?.addEventListener('change',async event=>{
  const select=event.target.closest('[data-kanban-status-select]');
  if(!select)return;
  try{await updateLeadRecords([select.dataset.kanbanStatusSelect],{status:select.value});await loadLeads({preserveSelection:true})}catch(error){alert(error.message)}
});
byId('crmKanbanBoard')?.addEventListener('click',event=>{
  const view=event.target.closest('[data-view-lead]');
  if(view)openLeadDetail(leads.find(lead=>lead.id===view.dataset.viewLead));
});

document.addEventListener('click',event=>{
  const workspaceLead=event.target.closest('[data-workspace-lead]');
  if(workspaceLead && !event.target.closest('a')){openLeadDetail(leads.find(lead=>lead.id===workspaceLead.dataset.workspaceLead));return}
  const overviewLead=event.target.closest('[data-overview-lead]');
  if(overviewLead){openPanel('leads');openLeadDetail(leads.find(lead=>lead.id===overviewLead.dataset.overviewLead));return}
  const pipeline=event.target.closest('[data-pipeline-stage]');
  if(pipeline){openPanel('leads');leadSmartFilter='all';byId('leadFilter').value = ({PRIORITY:'HOT',VISIT:'VISIT BOOKED'}[pipeline.dataset.pipelineStage]||pipeline.dataset.pipelineStage);renderLeads();}
  const quickStatus=event.target.closest('[data-detail-quick-status]');
  if(quickStatus){byId('leadDetailStatus').value=quickStatus.dataset.detailQuickStatus;byId('leadNextBestAction').textContent=leadNextActionText({status:quickStatus.dataset.detailQuickStatus});}
});

function commandEntries(query='') {
  const normalized=query.trim().toLowerCase();
  const panels=[
    ['overview','Sales Command Center','Revenue metrics and daily execution'],['leads','Leads & CRM','Enquiries, site visits and pipeline'],['automation','Sales Automation','WhatsApp, email and follow-up queue'],['properties','Properties','Inventory and listings'],['homepage','Homepage','Hero, sections and About image'],['testimonials','Testimonials','Client success posters'],['media','Media Library','Images and documents'],['branding','Branding & Theme','Logo and brand colors'],['footer','Footer & Contact','Phone and WhatsApp'],['seo','SEO & Custom CSS','Search visibility and website mode']
  ].map(([panel,title,meta])=>({type:'panel',panel,title,meta}));
  const leadEntries=leads.slice(0,80).map(item=>({type:'lead',id:item.id,title:item.full_name||item.lead_id||'Lead',meta:[item.mobile,item.property_name,item.status].filter(Boolean).join(' • ')}));
  const propertyEntries=properties.slice(0,60).map(item=>({type:'property',id:item.id,title:item.title||'Property',meta:[item.location,item.price_label].filter(Boolean).join(' • ')}));
  const postEntries=posts.slice(0,40).map(item=>({type:'post',id:item.id,title:item.title||'Post',meta:item.category||'Blog / Insight'}));
  const all=[...panels,...leadEntries,...propertyEntries,...postEntries];
  return (normalized ? all.filter(item=>`${item.title} ${item.meta}`.toLowerCase().includes(normalized)) : panels).slice(0,12);
}

function renderCommandResults(query='') {
  const results=commandEntries(query);
  const host=byId('adminCommandResults');
  if(!host)return;
  host.innerHTML=results.map((item,index)=>`<button type="button" class="command-result ${index===0?'active':''}" data-command-type="${item.type}" data-command-id="${item.id||''}" data-command-panel="${item.panel||''}"><span>${item.type==='lead'?'◎':item.type==='property'?'▦':item.type==='post'?'▤':'⌁'}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.meta)}</small></div><kbd>↗</kbd></button>`).join('')||'<div class="command-empty">No matching command or record.</div>';
}

function openCommandPalette(){openModal('commandPaletteModal');byId('adminCommandInput').value='';renderCommandResults();requestAnimationFrame(()=>byId('adminCommandInput')?.focus())}
byId('adminCommandButton')?.addEventListener('click',openCommandPalette);
byId('adminCommandInput')?.addEventListener('input',event=>renderCommandResults(event.target.value));
document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
    if(!document.body.classList.contains('super-command-mode'))return;
    event.preventDefault();openCommandPalette();return
  }
  if(event.key==='Escape'&&!byId('commandPaletteModal')?.classList.contains('hidden'))closeModal('commandPaletteModal');
});
byId('adminCommandResults')?.addEventListener('click',event=>{
  const item=event.target.closest('[data-command-type]');if(!item)return;
  closeModal('commandPaletteModal');
  if(item.dataset.commandType==='panel'){openPanel(item.dataset.commandPanel);return}
  if(item.dataset.commandType==='lead'){openPanel('leads');openLeadDetail(leads.find(lead=>lead.id===item.dataset.commandId));return}
  if(item.dataset.commandType==='property'){openPanel('properties');openProperty(properties.find(property=>property.id===item.dataset.commandId));return}
  if(item.dataset.commandType==='post'){openPanel('blog');openPost(posts.find(post=>post.id===item.dataset.commandId));}
});

byId('overviewAddProperty')?.addEventListener('click',()=>{openPanel('properties');openProperty()});
byId('refreshSalesAutomation')?.addEventListener('click',async event=>{
  const button=event.currentTarget;
  button.disabled=true;button.textContent='Refreshing…';
  try{await loadLeads({preserveSelection:true});await loadSalesAutomation()}
  catch(error){alert(error.message)}
  finally{button.disabled=false;button.textContent='↻ Refresh'}
});
byId('automationRules')?.addEventListener('click',async event=>{
  const button=event.target.closest('[data-automation-rule]');
  if(!button||!salesAutomationAvailable)return;
  const rule=automationRules.find(item=>item.id===button.dataset.automationRule);
  if(!rule)return;
  button.disabled=true;
  const {error}=await client.from('automation_rules').update({enabled:!rule.enabled,updated_at:new Date().toISOString()}).eq('id',rule.id);
  if(error)alert(error.message);
  await loadSalesAutomation();
});
byId('automationJobs')?.addEventListener('click',async event=>{
  const button=event.target.closest('[data-retry-job]');
  if(!button||!salesAutomationAvailable)return;
  button.disabled=true;
  const {error}=await client.from('automation_jobs').update({status:'queued',scheduled_for:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq('id',button.dataset.retryJob).eq('status','failed');
  if(error)alert(error.message);
  await loadSalesAutomation();
});

async function loadAll(){
  setStatus('Loading…','saving');
  const tasks=[loadSettings(),loadProperties(),loadTestimonials(),loadPosts()];
  if(isSuperAdminProfile()) tasks.push(loadLeads());
  else {leads=[];selectedLeadIds.clear()}
  await Promise.all(tasks);
  if(isSuperAdminProfile())await loadSalesAutomation();
  renderExecutiveDashboard();
  renderKanbanBoard();
  renderCrmWorkspace();
  setCrmView('workspace');
  setStatus('Ready');
}

(async()=>{
  showAuthLoading('Checking secure admin session…');

  if(!client){
    showAuth();
    return;
  }

  try{
    const {data:{session},error}=await client.auth.getSession();
    if(error)throw error;

    if(session)await enterDashboard();
    else showAuth();
  }catch(error){
    showAuth();
    byId('loginMessage').textContent=error.message||'Unable to verify the admin session.';
  }

  client.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT'||!session)showAuth();
  });
})();
