import { expect, test } from "@playwright/test";

test("shows the Meeting Transcript landing page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /Sign in to your team transcript workspace/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in with Google" }),
  ).toHaveAttribute("href", "/auth/sign-in");
  await expect(page.getByText("Meeting Transcript", { exact: true })).toBeVisible();
});

test("opens the sign in page from the landing call to action", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Sign in with Google" }).click();

  await expect(page).toHaveURL("/auth/sign-in");
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
});
