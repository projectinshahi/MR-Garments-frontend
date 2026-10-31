import { expect, type Page, test } from "@playwright/test";

// QA: Delete on the Settings edit dialogs (backend docs/wave3-contracts.md section 4.1), on the API's test database.
// A record nothing uses is deleted after its confirmation; one in use is refused with the API's reason, and the same
// confirmation offers to deactivate it instead. Role/label locators only (hidden <Activity> routes stay in the DOM).

test.use({ viewport: { width: 1440, height: 900 } });

const row = (page: Page, name: string) => page.getByRole("table").getByRole("row", { name: new RegExp(name) });

async function addTeam(page: Page, name: string) {
  await page.goto("/settings/teams");
  await page.getByRole("link", { name: "+ Add team" }).click();
  const add = page.getByRole("dialog", { name: "Add team" });
  await expect(add.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await add.getByLabel("Team name").fill(name);
  await add.getByRole("button", { name: "Save team" }).click();
  await expect(add).toBeHidden();
  await expect(row(page, name)).toContainText("Active");
}

test("deletes a team nothing uses after confirming", async ({ page }) => {
  const name = `E2E delete team ${Date.now().toString(36)}`;
  await addTeam(page, name);

  await page.getByRole("link", { name: `Edit ${name}` }).click();
  const edit = page.getByRole("dialog", { name: "Edit team" });
  const trigger = edit.getByRole("button", { name: "Delete" });
  await trigger.click();
  const confirm = page.getByRole("alertdialog", { name: "Delete team?" });
  await expect(confirm).toContainText(`Are you sure you want to delete ${name}? This can't be undone.`);
  // Focus starts on Cancel, so Enter backs out; focus returns to Delete.
  await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(confirm).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();
  // Radix (dismissable-layer 1.2.1) hands Escape to the top dialog only after the edit dialog re-renders, so an Escape
  // within ~50 ms of the confirmation opening can reach both. No person is that fast; pause like one.
  await page.waitForTimeout(150);
  await page.keyboard.press("Escape");
  await expect(confirm).toBeHidden();
  await expect(edit).toBeVisible();

  await trigger.click();
  await confirm.getByRole("button", { name: "Delete team" }).click();
  await expect(page).toHaveURL(/\/settings\/teams$/);
  await expect(edit).toBeHidden();
  await expect(page.getByText("Team deleted", { exact: true })).toBeVisible();
  await expect(row(page, name)).toHaveCount(0);

  // Gone for good: not under All after a reload either.
  await page.reload();
  await page.getByRole("group", { name: "Status" }).getByRole("button", { name: "All" }).click();
  await expect(row(page, name)).toHaveCount(0);
});

test("refuses to delete an office its users belong to, says why and offers to deactivate it", async ({ page }) => {
  await page.goto("/settings/offices");
  await page.getByRole("link", { name: "Edit Guangzhou office" }).click();
  const edit = page.getByRole("dialog", { name: "Edit office or warehouse" });
  await edit.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog", { name: "Delete office or warehouse?" }).getByRole("button", { name: "Delete office or warehouse" }).click();

  const instead = page.getByRole("alertdialog", { name: "Deactivate office or warehouse instead?" });
  await expect(instead).toContainText(/This office or warehouse is used by \d+ users?.*, so it can't be deleted\./);
  await expect(instead).toContainText("Users already there keep it.");
  await expect(instead.getByRole("button", { name: "Deactivate office or warehouse" })).toBeVisible();
  await expect(instead.getByRole("button", { name: "Cancel" })).toBeFocused();
  // Other tests use this seeded office: back out without deactivating it.
  await instead.getByRole("button", { name: "Cancel" }).click();
  await expect(instead).toBeHidden();
  await expect(edit).toBeVisible();
  await expect(edit.getByLabel("Status")).toHaveValue("Active");
  await edit.getByRole("button", { name: "Cancel" }).click();
  await page.reload();
  await expect(row(page, "Guangzhou office")).toContainText("Active");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 740 }, hasTouch: true });

  test("the confirmation fits the screen, stacks its buttons and works by touch", async ({ page }) => {
    const name = `E2E phone team ${Date.now().toString(36)}`;
    await addTeam(page, name);

    await page.getByRole("link", { name: `Edit ${name}` }).tap();
    const edit = page.getByRole("dialog", { name: "Edit team" });
    await edit.getByRole("button", { name: "Delete" }).tap();
    const confirm = page.getByRole("alertdialog", { name: "Delete team?" });
    await expect(confirm).toBeVisible();
    // Measure after the zoom-in, not halfway through it.
    await confirm.evaluate((dialog) => Promise.all(dialog.getAnimations({ subtree: true }).map((animation) => animation.finished)));

    const box = (await confirm.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    const cancel = (await confirm.getByRole("button", { name: "Cancel" }).boundingBox())!;
    const remove = (await confirm.getByRole("button", { name: "Delete team" }).boundingBox())!;
    // Stacked full width, the action on top.
    expect(remove.y).toBeLessThan(cancel.y);
    expect(Math.round(remove.width)).toBe(Math.round(cancel.width));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await confirm.getByRole("button", { name: "Cancel" }).tap();
    await expect(confirm).toBeHidden();
    await edit.getByRole("button", { name: "Delete" }).tap();
    await confirm.getByRole("button", { name: "Delete team" }).tap();
    await expect(page.getByText("Team deleted", { exact: true })).toBeVisible();
    await expect(row(page, name)).toHaveCount(0);
  });
});
