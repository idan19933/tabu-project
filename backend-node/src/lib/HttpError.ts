/**
 * @file lib/HttpError.ts
 * @description Custom error class that carries an HTTP status code alongside
 * the standard `Error` message. Thrown by services and data-access layers;
 * caught and serialised by the centralised `errorHandler` middleware.
 */

/**
 * An `Error` subclass that includes an HTTP status code, enabling the
 * centralised error handler to respond with the correct HTTP status.
 *
 * @example
 * throw new HttpError(404, 'Simulation not found');
 */
export class HttpError extends Error {
  /** HTTP status code to be sent in the response (e.g. 400, 404, 500). */
  statusCode: number;

  /**
   * Creates a new `HttpError`.
   *
   * @param statusCode - The HTTP status code for the response.
   * @param message - Human-readable error description.
   */
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'HttpError';
  }
}
