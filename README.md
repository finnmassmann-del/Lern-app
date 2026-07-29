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

Der Aufgaben-Pool lässt sich einfach in `lib/tasks.ts` erweitern — einfach weitere
Einträge mit fortlaufender `id` ergänzen.

## Hinweise zur Umsetzung

- Der API-Key wird **ausschließlich serverseitig** in der API-Route verwendet und
  erreicht den Browser nie.
- Der vorgegebene System-Prompt steht unverändert in `app/api/check/route.ts`.
  Damit die App zuverlässig zwischen grün und gelb unterscheiden kann, wird die
  Antwort per *Structured Output* (auf API-Ebene, nicht über den Prompt) in
  `status` + `feedback` aufgeteilt.
- Modell: `claude-opus-5`.

Bewusst nicht enthalten: Login, Datenbank, Fortschrittsspeicherung, Gamification,
Offline-Modus, andere Fächer, Handschrifterkennung.
