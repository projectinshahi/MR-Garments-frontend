import { expect, test as setup } from "@playwright/test";

import { ACCOUNTS } from "./sessions";

// B4: real sign-in through AUTH-1 (POST /api/v1/auth/login, docs/contracts.md in the backend), once per run.
// The request comes from the app's own address, as the API's same-site check requires (B9.8).
for (const { email, state } of ACCOUNTS) {
  setup(`sign in as ${email}`, async ({ request, baseURL }) => {
    const password = process.env.E2E_PASSWORD;
    expect(password, "Set E2E_PASSWORD in .env.test.local").toBeTruthy();
    const response = await request.post("/api/v1/auth/login", {
      data: { email, password, keepSignedIn: true },
      headers: { Origin: baseURL ?? "" },
    });
    expect(response.status(), `AUTH-1 sign-in for ${email}`).toBe(200);
    await request.storageState({ path: state });
  });
}
