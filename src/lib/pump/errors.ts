/**
 * An error whose message is safe, and useful, to show the user.
 *
 * Anything else thrown out of a route is logged and reported generically,
 * since it may carry RPC endpoints or upstream credentials.
 */
export class LaunchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LaunchError";
  }
}
