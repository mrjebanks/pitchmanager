# Gregson Lane JFC Pitch Manager V1.1

Baseline release: `V1.1`

A lightweight offline-first web app for managing the **2026/27** season:
- Team setup (age group, colour, format, gender, match day, manager details)
- Venue and pitch setup (multiple venues and pitches) with venue delete support
- Separate slot allocation types: Summer Training, Winter Training, and Match
- Automatic conflict detection (team, pitch, or overlay-pitch group double-booking)
- Overlay group support for overlapping pitch layouts (only one can be used at once)
- JSON export/import for backup and transfer

## Run Locally (Offline Test)

1. Open the folder:
   - `c:\Users\banksj\OneDrive - St Mary's R.C. High School & Sports College Brownedge\Pitch management`
2. Double-click `index.html` to run directly in a browser.
3. Data is saved in browser local storage.

Optional local server (recommended for consistent browser behavior):

```powershell
cd "c:\Users\banksj\OneDrive - St Mary's R.C. High School & Sports College Brownedge\Pitch management"
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploy Options

## GitHub Pages

1. Create a GitHub repository and upload these files.
2. In repository settings, enable **Pages** from the main branch root.
3. Your app will be live on a public URL.

## Netlify (drag-and-drop)

1. Go to Netlify.
2. Drag this folder into the deployment area.
3. Netlify publishes instantly.

## Notes

- Use **Export Data** regularly for backups.
- Use **Import Data** to restore or move data between devices.
- This version is single-user and browser-based (no cloud database yet).
