"use client";

import { useState } from "react";
import { randomTask, type Task } from "@/lib/tasks";

type Result = { status: "richtig" | "fehler"; feedback: string };

export default function Trainer({ initialTask }: { initialTask: Task }) {
  const [task, setTask] = useState<Task>(initialTask);
  const [solution, setSolution] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function newTask() {
    setTask(randomTask(task.id));
    setSolution("");
    setResult(null);
    setError(null);
  }

  async function checkSolution() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: task.expression, solution }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Etwas ist schiefgelaufen.");
      } else {
        setResult(data as Result);
      }
    } catch {
      setError("Keine Verbindung zum Server. Bitte versuche es noch einmal.");
    } finally {
      setLoading(false);
    }
  }

  const isCorrect = result?.status === "richtig";

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-10 sm:py-16">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Bruchrechnen üben</h1>
        <p className="mt-1 text-sm text-slate-500">
          Schreib deinen Lösungsweg Schritt für Schritt auf – du bekommst Rückmeldung dazu,
          wo es hakt.
        </p>
      </header>

      {/* Aufgabe */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {task.operation}
          </span>
          <button
            type="button"
            onClick={newTask}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Neue Aufgabe
          </button>
        </div>
        <p className="mt-3 text-sm text-slate-500">Berechne</p>
        <p className="mt-1 font-mono text-3xl font-semibold sm:text-4xl">{task.expression}</p>
      </section>

      {/* Eingabe */}
      <section className="flex flex-col gap-3">
        <label htmlFor="solution" className="text-sm font-medium text-slate-700">
          Dein Lösungsweg
        </label>
        <textarea
          id="solution"
          value={solution}
          onChange={(event) => setSolution(event.target.value)}
          rows={8}
          spellCheck={false}
          placeholder={"z. B.\n2/3 + 1/4\n= 8/12 + 3/12\n= 11/12"}
          className="w-full resize-y rounded-2xl border border-slate-200 bg-white p-4 font-mono text-base leading-relaxed shadow-sm outline-none transition placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={checkSolution}
            disabled={loading || !solution.trim()}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? "Wird geprüft …" : "Lösungsweg prüfen"}
          </button>
          {loading && (
            <span className="text-sm text-slate-500">Der Tutor schaut sich deine Schritte an …</span>
          )}
        </div>
      </section>

      {/* Ergebnis */}
      {error && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {error}
        </section>
      )}

      {result && (
        <section
          className={[
            "rounded-2xl border p-5 shadow-sm",
            isCorrect
              ? "border-emerald-300 bg-emerald-50"
              : "border-amber-300 bg-amber-50",
          ].join(" ")}
        >
          <h2
            className={[
              "flex items-center gap-2 text-sm font-semibold uppercase tracking-wider",
              isCorrect ? "text-emerald-800" : "text-amber-800",
            ].join(" ")}
          >
            <span aria-hidden="true">{isCorrect ? "✓" : "!"}</span>
            {isCorrect ? "Alles richtig" : "Da ist ein Fehler"}
          </h2>
          <p
            className={[
              "mt-3 whitespace-pre-wrap text-[15px] leading-relaxed",
              isCorrect ? "text-emerald-900" : "text-amber-900",
            ].join(" ")}
          >
            {result.feedback}
          </p>
          <button
            type="button"
            onClick={newTask}
            className={[
              "mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white transition",
              isCorrect
                ? "bg-emerald-700 hover:bg-emerald-600"
                : "bg-amber-700 hover:bg-amber-600",
            ].join(" ")}
          >
            Neue Aufgabe
          </button>
        </section>
      )}
    </main>
  );
}
