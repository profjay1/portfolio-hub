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

for (const width of [320, 390]) {
  test(`shows every nav link without sideways scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const list = page.getByRole('navigation', { name: 'Primary' }).getByRole('list');
    await expect(list.getByRole('link')).toHaveCount(6);

    const fit = await list.evaluate((ul) => {
      const box = ul.getBoundingClientRect();
      const left = Math.max(0, box.left);
      const right = Math.min(window.innerWidth, box.right);
      const clipped = [...ul.querySelectorAll('a')]
        .filter((a) => {
          const r = a.getBoundingClientRect();
          return r.left < left || r.right > right;
        })
        .map((a) => a.textContent?.trim());
      return {
        clipped,
        listOverflow: ul.scrollWidth - ul.clientWidth,
        pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });

    expect(fit).toEqual({ clipped: [], listOverflow: 0, pageOverflow: 0 });
  });
}

test('serves its own SVG favicon from the page head', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(href).toBe('favicon-v1.svg');

  const icon = await request.get('/favicon-v1.svg');
  expect(icon.status()).toBe(200);
  expect(icon.headers()['content-type']).toContain('image/svg+xml');
});

for (const width of [320, 390, 1440]) {
  test(`keeps skill tags readable and inside their cards at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/skills');
    const tags = page.locator('.tags li');
    await expect(tags.first()).toBeVisible();

    const bodyFont = await font(page.locator('body'));
    const tagFonts = await tags.evaluateAll((items) => [
      ...new Set(
        items.map((li) => {
          const style = getComputedStyle(li);
          return `${style.fontFamily} ${style.fontSize}`;
        }),
      ),
    ]);
    expect(tagFonts).toEqual([`${bodyFont.family} 14px`]);

    const fit = await tags.evaluateAll((items) => ({
      overflowing: items
        .filter((li) => {
          const card = li.closest('.card');
          if (!card) {
            return true;
          }
          const contentRight =
            card.getBoundingClientRect().right - parseFloat(getComputedStyle(card).paddingRight);
          return li.getBoundingClientRect().right > contentRight;
        })
        .map((li) => li.textContent?.trim()),
      pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    expect(fit).toEqual({ overflowing: [], pageOverflow: 0 });
  });
}
