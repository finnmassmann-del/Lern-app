/**
 * Prüft die Fehlerdiagnose der KI gegen feste Testfälle.
 *
 * Voraussetzung: Server läuft (npm run dev) und ANTHROPIC_API_KEY ist gesetzt.
 * Start:  npm run pruefe:api
 * Andere Adresse:  BASE_URL=https://meine-app.vercel.app npm run pruefe:api
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

/**
 * status  = erwartete Einordnung der KI ("richtig" | "fehler" | "hinweis")
 * http    = erwarteter HTTP-Status, wenn die Anfrage gar nicht zur KI soll
 */
const CASES = [
  // ---- Punkt 2: andere, aber mathematisch korrekte Rechenwege -> "richtig" ----
  {
    gruppe: "Alternative richtige Wege",
    name: "größerer gemeinsamer Nenner (24 statt 12)",
    task: "2/3 + 1/4",
    solution: "2/3 + 1/4\n= 16/24 + 6/24\n= 22/24\n= 11/12",
    status: "richtig",
  },
  {
    gruppe: "Alternative richtige Wege",
    name: "Produkt der Nenner als Nenner, Ergebnis nicht gekürzt",
    task: "3/4 - 1/6",
    solution: "3/4 - 1/6\n= 18/24 - 4/24\n= 14/24",
    status: "richtig",
  },
  {
    gruppe: "Alternative richtige Wege",
    name: "Summanden vertauscht (andere Reihenfolge)",
    task: "2/5 + 1/3",
    solution: "1/3 + 2/5\n= 5/15 + 6/15\n= 11/15",
    status: "richtig",
  },
  {
    gruppe: "Alternative richtige Wege",
    name: "Division in einem Schritt per Kehrbruch, unechter Bruch",
    task: "3/4 : 2/5",
    solution: "3/4 : 2/5 = 3/4 · 5/2 = 15/8",
    status: "richtig",
  },
  {
    gruppe: "Alternative richtige Wege",
    name: "vor dem Multiplizieren gekürzt, Zwischenschritt weggelassen",
    task: "2/3 · 3/5",
    solution: "2/3 · 3/5 = 2/5",
    status: "richtig",
  },
  {
    gruppe: "Alternative richtige Wege",
    name: "abweichende Schreibweise (* statt ·) und gemischte Zahl",
    task: "5/8 : 1/2",
    solution: "5/8 : 1/2 = 5/8 * 2/1 = 10/8 = 1 1/4",
    status: "richtig",
  },

  // ---- Gegenprobe: echte Fehler müssen weiterhin erkannt werden ----
  {
    gruppe: "Echte Fehler (Gegenprobe)",
    name: "Zähler und Nenner einzeln addiert",
    task: "2/3 + 1/4",
    solution: "2/3 + 1/4\n= 3/7",
    status: "fehler",
  },
  {
    gruppe: "Echte Fehler (Gegenprobe)",
    name: "bei Division nicht mit Kehrbruch multipliziert",
    task: "3/4 : 2/5",
    solution: "3/4 : 2/5\n= 3/4 · 2/5\n= 6/20\n= 3/10",
    status: "fehler",
  },
  {
    gruppe: "Echte Fehler (Gegenprobe)",
    name: "nur ein Bruch erweitert, der andere nicht",
    task: "3/4 + 1/6",
    solution: "3/4 + 1/6\n= 9/12 + 1/6\n= 10/12",
    status: "fehler",
  },
  {
    gruppe: "Echte Fehler (Gegenprobe)",
    name: "richtiger Weg, aber im letzten Schritt verrechnet",
    task: "5/6 - 3/8",
    solution: "5/6 - 3/8\n= 20/24 - 9/24\n= 12/24",
    status: "fehler",
  },

  // ---- Punkt 3: Edge Cases ----
  {
    gruppe: "Edge Cases",
    name: "nur das Endergebnis ohne Rechenweg",
    task: "2/3 + 1/4",
    solution: "11/12",
    status: "hinweis",
  },
  {
    gruppe: "Edge Cases",
    name: "nur das Endergebnis, und zwar ein falsches",
    task: "2/3 + 1/4",
    solution: "3/7",
    status: "hinweis",
  },
  {
    gruppe: "Edge Cases",
    name: "unsinniger Text",
    task: "2/3 + 1/4",
    solution: "keine ahnung lol asdf",
    status: "hinweis",
  },
  {
    gruppe: "Edge Cases",
    name: "themenfremder Text",
    task: "2/3 + 1/4",
    solution: "Mein Hamster heißt Bruno und schläft den ganzen Tag.",
    status: "hinweis",
  },
  {
    gruppe: "Edge Cases",
    name: "langer, aber gültiger Rechenweg (viele Zwischenschritte)",
    task: "2/3 + 1/4",
    solution:
      "Ich rechne das jetzt ganz ausführlich auf.\n" +
      Array.from(
        { length: 40 },
        (_, i) => `Überlegung ${i + 1}: Ich brauche einen gemeinsamen Nenner für 3 und 4.`,
      ).join("\n") +
      "\n2/3 = 8/12\n1/4 = 3/12\n8/12 + 3/12 = 11/12",
    status: "richtig",
  },

  // ---- Punkt 3: Anfragen, die gar nicht zur KI gehen sollen ----
  {
    gruppe: "Ohne API-Aufruf abgefangen",
    name: "leere Eingabe",
    task: "2/3 + 1/4",
    solution: "",
    http: 400,
  },
  {
    gruppe: "Ohne API-Aufruf abgefangen",
    name: "nur Leerzeichen und Zeilenumbrüche",
    task: "2/3 + 1/4",
    solution: "   \n\n  \t ",
    http: 400,
  },
  {
    gruppe: "Ohne API-Aufruf abgefangen",
    name: "Text über der Längengrenze (4000 Zeichen)",
    task: "2/3 + 1/4",
    solution: "2/3 + 1/4 = 8/12 + 3/12 = 11/12\n".repeat(200),
    http: 413,
  },
  {
    gruppe: "Ohne API-Aufruf abgefangen",
    name: "Aufgabe nicht aus der eigenen Liste",
    task: "1/0 + 5/5",
    solution: "1/0 + 5/5 = 6/5",
    http: 400,
  },
];

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
