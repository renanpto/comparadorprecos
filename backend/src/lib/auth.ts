import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";

export class UnauthorizedError extends Error {}

export function getUserId(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  const sub = event.requestContext.authorizer?.jwt?.claims?.sub;
  if (!sub || typeof sub !== "string") {
    throw new UnauthorizedError("Token sem claim 'sub'.");
  }
  return sub;
}
