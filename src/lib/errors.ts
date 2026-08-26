/**
 * Erros de domínio tipados, para que a camada HTTP possa mapear cada um para
 * o status code correcto sem `instanceof Error` genérico espalhado pelo código.
 */
export class DomainError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super("NOT_FOUND", `${entity} não encontrado: ${id}`, 404);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message, 422);
  }
}

export class ConfigurationError extends DomainError {
  constructor(message: string) {
    super("CONFIGURATION_ERROR", message, 500);
  }
}

export class ExternalServiceError extends DomainError {
  constructor(service: string, message: string) {
    super("EXTERNAL_SERVICE_ERROR", `[${service}] ${message}`, 502);
  }
}

export class SignatureVerificationError extends DomainError {
  constructor(message = "Assinatura do webhook inválida") {
    super("INVALID_SIGNATURE", message, 401);
  }
}
