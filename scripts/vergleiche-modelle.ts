/**
 * Modellvergleich: dieselben Testfälle, derselbe System-Prompt, drei Modelle.
 *
 * Ruft die Anthropic-API direkt auf (nicht über die API-Route), damit das
 * Modell pro Lauf gewechselt werden kann, ohne den App-Code anzufassen.
 *
 * Voraussetzung: ANTHROPIC_API_KEY ist gesetzt. Server wird NICHT gebraucht.
 * Start:  npm run vergleiche:modelle
 * Einzelnes Modell:  MODELLE=claude-haiku-4-5 npm run vergleiche:modelle
 */
import Anthropic from "@anthropic-ai/sdk";
import { RESPONSE_SCHEMA, SYSTEM_PROMPT, buildUserMessage } from "../lib/pruefung.ts";
import { CASES } from "./testfaelle.mjs";

type Modell = {
  id: string;
  /** effort wird nur von den neueren Modellen unterstützt. */
  effort?: "low" | "medium" | "high";
  /** Preis in US-Dollar pro 1 Mio. Tokens. */
  preisInput: number;
  preisOutput: number;
  hinweis?: string;
};

const MODELLE: Modell[] = [
  {
    id: "claude-opus-5",
    effort: "high",
    preisInput: 5,
    preisOutput: 25,
    hinweis: "aktuell im Code eingestellt",
  },
  {
    id: "claude-sonnet-5",
    effort: "high",
    preisInput: 2,
    preisOutput: 10,
    hinweis: "Einführungspreis bis 31.08.2026, danach 3 / 15 USD",
  },
  {
    id: "claude-haiku-4-5",
    // effort und adaptives Denken gibt es hier nicht -> ohne, sonst Fehler 400.
    preisInput: 1,
    preisOutput: 5,
    hinweis: "kein effort/Denken möglich",
  },
];

type KiCase = {
  gruppe: string;
  name: string;
  task: string;
  solution: string;
  status: string;
};

/** Nur die Fälle, bei denen die KI antwortet (HTTP-Fälle sind Routen-Logik). */
const KI_CASES = (CASES as (KiCase & { http?: number })[]).filter(
  (c): c is KiCase => !c.http,
);

const client = new Anthropic();

type Ergebnis = {
  modell: string;
  bestanden: number;
  gesamt: number;
  inputTokens: number;
  outputTokens: number;
  kostenProAnfrage: number;
  dauerMs: number;
  fehlgeschlagen: { name: string; erwartet: string; bekommen: string; feedback: string }[];
  fehler: string[];
};

async function pruefeModell(modell: Modell): Promise<Ergebnis> {
  console.log(`\n=== ${modell.id} ===`);
  const ergebnis: Ergebnis = {
    modell: modell.id,
    bestanden: 0,
    gesamt: KI_CASES.length,
    inputTokens: 0,
    outputTokens: 0,
    kostenProAnfrage: 0,
    dauerMs: 0,
    fehlgeschlagen: [],
    fehler: [],
  };

  const start = Date.now();
  for (const testCase of KI_CASES) {
    try {
      const message = await client.messages.create({
        model: modell.id,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        output_config: {
          ...(modell.effort ? { effort: modell.effort } : {}),
          format: { type: "json_schema", schema: RESPONSE_SCHEMA },
        },
        messages: [{ role: "user", content: buildUserMessage(testCase.task, testCase.solution) }],
      });

      ergebnis.inputTokens += message.usage.input_tokens;
      ergebnis.outputTokens += message.usage.output_tokens;

      if (message.stop_reason === "refusal") {
        ergebnis.fehler.push(`${testCase.name}: von der KI abgelehnt`);
        continue;
      }

      const text = message.content.find((b) => b.type === "text")?.text ?? "";
      const parsed = JSON.parse(text) as { status: string; feedback: string };
      const ok = parsed.status === testCase.status;
      if (ok) {
        ergebnis.bestanden++;
      } else {
        ergebnis.fehlgeschlagen.push({
          name: testCase.name,
          erwartet: testCase.status,
          bekommen: parsed.status,
          feedback: parsed.feedback,
        });
      }
      console.log(`  ${ok ? " OK " : "FEHL"}  ${testCase.name} -> "${parsed.status}"`);
    } catch (error) {
      const nachricht = error instanceof Error ? error.message : String(error);
      ergebnis.fehler.push(`${testCase.name}: ${nachricht}`);
      console.log(`  FEHL  ${testCase.name} -> Fehler: ${nachricht.slice(0, 140)}`);
    }
  }
  ergebnis.dauerMs = Date.now() - start;

  const n = KI_CASES.length;
  ergebnis.kostenProAnfrage =
    (ergebnis.inputTokens / n / 1_000_000) * modell.preisInput +
    (ergebnis.outputTokens / n / 1_000_000) * modell.preisOutput;

  return ergebnis;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "\nANTHROPIC_API_KEY ist nicht gesetzt. Beispiel:\n  ANTHROPIC_API_KEY=sk-ant-... npm run vergleiche:modelle\n",
    );
    process.exit(1);
  }

  const auswahl = process.env.MODELLE?.split(",").map((m) => m.trim());
  const zuTesten = auswahl ? MODELLE.filter((m) => auswahl.includes(m.id)) : MODELLE;

  console.log(`\n${KI_CASES.length} Testfälle × ${zuTesten.length} Modelle`);

  const ergebnisse: Ergebnis[] = [];
  for (const modell of zuTesten) ergebnisse.push(await pruefeModell(modell));

  console.log("\n\n================ VERGLEICH ================\n");
  console.log(
    "| Modell | bestanden | ø Input-Tok. | ø Output-Tok. | Kosten/Anfrage | ø Dauer |",
  );
  console.log("|---|---|---|---|---|---|");
  for (const e of ergebnisse) {
    const n = e.gesamt;
    console.log(
      `| ${e.modell} | ${e.bestanden}/${n} | ${Math.round(e.inputTokens / n)} | ${Math.round(
        e.outputTokens / n,
      )} | ${e.kostenProAnfrage < 0.01 ? `${(e.kostenProAnfrage * 100).toFixed(2)} ct` : `$${e.kostenProAnfrage.toFixed(4)}`} | ${(e.dauerMs / n / 1000).toFixed(1)} s |`,
    );
  }

  for (const e of ergebnisse) {
    if (!e.fehlgeschlagen.length && !e.fehler.length) continue;
    console.log(`\n--- ${e.modell}: Abweichungen ---`);
    for (const f of e.fehlgeschlagen) {
      console.log(`  ${f.name}\n    erwartet "${f.erwartet}", bekommen "${f.bekommen}"`);
      console.log(`    KI: ${f.feedback.replace(/\n+/g, " ").slice(0, 200)}`);
    }
    for (const f of e.fehler) console.log(`  ${f}`);
  }

  console.log("\nHinweise zur Vergleichbarkeit:");
  for (const m of zuTesten) if (m.hinweis) console.log(`  - ${m.id}: ${m.hinweis}`);
  console.log("");
}

main();
