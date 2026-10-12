/** Where a signed-in admin goes when there is no (safe) page to return to. */
export const DEFAULT_DESTINATION = '/admin/projects';

/**
 * Where to go after signing in. Only admin pages qualify, never the login page itself (a loop), and nothing that could
 * be read as another origin. Router.navigateByUrl cannot leave the app, so this is defence in depth: the value comes
 * from the query string, which anyone can write into a link. Shared by the login page and the login route's guard.
 */
export function safeReturnUrl(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith('/admin/') ||
    value.startsWith('/admin/login') ||
    value.includes('//') ||
    value.includes('\\')
  ) {
    return DEFAULT_DESTINATION;
  }
  return value;
}
