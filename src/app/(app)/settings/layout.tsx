import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

// Each tab page renders its own header (the add action changes per tab) and the 1–7 tab bar.
export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return children;
}
