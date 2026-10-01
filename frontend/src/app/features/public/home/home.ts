import { httpResource } from '@angular/common/http';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Ping } from './ping';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  // Relative URL: the dev proxy (and Caddy in production) keeps the API on the same origin.
  protected readonly ping = httpResource<Ping>(() => '/api/v1/ping');

  protected readonly focusAreas = [
    {
      title: 'Backend systems',
      body: 'Modular services in Java and Spring Boot with clear boundaries, solid persistence, and APIs that are easy to consume and evolve.',
    },
    {
      title: 'Web applications',
      body: 'Fast, accessible Angular front ends built with signals and typed contracts, tested through the behaviour users actually see.',
    },
    {
      title: 'Delivery and operations',
      body: 'Automated pipelines, containers, and infrastructure as code, so shipping a change is routine and recovering from one is quick.',
    },
  ] as const;
}
