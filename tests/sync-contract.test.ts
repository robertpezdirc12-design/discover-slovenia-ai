/**
 * SYNC-CONTRACT — varovalka kvote dvosmerne sinhronizacije (GitLab zrcalo).
 *
 * SOURCE-CONTRACT (pošteno označeno, isti kanon kot cron-ops-contract):
 * run #13 (2026-10-09) je dokazal, da potekel/preklican GITLAB_TOKEN
 * povzroči ~9 min kurjenja Actions kvote na vsakem prožilcu (5 min retryjev
 * na branchih + 4 min lint-test) pri 0 opravljenega dela — 4 urniki/dan
 * ≈ 35 min/dan zasebnega repa (meja 2000 min/mes). Če kdo odstrani
 * fail-fast varovalko, tihi padec fetcha ali pogojeni lint-test, ta
 * regresijska mreža pade.
 */

import { describe, expect, test } from "bun:test";

async function src(path: string): Promise<string> {
  return Bun.file(path).text();
}

describe("sync [source-contract]: varovalka žetona varčuje s kvoto", () => {
  test("① gate korak preveri žeton prek GitLab API PRED checkoutom (fail-fast)", async () => {
    const wf = await src(".github/workflows/sync.yml");
    expect(wf).toContain("Varovalka GitLab žetona");
    // žeton potuje SAMO v glavi (PRIVATE-TOKEN), nikoli v URL-ju:
    expect(wf).toContain("--header \"PRIVATE-TOKEN: ${GITLAB_TOKEN}\"");
    expect(wf).not.toMatch(/PRIVATE-TOKEN=\$/);
    // gate je PRVI korak — pred checkoutom (sicer kurimo checkout zaman):
    expect(wf.indexOf("Varovalka GitLab žetona")).toBeLessThan(
      wf.indexOf("uses: actions/checkout@v4")
    );
  });

  test("② neveljaven žeton (401/403) → zelen preskok z opozorilom, ne rdečina", async () => {
    const wf = await src(".github/workflows/sync.yml");
    expect(wf).toContain("401|403");
    expect(wf).toMatch(/::warning::GitLab žeton ZAVRNJEN/);
    // preskok ne sme biti napaka (exit 1) — vzorec prod-cron health gate:
    expect(wf).toContain("mirror_ok=false");
  });

  test("③ tihi padec fetcha je zaprt (for-each-ref preverba po 3 poskusih)", async () => {
    const wf = await src(".github/workflows/sync.yml");
    // bug iz runa #13: zanka brez preverbe je ob 3 padlih fetcheh stekla
    // naprej s PRAZNIM refs/remotes/gitlab/* → vsi branchi napačno
    // „samo na GitHub" + 5 min retry pushov.
    expect(wf).toContain("for-each-ref --format='%(refname)' refs/remotes/gitlab/");
    expect(wf).toContain("fetch_ok=false");
    expect(wf).toContain("fetch_ok=true");
  });

  test("③b prazno zrcalo (bootstrap) NI napaka fetcha — FETCH_OK loči ukaz od refsov (run 38053506635)", async () => {
    const wf = await src(".github/workflows/sync.yml");
    // bug iz runa 38053506635 (2026-10-10): nov PRAZEN GitLab projekt je fetch
    // uspel, a refs/remotes/gitlab/* prazen → stara preverba je preskočila
    // vse push korake in zrcalo se NIKOLI ni moglo prvič napolniti.
    expect(wf).toContain("FETCH_OK=1");
    expect(wf).toContain('if [ "$FETCH_OK" != "1" ]; then');
    expect(wf).toContain("GitLab zrcalo PRAZNO (bootstrap)");
  });

  test("④ lint-test teče SAMO ko je zrcalo dejansko obravnavano (mirror_ok izhod)", async () => {
    const wf = await src(".github/workflows/sync.yml");
    expect(wf).toContain("mirror_ok: ${{ steps.sklep.outputs.mirror_ok }}");
    expect(wf).toContain("needs.sync.outputs.mirror_ok == 'true'");
  });

  test("⑤ neuspešen push brancha je izrecno opozorjen (števec push_failed)", async () => {
    const wf = await src(".github/workflows/sync.yml");
    expect(wf).toContain("PUSH_FAILED=$((PUSH_FAILED + 1))");
    expect(wf).toContain("push_failed=");
    expect(wf).toMatch(/::warning::Sinhronizacija DELNO uspela/);
  });
});
