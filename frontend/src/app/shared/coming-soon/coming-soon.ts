import { Component, input } from '@angular/core';

/** Placeholder for public pages whose content ships with their backend slice. */
@Component({
  selector: 'app-coming-soon',
  template: `
    <section class="page-intro">
      <p class="eyebrow">{{ eyebrow() }}</p>
      <h1>{{ heading() }}</h1>
      <p class="lede">Coming soon. {{ summary() }}</p>
    </section>
  `,
})
export class ComingSoon {
  readonly eyebrow = input.required<string>();
  readonly heading = input.required<string>();
  readonly summary = input.required<string>();
}
