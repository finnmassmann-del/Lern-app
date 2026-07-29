# Bruchrechnen üben — KI-Lerntool (Klasse 5–6)

Eine kleine Next.js-App: Der Schüler bekommt eine zufällige Bruchrechenaufgabe,
tippt seinen **Lösungsweg Schritt für Schritt** in ein Textfeld, und die Claude-API
sagt ihm, **wo** der Fehler beginnt und **was** falsch gemacht wurde — ohne die
Aufgabe komplett vorzulösen.

- Grüne Box = alles richtig
- Gelbe Box = Fehler gefunden, mit Erklärung und dem korrekten nächsten Schritt

## Lokal starten

**1. Abhängigkeiten installieren** (Node.js 20 oder neuer):

```bash
npm install
```

**2. API-Key eintragen.** Erstelle im Projektordner eine Datei `.env.local`:

```bash
cp .env.example .env.local
```

und trage darin deinen Key ein (zu holen unter
<https://console.anthropic.com/settings/keys>):

```
ANTHROPIC_API_KEY=sk-ant-...
```

`.env.local` steht in `.gitignore` und landet damit nicht im Repository.

**3. Entwicklungsserver starten:**

```bash
npm run dev
```

Dann <http://localhost:3000> im Browser öffnen. Fertig.

## Prüfen

Zwei Skripte, damit die Fehlerdiagnose nachvollziehbar bleibt:

```bash
npm run pruefe:aufgaben   # Aufgabenliste + "Neue Aufgabe"-Logik (braucht keinen Key)
npm run pruefe:api        # KI-Bewertung gegen feste Testfälle (Server + Key nötig)
```

`pruefe:api` erwartet einen laufenden Server (`npm run dev` in einem zweiten
Terminal) und prüft 20 Fälle: alternative, aber korrekte Rechenwege dürfen nicht
als Fehler gelten; echte Fehler müssen weiterhin auffallen; fehlender Rechenweg
und Unsinn dürfen nicht geraten werden. Gegen eine deployte Version:

```bash
BASE_URL=https://meine-app.vercel.app npm run pruefe:api
```

## Auf Vercel deployen

**1. Code auf GitHub pushen** (falls noch nicht passiert):

```bash
git push -u origin <branch-name>
```

**2. Projekt in Vercel importieren:** Auf <https://vercel.com/new> das GitHub-Repository
auswählen. Vercel erkennt Next.js automatisch — Build Command und Output Directory
müssen nicht angepasst werden.

**3. Den API-Key als Umgebungsvariable hinterlegen — das ist der wichtige Schritt.**
Noch im Import-Dialog (oder später unter *Project → Settings → Environment Variables*):

| Name | Value | Environments |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Production, Preview, Development |

**4. Auf „Deploy“ klicken.** Nach etwa einer Minute ist die App unter
`https://<projektname>.vercel.app` erreichbar.

> Wenn du den Key erst **nach** dem ersten Deployment hinzufügst, musst du einmal neu
> deployen (*Deployments → … → Redeploy*), damit er greift. Ohne Key zeigt die App
> einen entsprechenden Hinweis statt einer Rückmeldung an.

Alternativ per CLI: `npm i -g vercel`, dann `vercel` (Preview) bzw. `vercel --prod`.
Den Key setzt du dabei mit `vercel env add ANTHROPIC_API_KEY`.

## Was wo liegt

| Datei | Inhalt |
| --- | --- |
| `lib/tasks.ts` | Die 20 Bruchrechenaufgaben als Array + Zufallsauswahl |
| `app/page.tsx` | Zieht beim Aufruf eine zufällige Aufgabe |
| `app/trainer.tsx` | Oberfläche: Aufgabe, Eingabefeld, Ergebnisanzeige, „Neue Aufgabe“ |
| `app/api/check/route.ts` | API-Route: ruft Claude mit dem Tutor-System-Prompt auf |
| `scripts/pruefe-aufgaben.ts` | Prüft Aufgabenliste und „Neue Aufgabe“-Logik |
| `scripts/pruefe-api.mjs` | Prüft die KI-Bewertung gegen feste Testfälle |

Der Aufgaben-Pool lässt sich einfach in `lib/tasks.ts` erweitern — einfach weitere
Einträge mit fortlaufender `id` ergänzen.

## Hinweise zur Umsetzung

- Der API-Key wird **ausschließlich serverseitig** in der API-Route verwendet und
  erreicht den Browser nie.
- Der System-Prompt in `app/api/check/route.ts` sagt ausdrücklich, dass auf
  **mathematische Korrektheit** geprüft wird und nicht auf Übereinstimmung mit
  einem Standardweg. Ein größerer gemeinsamer Nenner, eine andere Reihenfolge
  oder ein noch kürzbares Ergebnis sind kein Fehler.
- Die Antwort wird per *Structured Output* (auf API-Ebene, nicht über den Prompt)
  in `status` + `feedback` aufgeteilt. Drei Zustände:
  `richtig` (grün), `fehler` (gelb) und `hinweis` (blau, wenn kein Rechenweg
  erkennbar ist — dann wird nicht geraten).
- Eingaben werden vor dem API-Aufruf geprüft: leer, zu lang (max. 4000 Zeichen)
  oder unbekannte Aufgabe kosten keinen API-Aufruf.
- Modell: `claude-opus-5`, `effort: high` (die Bewertung von Rechenwegen ist der
  Teil, bei dem Genauigkeit zählt).

Bewusst nicht enthalten: Login, Datenbank, Fortschrittsspeicherung, Gamification,
Offline-Modus, andere Fächer, Handschrifterkennung.
