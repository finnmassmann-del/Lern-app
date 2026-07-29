import { randomTask } from "@/lib/tasks";
import Trainer from "./trainer";

// Bei jedem Aufruf soll eine neue Aufgabe gezogen werden.
export const dynamic = "force-dynamic";

export default function Page() {
  return <Trainer initialTask={randomTask()} />;
}
