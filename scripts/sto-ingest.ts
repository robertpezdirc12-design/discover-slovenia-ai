/**
 * STO INGEST CLI — `bun run sto:ingest` (P0-C).
 *
 * Pobere uradni vodnik slovenia.info (7 jezikov, llms.txt vir) in zapiše
 * canonical data/sto-content.json. Javen vir — brez poverilnic.
 *
 * Poročilo se izpiše kot človeško berljiv izpis; izhodni status:
 *  · 0 — vsaj en jezik uspešno ingesciran (datoteka zapisana);
 *  · 1 — vsi jeziki odpovedali (datoteka NI prepisana) ali zapis odpovedal.
 */

import { runStoIngest } from "../src/lib/supply/providers/sto/ingest";

const report = await runStoIngest();

console.log("STO INGEST — slovenia.info llms.txt (uradni vir)");
console.log("=".repeat(60));
for (const lang of report.languages) {
  const mark = lang.ok ? "✓" : "✗";
  console.log(
    `  ${mark} ${lang.language.toUpperCase()}  ${lang.entries} vnosov` +
      (lang.skippedLines > 0 ? ` (${lang.skippedLines} izpuščenih)` : "") +
      (lang.ok ? "" : `  — ${lang.reason}`)
  );
}
console.log("-".repeat(60));
console.log(`  Skupaj: ${report.totalEntries} vnosov · status: ${report.status}`);
if (report.wroteFile) console.log(`  Zapisano: ${report.wroteFile}`);
if (report.writeError) {
  console.log(`  ZAPIS NI USPEL: ${report.writeError}`);
}

process.exit(report.wroteFile ? 0 : 1);
