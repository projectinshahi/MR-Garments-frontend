"use client";

import { useState } from "react";

import { SectionCard } from "@/components/shared/cards";
import { Switch } from "@/components/ui/switch";

import type { NotificationPreference } from "./data/queries";
import { cardClass, rowDetailClass, rowTitleClass } from "./styles";

/** "Notifications" card: four 54 px rows split by dividers, each with a title, a muted line and a switch. */
export function NotificationSettings({ preferences }: { preferences: NotificationPreference[] }) {
  // Mock mutation: client state only, resets on reload
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(preferences.map((p) => [p.id, p.enabled])),
  );

  return (
    <SectionCard title="Notifications" titleGap="none" bottomGap="form" className={cardClass}>
      <ul aria-label="Notification settings" className="mt-[13px] divide-y divide-border-subtle">
        {preferences.map((preference) => (
          <li key={preference.id} className="flex items-center justify-between gap-4 py-[12.5px]">
            <div className="min-w-0">
              <p id={`pref-${preference.id}-title`} className={rowTitleClass}>
                {preference.title}
              </p>
              <p id={`pref-${preference.id}-detail`} className={rowDetailClass}>
                {preference.detail}
              </p>
            </div>
            <Switch
              aria-labelledby={`pref-${preference.id}-title`}
              aria-describedby={`pref-${preference.id}-detail`}
              checked={enabled[preference.id] ?? false}
              onCheckedChange={(checked) => setEnabled((current) => ({ ...current, [preference.id]: checked }))}
            />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
