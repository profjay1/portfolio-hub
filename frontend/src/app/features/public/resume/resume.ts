import { Component } from '@angular/core';
import { ComingSoon } from '../../../shared/coming-soon/coming-soon';

@Component({
  selector: 'app-resume',
  imports: [ComingSoon],
  template: `<app-coming-soon
    eyebrow="Experience"
    heading="Resume"
    summary="A downloadable PDF resume will be available here."
  />`,
})
export class Resume {}
