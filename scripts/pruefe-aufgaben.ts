/**
 * Prüft die Aufgabenliste und die "Neue Aufgabe"-Logik.
 * Läuft ohne API-Key:  npm run pruefe:aufgaben
 */
import { TASKS, randomTask, type Operation } from "../lib/tasks.ts";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  OK  " : " FEHL "} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

console.log("\n=== 1. Aufgabenliste ===\n");

check("mindestens 15 Aufgaben", TASKS.length >= 15, `${TASKS.length} Aufgaben`);

const OPERATIONS: Operation[] = ["Addition", "Subtraktion", "Multiplikation", "Division"];
for (const op of OPERATIONS) {
  const n = TASKS.filter((t) => t.operation === op).length;
  check(`${op}: mindestens 4 Aufgaben`, n >= 4, `${n} Aufgaben`);
}

const ids = TASKS.map((t) => t.id);
check("IDs sind eindeutig", new Set(ids).size === ids.length);

const expressions = TASKS.map((t) => t.expression);
check("keine doppelten Aufgaben", new Set(expressions).size === expressions.length);

// Jede Aufgabe muss zum angegebenen Rechenzeichen passen.
const SIGNS: Record<Operation, string> = {
  Addition: "+",
  Subtraktion: "-",
  Multiplikation: "·",
  Division: ":",
};
const mismatched = TASKS.filter((t) => !t.expression.includes(SIGNS[t.operation]));
check(
  "Rechenzeichen passt zur Kategorie",
  mismatched.length === 0,
  mismatched.map((t) => `${t.id}: ${t.expression}`).join(", "),
);

// Jede Aufgabe muss aus zwei echten Brüchen bestehen.
const badShape = TASKS.filter((t) => !/^\d+\/\d+ [+\-·:] \d+\/\d+$/.test(t.expression));
check(
  "Format 'a/b ZEICHEN c/d'",
  badShape.length === 0,
  badShape.map((t) => t.expression).join(", "),
);

console.log("\n=== 2. 'Neue Aufgabe' liefert nie dieselbe Aufgabe ===\n");

const RUNS = 200_000;
let repeats = 0;
const drawn = new Map<number, number>();
for (let i = 0; i < RUNS; i++) {
  const current = TASKS[i % TASKS.length];
  const next = randomTask(current.id);
  if (next.id === current.id) repeats++;
  drawn.set(next.id, (drawn.get(next.id) ?? 0) + 1);
}
check(`kein Selbst-Treffer in ${RUNS.toLocaleString("de-DE")} Ziehungen`, repeats === 0, `${repeats} Wiederholungen`);
check("alle Aufgaben erreichbar", drawn.size === TASKS.length, `${drawn.size}/${TASKS.length}`);

// Grobe Gleichverteilung: keine Aufgabe darf extrem selten/häufig kommen.
const counts = [...drawn.values()];
const erwartet = RUNS / TASKS.length;
const abweichung = Math.max(...counts.map((c) => Math.abs(c - erwartet) / erwartet));
check("Verteilung gleichmäßig (<10 % Abweichung)", abweichung < 0.1, `max. ${(abweichung * 100).toFixed(1)} %`);

// Ohne Ausschluss muss jede Aufgabe ziehbar sein (Startbildschirm).
const ohneAusschluss = new Set<number>();
for (let i = 0; i < 20_000; i++) ohneAusschluss.add(randomTask().id);
check("Startbildschirm kann jede Aufgabe ziehen", ohneAusschluss.size === TASKS.length);

console.log(
  failed === 0
    ? "\nAlle Prüfungen bestanden.\n"
    : `\n${failed} Prüfung(en) fehlgeschlagen.\n`,
);
process.exit(failed === 0 ? 0 : 1);
