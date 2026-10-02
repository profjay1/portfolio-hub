/** Item of GET /api/v1/admin/projects. Hand-typed until the OpenAPI client is generated into api/generated. */
export interface AdminProject {
  readonly id: number;
  readonly title: string;
  readonly description: string | null;
  readonly url: string | null;
  readonly imageUrl: string | null;
  readonly displayOrder: number;
  readonly published: boolean;
  /** ISO-8601 instant, UTC. */
  readonly createdAt: string;
}

/**
 * Body of POST /api/v1/admin/projects and PUT /api/v1/admin/projects/{id} (a full replace). Blank optional strings
 * are sent as-is: the backend treats blank as absent, so that rule lives in one place.
 */
export interface ProjectRequest {
  readonly title: string;
  readonly description: string;
  readonly url: string;
  readonly imageUrl: string;
  readonly displayOrder: number;
  readonly published: boolean;
}
