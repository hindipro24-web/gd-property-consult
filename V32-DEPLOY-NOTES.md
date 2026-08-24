# Admin V32 — Sales Manager OS

## Included

- premium navy sales command-center visual system
- live rule controls, agent workload and outbound job log
- lead owner, follow-up deadline and next-action fields
- balanced assignment and default 15-minute response SLA
- secure Supabase automation queue with retry protection
- n8n workflow for agent email and Meta WhatsApp templates

## Release order

1. Deploy the frontend files to GitHub Pages.
2. Run `backend/admin-v32-sales-automation.sql` in Supabase SQL Editor.
3. Import and configure `n8n/gd-property-v32-sales-automation.json`.
4. Test email first. Keep WhatsApp rules OFF until Meta templates are approved.

The frontend remains usable before steps 2–3: it shows a setup notice and does not expose provider secrets.

## Required QA

- mobile menu at 360–430 px and desktop at 1366 px
- login, Overview, CRM workspace and Lead 360 modal
- new lead auto-assignment and 15-minute follow-up
- email queue: queued → processing → sent
- WhatsApp template with a consented test number
- VISIT BOOKED creates only one confirmation job
- failed delivery retry and five-attempt cutoff

## Rollback

Frontend rollback: revert the V32 Git commit and push `main`. The SQL migration is additive, so it does not need immediate rollback; leave automation rules disabled. Do not drop queue tables while n8n is active.

## Client-facing note

“The admin workspace has been upgraded to a Sales Manager OS with clearer daily priorities, lead ownership, follow-up deadlines and a monitored communication queue. WhatsApp and email automation will be activated after provider credentials and approved message templates are verified.”
