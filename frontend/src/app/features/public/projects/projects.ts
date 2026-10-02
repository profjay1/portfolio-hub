import { httpResource } from '@angular/common/http';
import { Component } from '@angular/core';
import { PublicProject } from './project';

@Component({
  selector: 'app-projects',
  templateUrl: './projects.html',
  styleUrl: './projects.css',
})
export class Projects {
  // The backend already filters to published projects and sorts them; the page keeps that order.
  protected readonly projects = httpResource<PublicProject[]>(() => '/api/v1/projects');
}
