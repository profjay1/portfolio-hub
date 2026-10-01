import { Component } from '@angular/core';

interface SkillGroup {
  readonly name: string;
  readonly summary: string;
  readonly skills: readonly string[];
}

@Component({
  selector: 'app-skills',
  templateUrl: './skills.html',
  styleUrl: './skills.css',
})
export class Skills {
  protected readonly groups: readonly SkillGroup[] = [
    {
      name: 'Backend',
      summary: 'Services that are modular, observable, and easy to change.',
      skills: ['Java 21', 'Spring Boot', 'Spring Modulith', 'Spring Security', 'REST API design'],
    },
    {
      name: 'Frontend',
      summary: 'Accessible, typed interfaces built on modern Angular.',
      skills: ['Angular', 'TypeScript', 'Signals', 'RxJS', 'Semantic HTML and CSS'],
    },
    {
      name: 'Data',
      summary: 'Schemas that protect invariants and evolve safely.',
      skills: ['PostgreSQL', 'SQL', 'Flyway migrations', 'Testcontainers'],
    },
    {
      name: 'Delivery and operations',
      summary: 'Automated paths from commit to production.',
      skills: ['Docker', 'GitHub Actions', 'Ansible', 'Terraform', 'Caddy', 'Linux'],
    },
    {
      name: 'Practices',
      summary: 'Habits that keep a codebase healthy over time.',
      skills: [
        'Test-driven development',
        'Code review',
        'Architecture decision records',
        'Accessibility',
      ],
    },
  ];
}
