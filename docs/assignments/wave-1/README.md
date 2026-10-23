# Wave 1 assignments

These are prepared but **not launched**. Spawning needs explicit user approval.

Each file is the complete prompt for one `screen-builder` agent. The template is `docs/templates/screen-assignment.md`
and the plan is `docs/proposed-build-plan.md` §6.

| Agent | Screen(s) | References | Dev port | E2E_PORT |
| --- | --- | --- | --- | --- |
| [W1-dashboard](W1-dashboard.md) | Management dashboard | 04 | 3001 | 3101 |
| [W1-orders](W1-orders.md) | Orders list | 05 | 3002 | 3102 |
| [W1-order-detail-a](W1-order-detail-a.md) | Order detail tabs a–e | 06–10 | 3003 | 3103 |
| [W1-order-detail-b](W1-order-detail-b.md) | Order detail tabs f–i | 11–14 | 3004 | 3104 |
| [W1-payments](W1-payments.md) | Deposits & Payments | 16 | 3005 | 3105 |
| [W1-calendar](W1-calendar.md) | Delivery Calendar (Month, Week, List) | 18 (=17), 19, 20 | 3006 | 3106 |
| [W1-receiving](W1-receiving.md) | Receiving (China) list and Record receipt | 22, 21 | 3007 | 3107 |

Reference folder (absolute, main checkout, not committed): `D:\SDEC\MR Garments\MR-Garments-frontend\docs\MR_Garments_Screenshots\`

**Common to every assignment:**
- Ignore the annotation badges (D3).
- Undesigned actions call `notInPrototype` (D5).
- Transcribe the records exactly as shown (D1).
- Verify with `scripts/visual-diff.mjs` at 1440 × 900.
- Report in the format from `.claude/agents/screen-builder.md`.
