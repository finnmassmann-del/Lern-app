export type Operation = "Addition" | "Subtraktion" | "Multiplikation" | "Division";

export type Task = {
  id: number;
  /** Die Aufgabe, so wie sie dem Schüler angezeigt wird. */
  expression: string;
  operation: Operation;
};

/** Feste Aufgabenliste (Klasse 5–6). Wird zufällig ausgewählt. */
export const TASKS: Task[] = [
  { id: 1, expression: "2/3 + 1/4", operation: "Addition" },
  { id: 2, expression: "1/2 + 3/8", operation: "Addition" },
  { id: 3, expression: "5/6 + 2/9", operation: "Addition" },
  { id: 4, expression: "3/4 + 1/6", operation: "Addition" },
  { id: 5, expression: "2/5 + 1/3", operation: "Addition" },
  { id: 6, expression: "3/4 - 1/6", operation: "Subtraktion" },
  { id: 7, expression: "5/8 - 1/3", operation: "Subtraktion" },
  { id: 8, expression: "7/10 - 2/5", operation: "Subtraktion" },
  { id: 9, expression: "4/5 - 1/2", operation: "Subtraktion" },
  { id: 10, expression: "5/6 - 3/8", operation: "Subtraktion" },
  { id: 11, expression: "2/3 · 3/5", operation: "Multiplikation" },
  { id: 12, expression: "4/7 · 7/8", operation: "Multiplikation" },
  { id: 13, expression: "3/4 · 2/9", operation: "Multiplikation" },
  { id: 14, expression: "5/6 · 3/10", operation: "Multiplikation" },
  { id: 15, expression: "1/3 · 6/7", operation: "Multiplikation" },
  { id: 16, expression: "3/4 : 2/5", operation: "Division" },
  { id: 17, expression: "5/8 : 1/2", operation: "Division" },
  { id: 18, expression: "2/3 : 4/9", operation: "Division" },
  { id: 19, expression: "7/10 : 7/5", operation: "Division" },
  { id: 20, expression: "9/10 : 3/4", operation: "Division" },
];

/** Zufällige Aufgabe, optional ohne die aktuell angezeigte zu wiederholen. */
export function randomTask(exceptId?: number): Task {
  const pool = exceptId ? TASKS.filter((t) => t.id !== exceptId) : TASKS;
  return pool[Math.floor(Math.random() * pool.length)];
}
