import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

export function json(
  statusCode: number,
  body: unknown
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function ok(body: unknown) {
  return json(200, body);
}

export function created(body: unknown) {
  return json(201, body);
}

export function notFound(message = "Recurso não encontrado.") {
  return json(404, { error: message });
}

export function forbidden(message = "Acesso negado.") {
  return json(403, { error: message });
}

export function badRequest(message: string) {
  return json(400, { error: message });
}

export function conflict(message: string) {
  return json(409, { error: message });
}

export function serverError(err: unknown) {
  console.error(err);
  return json(500, { error: "Erro interno." });
}
