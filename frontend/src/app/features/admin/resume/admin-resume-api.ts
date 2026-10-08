import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ResumeUpload } from './resume-upload';

export const ADMIN_RESUME_URL = '/api/v1/admin/resume';

/**
 * Writes to the admin resume API; the history is read through httpResource in the component. Relative URL keeps the
 * request same-origin, so HttpClient attaches the X-XSRF-TOKEN header the backend requires (ADR 0006).
 */
@Injectable({ providedIn: 'root' })
export class AdminResumeApi {
  private readonly http = inject(HttpClient);

  /**
   * No progress events: the app uses the Fetch backend, which cannot report upload progress (Angular's
   * reportUploadProgress throws NG02824 there), so the screen shows an indeterminate bar instead.
   */
  upload(file: File): Observable<ResumeUpload> {
    const body = new FormData();
    // "file" is the multipart part name the backend's @RequestPart expects.
    body.append('file', file, file.name);
    return this.http.post<ResumeUpload>(ADMIN_RESUME_URL, body);
  }
}
