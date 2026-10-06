import { Component } from '@angular/core';

/**
 * A plain link rather than an HTTP call: the browser streams the PDF straight to disk and names it from the
 * server's Content-Disposition. `download` keeps visitors on this page if the request fails (for example the 404
 * before the first upload): the browser reports a failed download instead of navigating to the error body.
 */
@Component({
  selector: 'app-resume',
  templateUrl: './resume.html',
  styleUrl: './resume.css',
})
export class Resume {
  protected readonly downloadUrl = '/api/v1/resume/download';
}
