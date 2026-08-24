# V32 Sales Automation setup

V32 keeps all provider secrets outside the browser. The admin panel only manages rules and the Supabase queue.

## 1. Database

Run `backend/admin-v32-sales-automation.sql` once in the Supabase SQL Editor. Then update the Super Admin row in `admin_profiles` with `full_name`, `email`, `phone` and `team_role`.

## 2. n8n

Import `n8n/gd-property-v32-sales-automation.json`, connect the GD Property Gmail credential and configure these n8n environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `META_WHATSAPP_PHONE_NUMBER_ID`
- `META_WHATSAPP_ACCESS_TOKEN`

The service-role key and Meta token must never be added to `admin/config.js`, GitHub Pages or any frontend file.

## 3. WhatsApp approval

Create and approve the Meta WhatsApp templates named `gd_lead_received` and `gd_visit_confirmed`. Their body parameters are customer name and property name. Match language and parameter order in n8n if Meta approves a different template format.

Keep both WhatsApp rules OFF until the templates and production phone number are verified. Email rules can be tested first with one internal address.

## 4. Production QA

1. Submit one test enquiry and confirm it receives an owner and a 15-minute follow-up.
2. Confirm the agent email job changes from `queued` to `sent`.
3. Enable one WhatsApp rule, submit a consented test number and verify the approved template.
4. Change a test lead to `VISIT BOOKED` and confirm only one visit message is queued.
5. Force one provider failure, verify `failed` appears in the admin log, then use Retry.

If delivery is not configured yet, leave WhatsApp rules OFF. CRM capture and internal follow-up management continue to work independently.
