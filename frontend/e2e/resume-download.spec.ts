import { expect, test } from '@playwright/test';

/**
 * Covers the frontend's half of the journey: the link starts a browser download of the right URL and the visitor
 * stays on the page. The response itself cannot be stubbed here: Chromium hands navigations from a `download` link
 * to its download manager, which bypasses Playwright's request interception (page.route never sees them). The
 * filename and bytes are verified by the backend's ResumeApiTests (Content-Disposition and a byte-for-byte round trip).
 */
test('recruiter downloads the resume from the Resume page', async ({ page }) => {
  await page.goto('/resume');

  const downloadStarted = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download resume (PDF)' }).click();
  const download = await downloadStarted;

  expect(new URL(download.url()).pathname).toBe('/api/v1/resume/download');
  await expect(page).toHaveURL('/resume');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Resume');
});
