# Demo Flow Script

Use this script to present the system in 2-4 minutes.

1. **Login**
   - Open `frontend/index.html`
   - Sign in with demo credentials.

2. **Show Dashboard**
   - Highlight live fields: water level, motor state, mode, fault, timestamp.
   - Point out real-time refresh every 2 seconds.

3. **Switch AUTO -> MANUAL**
   - Click mode toggle.
   - Explain that backend command now overrides embedded auto rules.

4. **Turn Motor ON**
   - Use ON button.
   - Show motor state changing in dashboard and backend logs.

5. **Show Water Level Change**
   - Observe level percentage and color band changes in progress bar.
   - Explain threshold behavior (red/yellow/green bands).

6. **Show Fault Detection**
   - Demonstrate or describe `DRY_RUN` / `NO_WATER` condition.
   - Show fault status highlighting on dashboard.

7. **Show History Page**
   - Click **View History**.
   - Explain run duration, power estimate, and fault column.
   - Mention long-duration and fault highlighting.

8. **Mention Cloud Sync**
   - Explain that each completed motor cycle is stored locally in SQLite and pushed to MongoDB Atlas.
   - Mention retry safety when cloud is temporarily unavailable.
