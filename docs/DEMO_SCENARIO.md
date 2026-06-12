# Demo Scenario

This flow is for a short presentation of the real-time disaster-response MVP.

## 1. Open Dashboard

1. Run `npm run dev`.
2. Open `http://localhost:3000/`.
3. Show that the first screen is the disaster dashboard, not a separate
   landing page.
4. Point out the 3D building layer, current incident markers, fire stations,
   hospitals, risk circles, and Fire Safety Big Data Platform layers.

## 2. Confirm Data Sources

1. In the right panel, show `소방안전 빅데이터 활용`.
2. Confirm map-point products:
   - 서울 특정소방대상물
   - 서울 소방용수
   - 부산 특정소방대상물
   - 부산 소방용수
3. Show `119 신고·출동 데이터`.
4. Confirm operational products:
   - 서울 119신고접수
   - 부산 구급출동
   - 부산 구조출동
   - 전북 119신고접수
5. Mention that the current repository uses public sample XLSX files converted
   to CSV, while full CSV files require the platform login/free-purchase flow.

## 3. Building-Based Report

1. Click a visible 3D building.
2. Confirm the building popup appears.
3. Confirm `신고 예정 위치` is also shown on the map and the create form is
   filled with the clicked coordinates.
4. If the building has no safety profile, explain that the report flow still
   works and the floor/exit panel is ready for verified facility data.

## 4. Register Incident

1. Set type to `화재` or `구급`.
2. Set risk level to `높음`.
3. Add a short description.
4. Submit the form.
5. Confirm the new incident marker appears and the selected incident panel
   shows dispatch and hospital recommendations.

## 5. Response Recommendation

1. Show the recommended fire station.
2. Explain that the current MVP scores distance, incident type equipment, and
   risk urgency.
3. Show the criteria chips for distance, available resources, incident type,
   and future traffic/history weighting.
4. Show the dispatch route status. The dashboard tries the existing road route
   API first and falls back to a straight reserve line if the route service is
   unavailable or slow.
5. Show the recommended hospitals and their emergency/specialty reasons.

## 6. Risk And Resource Support

1. Open `위험도`.
2. Select a high-risk area.
3. Show the factor list, including recent incidents, fire-safety targets,
   fire-water sources, national fire/force statistics, and 119 call/dispatch
   sample load.
4. Open `자원배치`.
5. Show additional fire engine and ambulance recommendations for high-risk
   regions.
6. Point out that rescue truck counts and placement reasons change with risk
   score, recent incidents, fire-water source coverage, and 119 call/dispatch
   sample load.

## 7. Incident Operations

1. Open `사고`.
2. Search or filter the incident list.
3. Select the newly registered incident.
4. Change status from `접수` to `출동`, then to `종료`.
5. Show the event timeline.
6. Edit the incident details if needed, then delete a demo record if the
   presentation needs a clean state.

## 8. Closing Notes

- Current AI/risk logic is rule based by design.
- Data service classes are separated so ML.NET, Python, external big-data APIs,
  and full platform CSV imports can replace the current sample adapters later.
- Building floor plans and emergency exits are intentionally behind
  `/api/building-safety` and must use verified facility-management or
  inspection data before operational use.
