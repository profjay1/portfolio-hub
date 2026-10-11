import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthSession, CurrentUser } from '../../../core/auth/auth-session';
import { AdminLogin } from './admin-login';

const LOGIN = '/api/v1/auth/login';

describe('AdminLogin', () => {
  let fixture: ComponentFixture<AdminLogin>;
  let http: HttpTestingController;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  const admin: CurrentUser = { email: 'admin@example.com', role: 'ADMIN' };

  async function render(returnUrl?: string): Promise<void> {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(AdminLogin);
    if (returnUrl !== undefined) {
      fixture.componentRef.setInput('returnUrl', returnUrl);
    }
    await fixture.whenStable();
  }

  afterEach(() => http.verify());

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function squash(value: string | null | undefined): string {
    return value?.replace(/\s+/g, ' ').trim() ?? '';
  }

  /** Finds a control the way assistive technology does: through its <label>. */
  function field(label: string): HTMLInputElement {
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

  async function type(label: string, value: string): Promise<void> {
    const control = field(label);
    control.value = value;
    control.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function fillCredentials(
    email = 'admin@example.com',
    password = 'correct horse',
  ): Promise<void> {
    await type('Email', email);
    await type('Password', password);
  }

  /** Signs in without waiting for stability: a request in flight keeps the app unstable on purpose. */
  function signIn(): void {
    submitButton().click();
  }

  async function signInAndSettle(): Promise<void> {
    signIn();
    await fixture.whenStable();
  }

  async function answer(body: object | null, status: number, statusText: string): Promise<void> {
    http.expectOne(LOGIN).flush(body, { status, statusText });
    await fixture.whenStable();
  }

  describe('the form', () => {
    beforeEach(() => render());

    it('asks for an email and password, with password-manager hints', () => {
      expect(squash(host().querySelector('main h1')?.textContent)).toBe('Sign in');
      expect(field('Email').getAttribute('type')).toBe('email');
      expect(field('Email').getAttribute('autocomplete')).toBe('username');
      expect(field('Email').getAttribute('name')).toBe('login.email');
      expect(field('Password').getAttribute('type')).toBe('password');
      expect(field('Password').getAttribute('autocomplete')).toBe('current-password');
      expect(field('Password').getAttribute('name')).toBe('login.password');
      expect(squash(submitButton().textContent)).toBe('Sign in');
    });

    it('blocks signing in and explains why while fields are empty', async () => {
      await signInAndSettle();

      http.expectNone(LOGIN);
      expect(errorFor('Email')).toBe('Enter your email address.');
      expect(errorFor('Password')).toBe('Enter your password.');
      expect(field('Email').getAttribute('aria-invalid')).toBe('true');
    });

    it('treats an email of only spaces as empty', async () => {
      await fillCredentials('   ');

      await signInAndSettle();

      http.expectNone(LOGIN);
      expect(errorFor('Email')).toBe('Enter your email address.');
    });

    it.each(['not-an-email', 'admin@', '@example.com', 'ad min@example.com'])(
      'rejects %s as an email address',
      async (email) => {
        await fillCredentials(email);

        await signInAndSettle();

        http.expectNone(LOGIN);
        expect(errorFor('Email')).toBe('Enter a valid email address.');
      },
    );

    it('accepts an address without a dotted domain, as the backend does', async () => {
      await fillCredentials('admin@localhost');

      signIn();
      const request = http.expectOne(LOGIN);
      expect(request.request.body).toEqual(expect.objectContaining({ email: 'admin@localhost' }));
      request.flush(admin);
      await fixture.whenStable();
    });

    it('trims the email but sends the password exactly as typed', async () => {
      await fillCredentials('  admin@example.com ', ' correct horse ');

      signIn();
      const request = http.expectOne({ method: 'POST', url: LOGIN });
      expect(request.request.body).toEqual({
        email: 'admin@example.com',
        password: ' correct horse ',
      });
      request.flush(admin);
      await fixture.whenStable();
    });

    it('disables signing in while a request is on its way', async () => {
      await fillCredentials();

      signIn();
      fixture.detectChanges();
      expect(squash(submitButton().textContent)).toBe('Signing in…');
      expect(submitButton().disabled).toBe(true);

      await answer(admin, 200, 'OK');
    });
  });

  describe('when signing in succeeds', () => {
    it('remembers who signed in and goes to the admin projects page by default', async () => {
      await render();
      await fillCredentials();

      signIn();
      await answer(admin, 200, 'OK');

      expect(TestBed.inject(AuthSession).user()).toEqual(admin);
      expect(navigateByUrl).toHaveBeenCalledExactlyOnceWith('/admin/projects');
      expect(formError()).toBe('');
    });

    it('returns to the admin page the visitor was headed to', async () => {
      await render('/admin/contact?tab=unread');
      await fillCredentials();

      signIn();
      await answer(admin, 200, 'OK');

      expect(navigateByUrl).toHaveBeenCalledExactlyOnceWith('/admin/contact?tab=unread');
    });

    it.each([
      ['an empty value', ''],
      ['a public page', '/projects'],
      ['the login page itself', '/admin/login'],
      ['the login page with a query', '/admin/login?returnUrl=/admin/resume'],
      ['a protocol-relative URL', '//evil.example/admin/'],
      ['a double slash inside the path', '/admin//evil.example'],
      ['an absolute URL', 'https://evil.example/admin/'],
      ['a backslash trick', '/admin/\\evil.example'],
      ['a javascript: URL', 'javascript:alert(1)'],
    ])('ignores %s as a return address and goes to projects', async (_case, returnUrl) => {
      await render(returnUrl);
      await fillCredentials();

      signIn();
      await answer(admin, 200, 'OK');

      expect(navigateByUrl).toHaveBeenCalledExactlyOnceWith('/admin/projects');
    });
  });

  describe('when signing in fails', () => {
    beforeEach(() => render('/admin/contact'));

    it('says the credentials are wrong without saying which one, and clears the password', async () => {
      await fillCredentials('admin@example.com', 'wrong password');

      signIn();
      await answer({ status: 401, code: 'invalid-credentials' }, 401, 'Unauthorized');

      expect(formError()).toBe('The email or password is incorrect.');
      // Attached to neither field: nothing hints at which one was wrong.
      expect(errorFor('Email')).toBe('');
      expect(errorFor('Password')).toBe('');
      expect(field('Email').hasAttribute('aria-invalid')).toBe(false);
      expect(field('Password').hasAttribute('aria-invalid')).toBe(false);
      expect(field('Email').value).toBe('admin@example.com');
      expect(field('Password').value).toBe('');
      expect(navigateByUrl).not.toHaveBeenCalled();
      expect(TestBed.inject(AuthSession).user()).toBeUndefined();
    });

    it('shows the throttle message after too many failed attempts', async () => {
      await fillCredentials();

      signIn();
      await answer(
        {
          status: 429,
          code: 'too-many-attempts',
          detail: 'Too many failed sign-in attempts. Try again later.',
        },
        429,
        'Too Many Requests',
      );

      expect(formError()).toBe('Too many failed sign-in attempts. Try again later.');
      expect(field('Password').value).toBe('correct horse');
      expect(navigateByUrl).not.toHaveBeenCalled();
    });

    it('shows server validation errors next to the matching fields', async () => {
      await fillCredentials();

      signIn();
      await answer(
        {
          status: 400,
          code: 'validation-failed',
          errors: [{ field: 'email', message: 'must be a well-formed email address' }],
        },
        400,
        'Bad Request',
      );

      expect(errorFor('Email')).toBe('must be a well-formed email address');
      expect(formError()).toBe('');
    });

    it.each([
      [403, 'Forbidden'],
      [500, 'Server Error'],
    ])('asks to try again after an unexpected %i', async (status, statusText) => {
      await fillCredentials();

      signIn();
      await answer(null, status, statusText);

      expect(formError()).toBe('Sign-in failed. Please try again.');
      expect(field('Email').value).toBe('admin@example.com');
      expect(navigateByUrl).not.toHaveBeenCalled();
    });

    it('asks to try again when the network is down', async () => {
      await fillCredentials();

      signIn();
      http.expectOne(LOGIN).error(new ProgressEvent('error'));
      await fixture.whenStable();

      expect(formError()).toBe('Sign-in failed. Please try again.');
      expect(navigateByUrl).not.toHaveBeenCalled();
    });

    it('re-enables signing in after a failure', async () => {
      await fillCredentials();

      signIn();
      await answer(null, 401, 'Unauthorized');

      expect(submitButton().disabled).toBe(false);
      expect(squash(submitButton().textContent)).toBe('Sign in');
    });
  });
});
