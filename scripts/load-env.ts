/**
 * Side-effect-modul som laster .env.local FØR andre moduler evalueres.
 *
 * MÅ stå som FØRSTE import i tsx-scripts som (direkte eller transitivt)
 * trekker inn `lib/supabase/client.ts`: tsx hoister statiske imports over
 * et inline `config()`-kall, så mønsteret «import config; config(); import
 * resten» evaluerer client.ts UTEN env — og den modul-nivå anon-klienten
 * (`export const supabase`) blir null for hele prosessens levetid
 * (modul-cache). Alt som bygger på den (f.eks. `lib/supabase/queries.ts` →
 * `getProductFromSupabase`) returnerer da stille null — selv ved senere
 * dynamisk import, siden client.ts allerede er evaluert.
 *
 * ESM garanterer at imports evalueres i rekkefølge, så
 * `import "./load-env";` øverst kjører dotenv før alt annet.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
