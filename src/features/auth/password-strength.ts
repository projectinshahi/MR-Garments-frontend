// Static rule copy from 03_1.2_Change_password.jpeg.
const RULES = [
  { label: "At least 8 characters", test: (password: string) => password.length >= 8 },
  { label: "One number", test: (password: string) => /\d/.test(password) },
  { label: "One capital letter", test: (password: string) => /[A-Z]/.test(password) },
];

export const STRENGTH_SEGMENTS = 4;

/** The three rules, plus one strength point for 12 or more characters: 0 to 4 meter segments. */
export function passwordStrength(password: string) {
  const rules = RULES.map(({ label, test }) => ({ label, met: test(password) }));
  const score = rules.filter((rule) => rule.met).length + (password.length >= 12 ? 1 : 0);
  return { rules, score };
}
