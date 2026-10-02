/** Item of GET /api/v1/projects. Hand-typed until the OpenAPI client is generated into api/generated. */
export interface PublicProject {
  readonly id: number;
  readonly title: string;
  readonly description: string | null;
  readonly url: string | null;
  readonly imageUrl: string | null;
  readonly displayOrder: number;
}
