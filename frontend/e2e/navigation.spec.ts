import { expect, test } from '@playwright/test';

const pages = [
  { link: 'About', path: '/about', heading: 'Engineer first, generalist by habit.' },
  { link: 'Skills', path: '/skills', heading: 'Tools I reach for, and why.' },
  { link: 'Projects', path: '/projects', heading: 'Projects' },
  { link: 'Resume', path: '/resume', heading: 'Resume' },
  { link: 'Contact', path: '/contact', heading: 'Contact' },
];

test.beforeEach(async ({ page }) => {
  // The journey is about navigation, so the backend is stubbed rather than required.
  await page.route('**/api/v1/ping', (route) =>
    route.fulfill({ json: { status: 'ok', version: 'e2e' } }),
  );
  await page.route('**/api/v1/projects', (route) =>
    route.fulfill({
      json: [
        {
          id: 1,
          title: 'Portfolio Hub',
          description: 'A modular monolith with an Angular front end.',
          url: 'https://example.com/hub',
          imageUrl: null,
          displayOrder: 0,
        },
      ],
    }),
  );
});

test('visitor can reach every public page from the home page nav', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Primary' });

  for (const { link, path, heading } of pages) {
    await nav.getByRole('link', { name: link }).click();

    await expect(page).toHaveURL(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(nav.getByRole('link', { name: link })).toHaveAttribute('aria-current', 'page');
  }
});

test('visitor sees published projects as cards on the Projects page', async ({ page }) => {
  await page.goto('/projects');

  const card = page.getByRole('article').filter({ hasText: 'Portfolio Hub' });
  await expect(card.getByRole('heading', { level: 2 })).toHaveText('Portfolio Hub');
  await expect(card).toContainText('A modular monolith with an Angular front end.');
  await expect(card.getByRole('link', { name: /View project Portfolio Hub/ })).toHaveAttribute(
    'href',
    'https://example.com/hub',
  );
});
