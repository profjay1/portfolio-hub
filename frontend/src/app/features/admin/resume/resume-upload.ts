/** Item of GET /api/v1/admin/resume. Hand-typed until the OpenAPI client is generated into api/generated. */
export interface ResumeUpload {
  readonly id: number;
  readonly filename: string;
  /** ISO-8601 instant, UTC. */
  readonly uploadedAt: string;
  /** Exactly one upload is active: the one visitors download. */
  readonly active: boolean;
}
