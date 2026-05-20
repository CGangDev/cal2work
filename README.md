# Calendar Export

A browser-based tool for reviewing Apple Calendar events and exporting a curated selection to an Outlook-compatible `.ics` file. Control which events include full details and which appear as anonymous time blocks.

## Requirements

- [Node.js](https://nodejs.org/) 18 or later
- npm (included with Node.js)

## Running the app

### Double-click launcher (recommended)

A `Calendar Export.desktop` launcher is included in the project folder. To use it:

1. **First time only** — right-click `Calendar Export.desktop` → Properties → Permissions → enable "Allow executing file as program" (or run `chmod +x "Calendar Export.desktop"` in a terminal)
2. Double-click `Calendar Export.desktop`

A terminal window will open, start both servers, and launch the app in your browser automatically. Close the terminal window to stop the app.

> If your file manager shows a prompt asking whether to run or display the file, choose **Run**.

### From the terminal

**Without iCloud** — just the Vite frontend:

```bash
npm install
npm run dev
```

**With iCloud** — frontend + proxy server together:

```bash
npm install
npm run dev:all
```

Then open **http://localhost:5173** in your browser (or whichever port Vite reports if 5173 is in use).

---

## Using the App

### 1. Load calendar data

On the opening screen, load your calendar data in one of three ways:

**From a file:**
- **Drag and drop** a `.ics` file onto the drop zone
- **Open .ics file** — a single exported calendar file
- **Open .icbu backup** — an Apple Calendar backup folder (select the `.icbu` directory; the app reads all calendars inside it and deduplicates events)

To export a `.ics` from Apple Calendar: File → Export → Export…  
To export an `.icbu` backup: File → Export → Calendar Archive…

**From iCloud directly:**
- Click **Connect to iCloud Calendar** and sign in with your Apple ID and an app-specific password (see below)

#### iCloud setup

Apple does not allow direct sign-in with your regular password from third-party apps. You need to generate an **app-specific password**:

1. Go to [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords
2. Click **Generate an app-specific password**, give it a name (e.g. "Calendar Export"), and copy the 16-character code
3. Paste that code into the app's password field — not your regular Apple ID password

Two-factor authentication must be enabled on your Apple ID for app-specific passwords to be available.

The proxy server (`npm run server` or `npm run dev:all`) must be running for iCloud access — it handles the CalDAV requests that browsers cannot make directly due to CORS restrictions.

### 2. Set a timeframe

Use the **From / to** date range in the top bar to limit which events are shown. Events outside the range are hidden from the calendar and removed from the selection. Adjust the range at any time — your selections are preserved for events still in view.

### 3. Select events

Click any event on the calendar to select it. Selected events are highlighted in blue. Click again to deselect.

Use **Select all visible** in the sidebar to select every event in the current timeframe at once. Use **Clear all** to start over.

Switch between **Month**, **Week**, **Day**, and **List** views using the controls in the calendar header.

### 4. Choose detail level per event

Each event in the right sidebar has an **Include details** checkbox:

| Setting | What exports |
|---|---|
| ✅ Include details | Full event: title, time, description, location, organizer, attendees |
| ☐ Include details | Anonymous time block: shows as "event" with no title or metadata |

Use anonymous mode for events you want to block out on a recipient's calendar without revealing what they are.

### 5. Export

Click **Export N events →** in the sidebar to download `export.ics`. This file can be imported directly into Outlook:

**Outlook (desktop):** File → Open & Export → Import/Export → Import an iCalendar (.ics)  
**Outlook (web):** Calendar → Add calendar → Upload from file

---

## Available scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite frontend only (file-based import, no iCloud) |
| `npm run server` | Start the iCloud proxy server only (port 3001) |
| `npm run dev:all` | Start both together (use this when you need iCloud access) |
| `npm run build` | Production build to `dist/` |

## Building for production

```bash
npm run build
```

Output goes to `dist/`. The frontend can be served as a static site. If you need iCloud support in production, you must also run the proxy server (`node server.mjs`) alongside it.
