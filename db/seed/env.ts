import { config } from "dotenv";

// Seed scripts run standalone via tsx (npm run db:*), not through Next.js, so .env.local isn't
// loaded automatically the way it is for `next dev`/`next build` -- load it explicitly.
config({ path: ".env.local" });