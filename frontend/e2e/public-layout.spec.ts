import { expect, type Locator, test } from '@playwright/test';

// Layout checks need a real browser: the unit tests' DOM has no fonts or box sizes to measure.

test.beforeEach(async ({ page }) => {
  // None of these checks depend on data, so no request reaches a backend, live or not.
  await page.route('**/api/**', (route) => route.abort());
});

async function font(locator: Locator): Promise<{ family: string; size: string }> {
  return locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return { family: style.fontFamily, size: style.fontSize };
  });
}

test('gives form buttons the same font as link buttons', async ({ page }) => {
  await page.goto('/resume');
  const linkButton = await font(page.getByRole('link', { name: 'Download resume (PDF)' }));

  await page.goto('/contact');
  const formButton = await font(page.getByRole('button', { name: 'Send message' }));

  expect(formButton).toEqual(linkButton);
  expect(formButton.size).toBe('16px');
});
