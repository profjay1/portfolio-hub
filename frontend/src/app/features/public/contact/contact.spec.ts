import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Contact } from './contact';

const URL = '/api/v1/contact';

describe('Contact', () => {
  let fixture: ComponentFixture<Contact>;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Contact);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function squash(value: string | null | undefined): string {
    return value?.replace(/\s+/g, ' ').trim() ?? '';
  }

  /** Finds a control the way assistive technology does: through its <label>. */
  function field(label: string): HTMLInputElement | HTMLTextAreaElement {
    const labelEl = Array.from(host().querySelectorAll('label')).find(
      (l) => squash(l.textContent) === label,
    );
    const control = labelEl && host().querySelector<HTMLInputElement>(`#${labelEl.htmlFor}`);
    if (!control) {
      throw new Error(`No control labelled "${label}"`);
    }
    return control;
  }

  /** The error text announced for a field: whatever its aria-describedby points at. */
  function errorFor(label: string): string {
    const ids = field(label).getAttribute('aria-describedby') ?? '';
    return ids
      .split(' ')
      .filter((id) => id.length > 0) // no aria-describedby → no ids, not one empty id
      .map((id) => squash(host().querySelector(`#${id}`)?.textContent))
      .filter((text) => text.length > 0)
      .join(' ');
  }

  function submitButton(): HTMLButtonElement {
    const button = host().querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!button) {
      throw new Error('No submit button');
    }
    return button;
  }

  function formError(): string {
    return squash(host().querySelector('[role="alert"]')?.textContent);
  }

  function status(): string {
    return squash(host().querySelector('[role="status"]')?.textContent);
  }

  async function type(label: string, value: string): Promise<void> {
    const control = field(label);
    control.value = value;
    control.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function fillValidMessage(): Promise<void> {
    await type('Name', 'Ada Lovelace');
    await type('Email', 'ada@example.com');
    await type('Message', 'Are you open to a backend role?');
  }

  /** Sends without waiting for stability: a request in flight keeps the app unstable on purpose. */
  function send(): void {
    submitButton().click();
  }

  /** Submits and waits, for cases where client-side rules should stop the request. */
  async function sendAndSettle(): Promise<void> {
    send();
    await fixture.whenStable();
  }

  it('replaces the placeholder with a labelled form', () => {
    expect(squash(host().querySelector('h1')?.textContent)).toBe('Contact');
    expect(host().textContent).not.toContain('Coming soon');
    expect(field('Name').value).toBe('');
    expect(field('Email').getAttribute('type')).toBe('email');
    expect(field('Message').tagName).toBe('TEXTAREA');
    expect(squash(submitButton().textContent)).toBe('Send message');
  });

  describe('honeypot', () => {
    function honeypot(): HTMLInputElement {
      return field('Website') as HTMLInputElement;
    }

    it('is in the DOM under the field name bots look for', () => {
      expect(honeypot().getAttribute('name')).toBe('contact.website');
    });

    it('is hidden from sighted users', () => {
      expect(honeypot().closest('.visually-hidden')).not.toBeNull();
    });

    it('is hidden from screen readers, label included', () => {
      const hidden = honeypot().closest('[aria-hidden="true"]');
      expect(hidden).not.toBeNull();
      expect(hidden?.querySelector('label[for="contact-website"]')).not.toBeNull();
    });

    it('cannot be reached with the keyboard', () => {
      expect(honeypot().getAttribute('tabindex')).toBe('-1');
    });

    it('is not autofilled by the browser', () => {
      expect(honeypot().getAttribute('autocomplete')).toBe('off');
    });

    it('sends whatever was put in it, leaving the decision to the server', async () => {
      await fillValidMessage();
      await type('Website', 'https://spam.example');

      send();
      const request = http.expectOne(URL);
      expect(request.request.body).toEqual(
        expect.objectContaining({ website: 'https://spam.example' }),
      );
      request.flush(null, { status: 202, statusText: 'Accepted' });
      await fixture.whenStable();
    });
  });

  describe('client-side rules', () => {
    it('blocks sending and explains why while required fields are empty', async () => {
      await sendAndSettle();

      http.expectNone(URL);
      expect(errorFor('Name')).toBe('Enter your name.');
      expect(errorFor('Email')).toBe('Enter your email address.');
      expect(errorFor('Message')).toBe('Enter a message.');
      expect(field('Name').getAttribute('aria-invalid')).toBe('true');
    });

    it('treats fields of only spaces as empty', async () => {
      await type('Name', '   ');
      await type('Email', '  ');
      await type('Message', '\n\t ');

      await sendAndSettle();

      http.expectNone(URL);
      expect(errorFor('Name')).toBe('Enter your name.');
      expect(errorFor('Email')).toBe('Enter your email address.');
      expect(errorFor('Message')).toBe('Enter a message.');
    });

    it.each(['not-an-email', 'ada@example', 'ada @example.com', '@example.com'])(
      'rejects %s as an email address',
      async (email) => {
        await fillValidMessage();
        await type('Email', email);

        await sendAndSettle();

        http.expectNone(URL);
        expect(errorFor('Email')).toBe('Enter a valid email address, like name@example.com.');
      },
    );

    it('rejects values over the server limits', async () => {
      await type('Name', 'n'.repeat(201));
      await type('Email', `${'a'.repeat(243)}@example.com`); // 255 characters
      await type('Message', 'm'.repeat(5001));

      await sendAndSettle();

      http.expectNone(URL);
      expect(errorFor('Name')).toBe('Keep your name to 200 characters or fewer.');
      expect(errorFor('Email')).toBe('Keep your email address to 254 characters or fewer.');
      expect(errorFor('Message')).toBe('Keep your message to 5000 characters or fewer.');
    });

    it('accepts values exactly at the server limits', async () => {
      await type('Name', 'n'.repeat(200));
      await type('Email', `${'a'.repeat(242)}@example.com`); // 254 characters
      await type('Message', 'm'.repeat(5000));

      send();
      http.expectOne(URL).flush(null, { status: 202, statusText: 'Accepted' });
      await fixture.whenStable();

      expect(status()).toContain('Message sent.');
    });
  });

  describe('sending', () => {
    it('posts the message, confirms it was sent and clears the form', async () => {
      await fillValidMessage();

      send();
      const request = http.expectOne(URL);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        message: 'Are you open to a backend role?',
        website: '',
      });
      // Exactly what the backend answers: 202 with no body (FetchBackend turns an empty body into null).
      request.flush(null, { status: 202, statusText: 'Accepted' });
      await fixture.whenStable();

      expect(status()).toBe("Message sent. Thanks for getting in touch; I'll reply by email.");
      expect(field('Name').value).toBe('');
      expect(field('Email').value).toBe('');
      expect(field('Message').value).toBe('');
      // Cleared fields are pristine again, so they don't greet the visitor with "required" errors.
      expect(errorFor('Name')).toBe('');
      expect(errorFor('Email')).toBe('');
      expect(errorFor('Message')).toBe('');
      expect(field('Name').hasAttribute('aria-invalid')).toBe(false);
      expect(formError()).toBe('');
    });

    it('keeps the confirmation until the visitor starts another message', async () => {
      await fillValidMessage();
      send();
      http.expectOne(URL).flush(null, { status: 202, statusText: 'Accepted' });
      await fixture.whenStable();
      expect(status()).toContain('Message sent.'); // present first…

      await type('Name', 'A');

      expect(status()).toBe(''); // …then gone after the next edit
    });

    it('disables sending while a message is on its way', async () => {
      await fillValidMessage();

      send();
      fixture.detectChanges();
      expect(squash(submitButton().textContent)).toBe('Sending…');
      expect(submitButton().disabled).toBe(true);

      http.expectOne(URL).flush(null, { status: 202, statusText: 'Accepted' });
      await fixture.whenStable();
      expect(submitButton().disabled).toBe(false);
    });
  });

  describe('when the server refuses', () => {
    it('shows server validation errors next to the matching fields', async () => {
      await fillValidMessage();

      send();
      http.expectOne(URL).flush(
        {
          status: 400,
          code: 'validation-failed',
          errors: [
            { field: 'email', message: 'must be a well-formed email address' },
            { field: 'message', message: 'size must be between 0 and 5000' },
          ],
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await fixture.whenStable();

      expect(errorFor('Email')).toBe('must be a well-formed email address');
      expect(errorFor('Message')).toBe('size must be between 0 and 5000');
      expect(errorFor('Name')).toBe('');
      expect(formError()).toBe('');
      expect(status()).toBe('');
    });

    it('shows server errors for unknown fields as a form-level message', async () => {
      await fillValidMessage();

      send();
      http
        .expectOne(URL)
        .flush(
          { status: 400, errors: [{ field: 'somethingNew', message: 'is not allowed' }] },
          { status: 400, statusText: 'Bad Request' },
        );
      await fixture.whenStable();

      expect(formError()).toBe('somethingNew: is not allowed');
    });

    it('keeps what was typed and says so when the server fails', async () => {
      await fillValidMessage();

      send();
      http.expectOne(URL).flush(null, { status: 500, statusText: 'Server Error' });
      await fixture.whenStable();

      expect(formError()).toBe("Your message couldn't be sent. Please try again.");
      expect(field('Name').value).toBe('Ada Lovelace');
      expect(field('Message').value).toBe('Are you open to a backend role?');
      expect(status()).toBe('');
    });

    it('keeps what was typed and says so when the network is down', async () => {
      await fillValidMessage();

      send();
      http.expectOne(URL).error(new ProgressEvent('error'));
      await fixture.whenStable();

      expect(formError()).toBe("Your message couldn't be sent. Please try again.");
      expect(field('Email').value).toBe('ada@example.com');
    });
  });
});
