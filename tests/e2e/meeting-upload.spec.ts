import { expect, test } from "@playwright/test";

test("user can open upload flow", async ({ page }) => {
  await page.goto("/meetings/new");
  await expect(page.getByText("Upload MP3")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Upload", exact: true }),
  ).toBeVisible();
});
