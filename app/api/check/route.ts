import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { TASKS } from "@/lib/tasks";

/** Obergrenze für die Eingabe – ein Bruchrechenweg braucht nie mehr. */
const MAX_LENGTH = 4000;

/**
 * System-Prompt für die Fehleranalyse.
 *
 * Absatz 1 ist die ursprüngliche Tutor-Anweisung.
 * Absatz 2+3 stellen sicher, dass alternative, aber mathematisch korrekte
 * Rechenwege nicht als Fehler gelten.
 * Absatz 4 verhindert Raten, wenn gar kein Rechenweg eingegeben wurde.
 */
const SYSTEM_PROMPT = `Du bist ein geduldiger Mathe-Tutor für Bruchrechnung, Klasse 5-6. Analysiere den eingegebenen Lösungsweg Zeile für Zeile. Wenn alles richtig ist, bestätige das kurz und positiv. Wenn ein Fehler vorhanden ist:
1) Nenne die genaue Zeile/den Schritt, wo der Fehler beginnt.
2) Erkläre in 1-2 einfachen Sätzen, WAS falsch gemacht wurde (z.B. 'Hauptnenner nicht gebildet' oder 'Zähler und Nenner einzeln addiert statt Bruch zu erweitern').
3) Zeige den korrekten nächsten Schritt, ohne die ganze Aufgabe vorzulösen.
Antworte kurz, freundlich, ohne komplizierte Fachsprache.

Bewerte den Rechenweg auf mathematische Korrektheit, nicht auf Übereinstimmung mit einem bestimmten Standardweg. Es gibt oft mehrere richtige Lösungswege (z.B. verschiedene gültige gemeinsame Nenner). Nur wenn ein Schritt mathematisch tatsächlich falsch ist, gilt er als Fehler.

Solange jeder einzelne Schritt mathematisch stimmt, ist der Weg RICHTIG. Das gilt ausdrücklich auch für:
- einen größeren gemeinsamen Nenner als den kleinsten Hauptnenner (z.B. 24 statt 12)
- eine andere Reihenfolge der Schritte oder der Summanden/Faktoren
- Kürzen vor dem Multiplizieren statt danach
- Division als Multiplikation mit dem Kehrbruch, in einem Schritt oder in mehreren
- mehrere Schritte in einer Zeile zusammengefasst oder Zwischenschritte weggelassen
- ein nicht vollständig gekürztes Endergebnis, unechte Brüche und gemischte Zahlen
- abweichende Schreibweisen (z.B. * oder x statt ·, / oder : für geteilt, Leerzeichen)
Wenn das Ergebnis richtig, aber noch kürzbar ist, bestätige den Weg als richtig und erwähne das Kürzen nur als freundlichen Zusatz - es ist kein Fehler.

Wenn der Schüler statt eines Rechenwegs nur das Endergebnis hingeschrieben hat, oder wenn die Eingabe kein Rechenweg zu dieser Aufgabe ist (unverständlicher oder themenfremder Text), dann rate NICHT und bewerte den Rechenweg auch nicht als falsch. Sag in 1-2 freundlichen Sätzen, dass du die Rechenschritte brauchst, und beschreibe, womit der erste Schritt anfangen könnte - ohne die Aufgabe zu lösen.`;

/**
 * Damit die Oberfläche die Rückmeldung farblich einordnen kann, wird die
 * Antwort per Structured Output in "status" + "feedback" aufgeteilt. Die
 * Einordnung steht in den Schema-Beschreibungen, damit der Tutor-Prompt
 * oben unverändert bleibt.
 */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["richtig", "fehler", "hinweis"],
      description:
        "'richtig': Ein Rechenweg ist vorhanden und jeder Schritt ist mathematisch korrekt (auch bei unüblichem, aber gültigem Weg oder noch kürzbarem Ergebnis). " +
        "'fehler': Mindestens ein Schritt ist mathematisch tatsächlich falsch. " +
        "'hinweis': Es ist kein Rechenweg erkennbar - nur das Endergebnis, unverständlicher oder themenfremder Text. In diesem Fall NICHT raten.",
    },
    feedback: {
      type: "string",
      description: "Die Rückmeldung an den Schüler, wie im System-Prompt beschrieben.",
    },
  },
  required: ["status", "feedback"],
  additionalProperties: false,
} as const;

export async function POST(request: Request) {
  // Reihenfolge wichtig: erst die Eingabe prüfen, dann die Konfiguration.
  // So bekommt ungültige Eingabe immer dieselbe Antwort – unabhängig davon,
  // ob ein Key hinterlegt ist.
  let task: unknown;
  let solution: unknown;
  try {
    ({ task, solution } = await request.json());
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  // Leere Eingabe: gar nicht erst zur API schicken.
  if (typeof solution !== "string" || !solution.trim()) {
    return NextResponse.json(
      { error: "Bitte gib zuerst deinen Lösungsweg ein." },
      { status: 400 },
    );
  }

  if (solution.length > MAX_LENGTH) {
    return NextResponse.json(
      {
        error: `Das ist sehr viel Text (${solution.length.toLocaleString("de-DE")} Zeichen, erlaubt sind ${MAX_LENGTH.toLocaleString("de-DE")}). Schreib nur die Rechenschritte zu dieser Aufgabe auf.`,
      },
      { status: 413 },
    );
  }

  // Nur Aufgaben aus der eigenen Liste zulassen.
  if (typeof task !== "string" || !TASKS.some((t) => t.expression === task)) {
    return NextResponse.json({ error: "Unbekannte Aufgabe." }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Es ist kein ANTHROPIC_API_KEY gesetzt. Lege ihn in der Datei .env.local an (bzw. in den Vercel-Umgebungsvariablen).",
      },
      { status: 500 },
    );
  }

  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: RESPONSE_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: `Aufgabe: ${task}\n\nLösungsweg des Schülers:\n${solution}`,
        },
      ],
    });

    if (message.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Die KI konnte diese Eingabe nicht bewerten. Bitte formuliere sie neu." },
        { status: 502 },
      );
    }

    const text = message.content.find((block) => block.type === "text")?.text;
    if (!text) {
      return NextResponse.json(
        { error: "Die KI hat keine Rückmeldung geliefert. Bitte versuche es noch einmal." },
        { status: 502 },
      );
    }

    const parsed = JSON.parse(text) as {
      status: "richtig" | "fehler" | "hinweis";
      feedback: string;
    };
    return NextResponse.json(parsed);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Der ANTHROPIC_API_KEY ist ungültig." },
        { status: 401 },
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut." },
        { status: 429 },
      );
    }
    console.error("Fehler beim Prüfen des Lösungswegs:", error);
    return NextResponse.json(
      { error: "Die Prüfung hat nicht funktioniert. Bitte versuche es noch einmal." },
      { status: 500 },
    );
  }
}
