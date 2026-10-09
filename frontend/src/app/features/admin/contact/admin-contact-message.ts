/**
 * Item of GET /api/v1/admin/contact, newest first. Hand-typed until the OpenAPI client is generated into api/generated.
 * Holds personal data: never log it.
 */
export interface AdminContactMessage {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly message: string;
  /** ISO-8601 instant, UTC. */
  readonly createdAt: string;
  readonly read: boolean;
}
