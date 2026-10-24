// Screenshot-faithful fixtures (D1): 51_17.2_My_profile.jpeg. Name, email, role and office come from the shared
// user master (Suresh Menon, Users 47), which matches the reference; the fields below are shown only on this screen.

/** Master user whose profile is shown. */
export const profileUserId = "usr-suresh";

export const profileExtras = {
  phone: "+91 98470 20011",
  language: "English",
  /** "Last changed 12 Aug 2026" */
  passwordChangedOn: "2026-08-12",
};

/** Only English is shown; no other language appears in any reference. */
export const languages = ["English"];

export type NotificationPreference = {
  id: string;
  title: string;
  detail: string;
  enabled: boolean;
};

/** The four notification switches, in the order shown: three on, Short receipts off. */
export const notificationPreferences: NotificationPreference[] = [
  { id: "delivery-reminders", title: "Delivery reminders", detail: "Day before and on the due date", enabled: true },
  { id: "late-deliveries", title: "Late deliveries", detail: "When a delivery passes its date", enabled: true },
  { id: "payments-due", title: "Payments due", detail: "5 days before the due date", enabled: true },
  { id: "short-receipts", title: "Short receipts", detail: "When goods are received short", enabled: false },
];
