# VYRA Entry Scanner

Standalone scanner. It reads a QR containing a Pass ID such as `PASS-E519BB18`, calls Supabase, and marks the pass as checked in.

1. `npm install`
2. Copy `.env.example` to `.env`
3. Put your Supabase anon key in `.env`
4. Run `supabase/approve_pass.sql` in Supabase SQL Editor
5. `npm run dev`
6. For Vercel: `npm run build`, add the two VITE environment variables, deploy.

Production camera scanning requires HTTPS; Vercel provides HTTPS.
