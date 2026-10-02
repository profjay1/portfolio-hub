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
import { AdminProject } from './admin-project';
import { ADMIN_PROJECTS_URL, AdminProjectsApi } from './admin-projects-api';

/**
 * The browser's own formatter rather than Angular's DatePipe: DatePipe and its locale data live in framework files the
 * public pages also use, so importing it here pulled them into the public bundle.
 */
const createdDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

@Component({
  selector: 'app-admin-projects',
  templateUrl: './admin-projects.html',
  styleUrl: './admin-projects.css',
})
export class AdminProjects {
  private readonly api = inject(AdminProjectsApi);
  private readonly injector = inject(Injector);
  private readonly pendingTasks = inject(PendingTasks);

  protected readonly projects = httpResource<AdminProject[]>(() => ADMIN_PROJECTS_URL);

  /** The row whose delete is waiting for confirmation, if any. */
  protected readonly confirmingDeleteId = signal<number | null>(null);
  protected readonly deletingId = signal<number | null>(null);
  protected readonly actionError = signal<string | null>(null);

  protected readonly loadError = computed(() => {
    const error = this.projects.error();
    if (!error) {
      return null;
    }
    const status = error instanceof HttpErrorResponse ? error.status : 0;
    // No auth guard yet (login slice): until then the API answers 401 and the page says why.
    if (status === 401) {
      return 'You need to sign in to manage projects. Sign-in arrives in a later release.';
    }
    if (status === 403) {
      return "You don't have permission to manage projects.";
    }
    return "Projects couldn't be loaded. Please try again.";
  });

  protected formatCreated(iso: string): string {
    return createdDate.format(new Date(iso));
  }

  protected askToDelete(project: AdminProject): void {
    this.actionError.set(null);
    this.confirmingDeleteId.set(project.id);
    this.focusAfterRender(`confirm-delete-${project.id}`);
  }

  protected cancelDelete(project: AdminProject): void {
    this.confirmingDeleteId.set(null);
    this.focusAfterRender(`delete-${project.id}`);
  }

  protected async confirmDelete(project: AdminProject): Promise<void> {
    // Zoneless Angular cannot see this promise chain; registering it keeps the app "unstable" until the outcome is
    // rendered, which is what tests (whenStable) and, later, SSR wait for.
    const done = this.pendingTasks.add();
    this.deletingId.set(project.id);
    try {
      await firstValueFrom(this.api.delete(project.id));
      this.projects.reload();
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.actionError.set(`${project.title} had already been deleted.`);
        this.projects.reload();
      } else {
        this.actionError.set(`${project.title} could not be deleted. Please try again.`);
      }
    } finally {
      this.deletingId.set(null);
      this.confirmingDeleteId.set(null);
      done();
    }
  }

  /** Keeps keyboard focus on the control that replaced the one just activated. */
  private focusAfterRender(id: string): void {
    afterNextRender(() => document.getElementById(id)?.focus(), { injector: this.injector });
  }
}
