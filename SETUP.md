# GD Property Real-Estate Automation Demo

## V20 premium interface update

- Property listing cards now use `main_image` plus `gallery_images` as an interactive slider.
- Desktop controls include previous/next arrows, image count and gallery dots.
- Mobile users can swipe left/right; controls remain touch-friendly.
- Cards include upgraded glass, depth, image transition and hover-light animation.
- Existing Supabase, CRM, enquiry, site-visit and n8n payload behavior is unchanged.

## 1. Supabase setup

1. Open Supabase Dashboard > SQL Editor.
2. Run `supabase-setup.sql` once.
3. Open Authentication > Users and create the first admin user.
4. Open `/admin/`, sign in with that user. The first authenticated user claims the Super Admin role.
5. Never put a service-role key in frontend files. Only the publishable/anon key belongs in `backend/supabase-config.js`.

## 2. n8n automation

1. Import `n8n/gd-property-lead-automation.json` in n8n.
2. Connect the Google Sheets and Gmail credentials.
3. In the Google Sheets node, select the destination spreadsheet and sheet.
4. Change the agent email in the Gmail node.
5. Activate the workflow and copy its Production Webhook URL.
6. Paste that URL into `window.GD_WEBHOOK_URL` in `backend/supabase-config.js`.

The website continues saving leads to Supabase even if n8n is temporarily unavailable. The form shows success when either Supabase or n8n accepts the lead.

## 3. Required production checks

- Submit one general enquiry and confirm it appears in Admin > Leads CRM.
- Submit one property-specific enquiry and confirm property name, price and configuration.
- Book one site visit and confirm date/time in the CRM.
- Confirm the same records reach Google Sheets and the agent email.
- Test on mobile and desktop before sharing the client demo.

## WhatsApp note

Automatic WhatsApp messages require an approved WhatsApp Business/Cloud API account and templates. The included website WhatsApp buttons work without API cost, but fully automatic messages should not be claimed until the client's WhatsApp API is connected.
