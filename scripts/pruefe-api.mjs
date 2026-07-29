/**
 * Prüft die Fehlerdiagnose der KI gegen feste Testfälle.
 *
 * Voraussetzung: Server läuft (npm run dev) und ANTHROPIC_API_KEY ist gesetzt.
 * Start:  npm run pruefe:api
 * Andere Adresse:  BASE_URL=https://meine-app.vercel.app npm run pruefe:api
 */

import { CASES } from "./testfaelle.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

async function run() {
  console.log(`\nPrüfe ${CASES.length} Testfälle gegen ${BASE_URL}\n`);

  const results = [];
  let gruppe = "";

  for (const testCase of CASES) {
    if (testCase.gruppe !== gruppe) {
      gruppe = testCase.gruppe;
      console.log(`\n--- ${gruppe} ---`);
    }

    let response;
    let body;
    try {
      response = await fetch(`${BASE_URL}/api/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: testCase.task, solution: testCase.solution }),
      });
      body = await response.json();
    } catch (error) {
      console.log(`  FEHL  ${testCase.name}\n        Server nicht erreichbar: ${error.message}`);
      results.push({ ...testCase, ok: false });
      continue;
    }

    let ok;
    let detail;
    if (testCase.http) {
      ok = response.status === testCase.http;
      detail = `HTTP ${response.status} (erwartet ${testCase.http}) — ${body.error ?? ""}`;
    } else {
      ok = response.ok && body.status === testCase.status;
      detail = response.ok
        ? `"${body.status}" (erwartet "${testCase.status}")`
        : `HTTP ${response.status} — ${body.error ?? ""}`;
    }

    console.log(`  ${ok ? " OK " : "FEHL"}  ${testCase.name}\n        ${detail}`);
    if (!ok && body.feedback) {
      console.log(`        KI sagt: ${body.feedback.replace(/\n+/g, " ").slice(0, 220)}`);
    }
    results.push({ ...testCase, ok });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} Testfälle bestanden.`);
  if (failed.length) {
    console.log("\nFehlgeschlagen:");
    for (const f of failed) console.log(`  - [${f.gruppe}] ${f.name}`);
  }
  console.log("");
  process.exit(failed.length ? 1 : 0);
}

run();
