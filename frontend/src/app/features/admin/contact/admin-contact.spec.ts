import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminContact } from './admin-contact';
import { AdminContactMessage } from './admin-contact-message';

const LIST = '/api/v1/admin/contact';

describe('AdminContact', () => {
  let fixture: ComponentFixture<AdminContact>;
  let http: HttpTestingController;

  const ada: AdminContactMessage = {
    id: 2,
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    message: 'Are you open to a backend role?\nHappy to talk this week.',
    createdAt: '2026-10-08T14:30:00Z',
    read: false,
  };
  const grace: AdminContactMessage = {
    id: 1,
    name: 'Grace Hopper',
    email: 'grace@example.com',
    message: 'Loved the Portfolio Hub write-up.',
    createdAt: '2026-10-01T09:05:00Z',
    read: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminContact);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function squash(value: string | null | undefined): string {
    return value?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function text(selector: string): string {
    return squash(host().querySelector(selector)?.textContent);
  }

  function status(): string {
    return text('[role="status"]');
  }

  function rows(): string[][] {
    return Array.from(host().querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('th, td'))
        .slice(0, 4)
        .map((cell) => squash(cell.textContent)),
    );
  }

  /** Buttons by accessible name, which includes visually hidden text. */
  function button(name: string): HTMLButtonElement {
    const match = findButton(name);
    if (!match) {
      throw new Error(`No button named "${name}"`);
    }
    return match;
  }

  function findButton(name: string): HTMLButtonElement | undefined {
    return Array.from(host().querySelectorAll('button')).find(
      (b) => squash(b.textContent) === name,
    );
  }

  function panel(): HTMLElement | null {
    return host().querySelector('section.detail-panel');
  }

  async function load(messages: AdminContactMessage[]): Promise<void> {
    http.expectOne(LIST).flush(messages);
    await fixture.whenStable();
  }

  async function click(name: string): Promise<void> {
    button(name).click();
    await fixture.whenStable();
  }

  /** Sends the PATCH without waiting for stability: a request in flight keeps the app unstable on purpose. */
  function markRead(): void {
    button('Mark as read').click();
    fixture.detectChanges();
  }

  /** The list reloads after a change; wait for that request to be sent, answer it, then let the page settle. */
  async function answerReload(messages: AdminContactMessage[]): Promise<void> {
    const reload = await vi.waitFor(() => http.expectOne({ method: 'GET', url: LIST }));
    reload.flush(messages);
    await fixture.whenStable();
  }

  // --- The list ---

  it('shows a loading message while the inbox loads', () => {
    const request = http.expectOne(LIST);

    expect(status()).toBe('Loading messages…');

    request.flush([]);
  });

  it('lists each message with sender, email, received time in UTC and read status', async () => {
    await load([ada, grace]);

    expect(rows()).toEqual([
      ['Ada Lovelace', 'ada@example.com', 'Oct 8, 2026, 2:30 PM UTC', 'Unread'],
      ['Grace Hopper', 'grace@example.com', 'Oct 1, 2026, 9:05 AM UTC', 'Read'],
    ]);
    expect(host().querySelector('tbody time')?.getAttribute('datetime')).toBe(
      '2026-10-08T14:30:00Z',
    );
  });

  it('names each View button after its sender for screen readers', async () => {
    await load([ada, grace]);

    expect(button('View message from Ada Lovelace').id).toBe('view-2');
    expect(button('View message from Grace Hopper').id).toBe('view-1');
  });

  it('says so when there are no messages yet', async () => {
    await load([]);

    expect(host().querySelector('table')).toBeNull();
    expect(status()).toBe('No messages yet.');
  });

  it.each([
    [401, 'You need to sign in to read messages. Sign-in arrives in a later release.'],
    [403, "You don't have permission to read messages."],
    [500, "Messages couldn't be loaded. Please try again."],
  ])('explains a %i while loading the inbox', async (code, message) => {
    http.expectOne(LIST).flush(null, { status: code, statusText: 'Error' });
    await fixture.whenStable();

    expect(status()).toBe(message);
    expect(host().querySelector('table')).toBeNull();
  });

  // --- Viewing ---

  it('opens the full message with a reply link and moves focus to it', async () => {
    await load([ada, grace]);

    await click('View message from Ada Lovelace');

    expect(squash(panel()?.querySelector('h2')?.textContent)).toBe('Message from Ada Lovelace');
    expect(document.activeElement).toBe(panel()?.querySelector('h2'));
    const reply = panel()?.querySelector<HTMLAnchorElement>('a');
    expect(reply?.getAttribute('href')).toBe('mailto:ada@example.com');
    expect(squash(reply?.textContent)).toBe('ada@example.com');
    // Line breaks survive: textContent is compared unsquashed.
    expect(panel()?.querySelector('.message-body')?.textContent).toBe(ada.message);
    expect(panel()?.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-08T14:30:00Z');
  });

  it('shows markup in a message as text, never as HTML', async () => {
    const markup = '<b>bold</b><img src="x" onerror="alert(1)">';
    await load([{ ...ada, message: markup }]);

    await click('View message from Ada Lovelace');

    const body = panel()?.querySelector('.message-body');
    expect(body?.textContent).toBe(markup);
    expect(body?.querySelector('b, img')).toBeNull();
  });

  it('opens a message without marking it read', async () => {
    await load([ada]);

    await click('View message from Ada Lovelace');

    http.expectNone({ method: 'PATCH' });
    expect(rows()[0][3]).toBe('Unread');
  });

  it('closes the message and returns focus to its View button', async () => {
    await load([ada, grace]);
    await click('View message from Grace Hopper');

    await click('Close');

    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(button('View message from Grace Hopper'));
  });

  // --- Marking read ---

  it('offers Mark as read only for unread messages', async () => {
    await load([ada, grace]);

    await click('View message from Grace Hopper');
    expect(findButton('Mark as read')).toBeUndefined();

    await click('View message from Ada Lovelace');
    expect(findButton('Mark as read')).toBeDefined();
  });

  it('marks the message read, refreshes the inbox and keeps focus in the panel', async () => {
    await load([ada, grace]);
    await click('View message from Ada Lovelace');

    markRead();
    const request = http.expectOne(`${LIST}/2/read`);
    expect(request.request.method).toBe('PATCH');
    expect(button('Mark as read').disabled).toBe(true);
    // Exactly what the backend answers: 204 with no body.
    request.flush(null, { status: 204, statusText: 'No Content' });
    await answerReload([{ ...ada, read: true }, grace]);

    expect(status()).toBe("Marked Ada Lovelace's message as read.");
    expect(rows()[0][3]).toBe('Read');
    expect(text('section.detail-panel .badge')).toBe('Read');
    expect(findButton('Mark as read')).toBeUndefined();
    // The focused button is gone, so focus moves to Close rather than dropping to the page.
    expect(document.activeElement).toBe(button('Close'));
  });

  it('says so and refreshes the inbox when the message no longer exists', async () => {
    await load([ada, grace]);
    await click('View message from Ada Lovelace');

    markRead();
    http
      .expectOne(`${LIST}/2/read`)
      .flush(
        { status: 404, code: 'contact-message-not-found' },
        { status: 404, statusText: 'Not Found' },
      );
    await answerReload([grace]);

    expect(text('[role="alert"]')).toBe('This message no longer exists.');
    expect(panel()).toBeNull();
    expect(rows().map(([name]) => name)).toEqual(['Grace Hopper']);
    expect(document.activeElement).toBe(host().querySelector('h1'));
  });

  it.each([
    [401, 'You need to sign in to update messages. Sign-in arrives in a later release.'],
    [403, "You don't have permission to update messages."],
    [500, "The message couldn't be marked as read. Please try again."],
  ])('explains a %i and leaves the message unread', async (code, message) => {
    await load([ada]);
    await click('View message from Ada Lovelace');

    markRead();
    http.expectOne(`${LIST}/2/read`).flush(null, { status: code, statusText: 'Error' });
    await fixture.whenStable();

    expect(text('[role="alert"]')).toBe(message);
    expect(rows()[0][3]).toBe('Unread');
    expect(button('Mark as read').disabled).toBe(false);
  });
});
