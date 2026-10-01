import { Component } from '@angular/core';
import { ComingSoon } from '../../../shared/coming-soon/coming-soon';

@Component({
  selector: 'app-contact',
  imports: [ComingSoon],
  template: `<app-coming-soon
    eyebrow="Get in touch"
    heading="Contact"
    summary="A contact form for recruiters and collaborators will be available here."
  />`,
})
export class Contact {}
