/**
 * Problem Details body for a 400 from the backend's validation (see ProblemDetailsAdvice). Lives in core because both
 * the public contact form and the admin project form map it onto their fields.
 */
export interface ValidationProblem {
  readonly errors: readonly { readonly field: string; readonly message: string }[];
}

export function isValidationProblem(body: unknown): body is ValidationProblem {
  return (
    typeof body === 'object' &&
    body !== null &&
    Array.isArray((body as { errors?: unknown }).errors)
  );
}
