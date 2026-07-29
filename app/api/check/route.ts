import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { TASKS } from "@/lib/tasks";
import {
  MAX_LENGTH,
  RESPONSE_SCHEMA,
  SYSTEM_PROMPT,
  buildUserMessage,
} from "@/lib/pruefung";

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
          content: buildUserMessage(task, solution),
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
