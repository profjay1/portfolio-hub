import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/ping', (route) =>
    route.fulfill({ json: { status: 'ok', version: 'e2e' } }),
  );
});

// toBeVisible() is not enough here: an element moved off-screen with a negative offset still has a box and counts
// as "visible". The real check is whether its box lies inside the viewport.
test('skip link stays off-screen until a keyboard user tabs to it', async ({ page }) => {
  await page.goto('/');
  const skipLink = page.getByRole('link', { name: 'Skip to content' });

  const hidden = await skipLink.boundingBox();
  expect(hidden).not.toBeNull();
  expect(hidden!.y + hidden!.height).toBeLessThanOrEqual(0); // non-null: asserted on the line above

  await page.keyboard.press('Tab');

  await expect(skipLink).toBeFocused();
  const shown = await skipLink.boundingBox();
  expect(shown).not.toBeNull();
  expect(shown!.y).toBeGreaterThanOrEqual(0); // non-null: asserted on the line above
  expect(shown!.y + shown!.height).toBeLessThanOrEqual(page.viewportSize()?.height ?? 0);
});

test('activating the skip link moves focus to the main content', async ({ page }) => {
  await page.goto('/');

  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');

  await expect(page.locator('main#main')).toBeFocused();
});
