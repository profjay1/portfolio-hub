import { HttpErrorResponse, httpResource } from '@angular/common/http';
import {
  Component,
  Injector,
  PendingTasks,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ADMIN_CONTACT_URL, AdminContactApi } from './admin-contact-api';
import { AdminContactMessage } from './admin-contact-message';

const PAGE_HEADING = 'contact-heading';
const PANEL_HEADING = 'message-heading';
const CLOSE_BUTTON = 'close-message';

/** Shown in UTC, labelled as such: messages arrive at any hour, and the server stores UTC. Same as AdminResume. */
const receivedAt = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

/**
 * The contact inbox. Viewing a message is read-only; marking it read is an explicit action, so opening one by mistake
 * never changes its status.
 */
@Component({
  selector: 'app-admin-contact',
  templateUrl: './admin-contact.html',
  styleUrls: ['../admin-shared.css', './admin-contact.css'],
})
export class AdminContact {
  private readonly api = inject(AdminContactApi);
  private readonly injector = inject(Injector);
  private readonly pendingTasks = inject(PendingTasks);

  protected readonly messages = httpResource<AdminContactMessage[]>(() => ADMIN_CONTACT_URL);

  private readonly openId = signal<number | null>(null);
  /** Looked up in the list, so a reload (after marking read) updates the open panel with no extra state. */
  protected readonly openMessage = computed(() => {
    const id = this.openId();
    if (id === null || !this.messages.hasValue()) {
      return null;
    }
    return this.messages.value().find((message) => message.id === id) ?? null;
  });

  protected readonly markingId = signal<number | null>(null);
  protected readonly actionError = signal<string | null>(null);
  /** Announced in the status region; the Mark as read button disappearing on its own would be silent. */
  protected readonly statusMessage = signal<string | null>(null);

  protected readonly loadError = computed(() => {
    const error = this.messages.error();
    if (!error) {
      return null;
    }
    const status = error instanceof HttpErrorResponse ? error.status : 0;
    // No auth guard yet (login slice): until then the API answers 401 and the page says why.
    if (status === 401) {
      return 'You need to sign in to read messages. Sign-in arrives in a later release.';
    }
    if (status === 403) {
      return "You don't have permission to read messages.";
    }
    return "Messages couldn't be loaded. Please try again.";
  });

  protected formatReceived(iso: string): string {
    return `${receivedAt.format(new Date(iso))} UTC`;
  }

  protected open(message: AdminContactMessage): void {
    this.actionError.set(null);
    this.statusMessage.set(null);
    this.openId.set(message.id);
    // The panel heading is focusable (tabindex="-1"), so keyboard and screen-reader users land on the message.
    this.focusAfterRender(PANEL_HEADING);
  }

  protected close(): void {
    const id = this.openId();
    this.openId.set(null);
    this.focusAfterRender(id === null ? PAGE_HEADING : `view-${id}`);
  }

  protected async markRead(message: AdminContactMessage): Promise<void> {
    this.actionError.set(null);
    this.statusMessage.set(null);
    // Zoneless Angular cannot see this promise chain; registering it keeps the app "unstable" until the outcome is
    // rendered, which is what tests (whenStable) and, later, SSR wait for. Same pattern as AdminProjects.
    const done = this.pendingTasks.add();
    this.markingId.set(message.id);
    try {
      await firstValueFrom(this.api.markRead(message.id));
      this.statusMessage.set(`Marked ${message.name}'s message as read.`);
      this.messages.reload();
      // The button that had focus is removed once the message is read; Close is the next useful control.
      this.focusAfterRender(CLOSE_BUTTON);
    } catch (error) {
      this.actionError.set(this.markReadError(error));
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.openId.set(null);
        this.messages.reload();
        // The row is gone, so its View button cannot take focus back.
        this.focusAfterRender(PAGE_HEADING);
      }
    } finally {
      this.markingId.set(null);
      done();
    }
  }

  private markReadError(error: unknown): string {
    const status = error instanceof HttpErrorResponse ? error.status : 0;
    if (status === 404) {
      return 'This message no longer exists.';
    }
    if (status === 401) {
      return 'You need to sign in to update messages. Sign-in arrives in a later release.';
    }
    if (status === 403) {
      return "You don't have permission to update messages.";
    }
    return "The message couldn't be marked as read. Please try again.";
  }

  /** Keeps keyboard focus on the control that replaced the one just activated. */
  private focusAfterRender(id: string): void {
    afterNextRender(() => document.getElementById(id)?.focus(), { injector: this.injector });
  }
}
