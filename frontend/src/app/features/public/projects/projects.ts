import { Component } from '@angular/core';
import { ComingSoon } from '../../../shared/coming-soon/coming-soon';

@Component({
  selector: 'app-projects',
  imports: [ComingSoon],
  template: `<app-coming-soon
    eyebrow="Work"
    heading="Projects"
    summary="Case studies of selected projects, with architecture notes and links to source, will appear here."
  />`,
})
export class Projects {}
