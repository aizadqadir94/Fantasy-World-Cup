# Knockout — Online World Cup Prediction League

This is the online version of your single-file prototype.

It includes:

- Online shared league using a Node/Express backend
- JSON-file database stored on the server
- Player name + private PIN login
- Each player can edit only their own predictions
- Manual admin locking/unlocking of fixtures
- Manual admin result posting and leaderboard scoring
- Seeded World Cup 2026 Round of 32 fixtures
- Mobile-friendly UI based on your original design

## Scoring

- Correct winner / draw direction: 2 points
- Exact scoreline bonus: 2 more points
- Exact scoreline total: 4 points
- Wrong winner: 0 points

## Local testing on your laptop

### 1. Install Node.js

Install Node.js 18 or newer.

### 2. Open terminal in this folder

```bash
cd fantasy-knockout-online
```

### 3. Install dependencies

```bash
npm install
```

### 4. Start the app

Mac/Linux:

```bash
ADMIN_PIN=1234 SESSION_SECRET=change-this-secret npm start
```

Windows PowerShell:

```powershell
$env:ADMIN_PIN="1234"
$env:SESSION_SECRET="change-this-secret"
npm start
```

### 5. Open the app

Go to:

```text
http://localhost:3000
```

## How players use it

1. Open the league link.
2. Enter display name.
3. Enter a 4–8 digit PIN.
4. Click **Create player**.
5. Enter predictions.
6. Scores autosave.
7. Later, use the same name + PIN and click **Log in**.

## How admin works

1. Go to the **Admin** tab.
2. Enter the admin PIN you set in Render or your local environment.
3. Use admin controls to:
   - update TBD teams,
   - lock a match,
   - unlock a match,
   - lock the full Round of 32,
   - post final scores,
   - clear a score.

Admin PIN is checked by the server. It is not hardcoded in the frontend.

## Deploy on Render

### 1. Create a GitHub repository

Upload all files in this folder to a new GitHub repo.

### 2. Create a Render web service

In Render:

1. Click **New +**.
2. Choose **Web Service**.
3. Connect your GitHub repo.
4. Use these settings:

```text
Environment: Node
Build Command: npm install
Start Command: npm start
```

### 3. Set environment variables

In Render, go to **Environment** and add:

```text
ADMIN_PIN=choose-your-private-admin-pin
SESSION_SECRET=choose-any-long-random-secret
```

Do not share the `ADMIN_PIN` with players.

### 4. Deploy

Click **Deploy Web Service**.

Render will give you a public URL. Share that URL with your friends.

## Important storage note

This version stores data in:

```text
data/db.json
```

On Render free services, filesystem storage may reset if the service is rebuilt or moved. For a small friends league this may still be fine for testing, but for serious use you should add either:

- Render persistent disk, or
- PostgreSQL database.

The current version is intentionally simple so you can deploy quickly.

## Resetting data

To reset all local data, stop the server and delete:

```text
data/db.json
```

The app will recreate it with the seeded Round of 32 schedule when restarted.

## Files

```text
server.js          Backend API, auth, PIN hashing, admin controls, scoring
package.json       Node dependencies and start command
render.yaml        Optional Render blueprint config
public/index.html  Frontend shell
public/styles.css  Mobile UI styling
public/app.js      Frontend app logic
```
