import { expect, test } from '@playwright/test';

/**
 * The frontend's half of the journey, against a stubbed API: the form posts what the visitor typed and confirms it.
 * Storage, the honeypot decision and validation on the server are covered by the backend's contact tests. Also checks
 * the honeypot in a real browser, where the accessibility tree and tab order exist (jsdom has neither).
 */
test('recruiter sends a message from the Contact page', async ({ page }) => {
  const sent: unknown[] = [];
  await page.route('**/api/v1/contact', async (route) => {
    sent.push(route.request().postDataJSON());
    // What the backend answers for every valid submission: 202 with no body.
    await route.fulfill({ status: 202, body: '' });
  });
  await page.goto('/contact');

  await page.getByLabel('Name').fill('Ada Lovelace');
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByLabel('Message').fill('Are you open to a backend role?');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByRole('status')).toHaveText(
    "Message sent. Thanks for getting in touch; I'll reply by email.",
  );
  await expect(page.getByLabel('Name')).toHaveValue('');
  await expect(page.getByLabel('Email')).toHaveValue('');
  await expect(page.getByLabel('Message')).toHaveValue('');
  expect(sent).toEqual([
    {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      message: 'Are you open to a backend role?',
      website: '',
    },
  ]);
});

test('the honeypot is out of reach for people', async ({ page }) => {
  await page.goto('/contact');

  // aria-hidden removes it from the accessibility tree, so role queries (what assistive technology sees) miss it.
  await expect(page.getByRole('textbox', { name: 'Website' })).toHaveCount(0);

  // tabindex="-1" takes it out of the tab order: Tab goes from the message straight to the button.
  await page.getByLabel('Message').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Send message' })).toBeFocused();
});
