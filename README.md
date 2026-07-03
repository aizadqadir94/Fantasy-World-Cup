# Fantasy Knockout — Supabase R16 update

This update keeps the existing Supabase database and adds:

- Round of 16 placeholder fixtures in Admin.
- Round-specific scoring.
- Round of 16 scoring: +3 for correct winner/draw direction, +2 exact-score bonus, 5 points max.
- The existing Round of 32 scoring remains +2 winner and +2 exact-score bonus, 4 points max.
- Existing players, predictions, fixtures, results, and sessions are preserved because they are stored in Supabase.
- Admin-only scoreline view for every submitted pick, including open, locked, and past matches.

## Files to replace in GitHub

Replace these files from this ZIP:

- server.js
- public/app.js
- public/styles.css
- README.md (optional)

No Supabase SQL change is required.
No Render environment-variable change is required.

## After updating GitHub

Go to Render and run:

Manual Deploy -> Deploy latest commit

When the app restarts, it automatically inserts the 8 missing Round of 16 placeholder fixtures if they are not already in Supabase. It does not overwrite your existing Round of 32 data.

## Admin views

1. Open Admin.
2. Tap any round tab.
3. Use Prediction Status to see who is missing picks.
4. Use Admin scorelines to see all submitted scorelines, including open and past matches.

## Admin workflow for Round of 16

1. Open Admin.
2. Tap the R16 round tab.
3. Edit each placeholder tie.
4. Select home and away teams.
5. Set kickoff/venue if desired.
6. Tap Save tie.
7. Let users predict.
8. At kickoff, tap Lock or Lock R16.
9. After the match, enter result and tap Post result.

## Scoring

- Round of 32: winner +2, exact-score bonus +2, max 4.
- Round of 16: winner +3, exact-score bonus +2, max 5.
- Quarter-final: winner +4, exact-score bonus +2, max 6.
- Semi-final: winner +5, exact-score bonus +2, max 7.
- Third place: winner +3, exact-score bonus +2, max 5.
- Final: winner +6, exact-score bonus +3, max 9.


## Latest privacy update

- The Table tab now shows standings only.
- Player scorelines are not visible in the Table tab, even after lock or result posting.
- Only the admin can view all submitted scorelines under Admin -> Admin scorelines.
- This update does not change Supabase tables and does not delete existing data.
