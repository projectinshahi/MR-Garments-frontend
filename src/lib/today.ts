/**
 * Today's date in India as YYYY-MM-DD, the "today" every live status is measured against (backend
 * docs/live-screens-contracts.md). With Cache Components, a Server Component may read the clock only after a dynamic
 * API: call this after awaiting apiGet (which reads cookies), or in a client component.
 */
export const todayInIndia = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
