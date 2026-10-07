/**
 * ACTIVATION-CHECK CLI — tanek izpis matrike aktivacij (P0-B).
 *
 * Zagon: bun run activation:check
 *
 * Edino mesto, kjer lib prebere process.env — vrednosti se NE izpišejo
 * (Boolean-only kanon; kanarček v tests/supply-activation.test.ts).
 * Izhodna koda je VEDNO 0: to je iskren statusni pogled, ne vrata.
 */

import { checkAllProviders, PRODUCTION_STATE_LABELS } from "../src/lib/supply/activation-check";

const report = checkAllProviders(process.env);

/** Simbol stanja za terminal. */
const SYM: Record<string, string> = {
  ACTIVE: "🟢",
  CONFIGURED: "🔵",
  NOT_CONFIGURED: "⚪",
  BLOCKED: "🔴",
};

const širinaId = Math.max(...report.rows.map((r) => r.id.length));
const širinaIme = Math.max(...report.rows.map((r) => r.name.length));

console.log(
  "PRODUCTION ACTIVATION STATUS — Discover-Slovenia-AI (rekonstrukcija 2.x)"
);
console.log(
  "Vir resnice: src/lib/supply/production-matrix.ts (mehanska izpeljeka, nikoli ročno)"
);
console.log("");

for (const r of report.rows) {
  console.log(
    `${SYM[r.state]} ${r.id.padEnd(širinaId)}  ${r.name.padEnd(širinaIme)}  ${PRODUCTION_STATE_LABELS[r.state].sl}`
  );
  const envInfo = Object.entries(r.envPresent)
    .map(([k, v]) => `${k}: ${v ? "nastavljen" : "manjka"}`)
    .join(", ");
  if (envInfo) console.log(`   ↳ env: ${envInfo}`);
  console.log(`   ↳ ${r.reasonSl}`);
  if (r.stepsSl.length > 0) {
    r.stepsSl.forEach((s, i) => console.log(`     ${i + 1}. ${s}`));
  }
  console.log("");
}

console.log(
  `SKUPAJ: ${report.rows.length} ponudnikov — ` +
    `🟢 ${report.counts.ACTIVE} dejansko živih · ` +
    `🔵 ${report.counts.CONFIGURED} konfiguriranih · ` +
    `⚪ ${report.counts.NOT_CONFIGURED} nekonfiguriranih · ` +
    `🔴 ${report.counts.BLOCKED} zunanjih ovir`
);
