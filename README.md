# Fantasy Knockout — Online League

Supabase-backed prediction league for friends.

## This version adds

- Admin-only scoreline viewer.
- Admin can edit any player's prediction if someone forgets their PIN.
- Admin can clear a player's prediction.
- Four empty Quarter-final fixtures are seeded for manual admin setup.
- Two empty Semi-final fixtures are seeded for manual admin setup.
- One empty Third-place fixture is seeded for manual admin setup.
- One empty Final fixture is seeded for manual admin setup.
- Save timestamps are hidden from the admin scorelines section.
- Normal users do not see other people's scorelines in the Table tab.
- Round tabs and round-based scoring are preserved.
- Third-place scoring updated to +5 winner and +5 exact-score bonus.
- Final scoring updated to +7 winner and +7 exact-score bonus.

## Scoring

- Round of 32: +2 winner/draw direction, +2 exact-score bonus = 4 max.
- Round of 16: +3 winner/draw direction, +2 exact-score bonus = 5 max.
- Quarter-final: +3 winner/draw direction, +3 exact-score bonus = 6 max.
- Semi-final: +4 winner/draw direction, +4 exact-score bonus = 8 max.
- Third place: +5 winner/draw direction, +5 exact-score bonus = 10 max.
- Final: +7 winner/draw direction, +7 exact-score bonus = 14 max.

## Data safety

Players, predictions, fixtures, and results are stored in Supabase. Replacing these app files and redeploying Render does not delete existing Supabase data.

Do not delete the Supabase project, delete tables, or run destructive SQL if you want to keep saved data.

## Render environment variables

Required:

- `ADMIN_PIN`
- `SESSION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Files to update for this version

Replace these in GitHub:

- `server.js`
- `public/app.js`
- `public/styles.css`
- `README.md` optional

Then deploy latest commit on Render.
