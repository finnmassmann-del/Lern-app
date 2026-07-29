import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

/** Vorgegebener System-Prompt – wird unverändert an die API geschickt. */
const SYSTEM_PROMPT = `Du bist ein geduldiger Mathe-Tutor für Bruchrechnung, Klasse 5-6. Analysiere den eingegebenen Lösungsweg Zeile für Zeile. Wenn alles richtig ist, bestätige das kurz und positiv. Wenn ein Fehler vorhanden ist:
1) Nenne die genaue Zeile/den Schritt, wo der Fehler beginnt.
2) Erkläre in 1-2 einfachen Sätzen, WAS falsch gemacht wurde (z.B. 'Hauptnenner nicht gebildet' oder 'Zähler und Nenner einzeln addiert statt Bruch zu erweitern').
3) Zeige den korrekten nächsten Schritt, ohne die ganze Aufgabe vorzulösen.
Antworte kurz, freundlich, ohne komplizierte Fachsprache.`;

/**
 * Damit die Oberfläche farblich unterscheiden kann (grün = richtig,
 * gelb = Fehler gefunden), lässt sich die Antwort per Structured Output
 * in "status" + "feedback" aufteilen. Der System-Prompt bleibt dadurch
 * unverändert – das Format wird auf API-Ebene erzwungen.
 */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["richtig", "fehler"],
      description:
        "'richtig', wenn der komplette Lösungsweg korrekt ist, sonst 'fehler'.",
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
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Es ist kein ANTHROPIC_API_KEY gesetzt. Lege ihn in der Datei .env.local an (bzw. in den Vercel-Umgebungsvariablen).",
      },
      { status: 500 },
    );
  }

  let task: unknown;
  let solution: unknown;
  try {
    ({ task, solution } = await request.json());
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  if (typeof task !== "string" || typeof solution !== "string" || !solution.trim()) {
    return NextResponse.json(
      { error: "Bitte gib zuerst deinen Lösungsweg ein." },
      { status: 400 },
    );
  }

  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      output_config: {
        effort: "medium",
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

    const parsed = JSON.parse(text) as { status: "richtig" | "fehler"; feedback: string };
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
