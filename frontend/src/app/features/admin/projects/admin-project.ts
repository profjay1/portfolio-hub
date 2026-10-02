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
