export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND'

  constructor(message = 'Recurso no encontrado') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR'

  constructor(message = 'Los datos enviados no son válidos') {
    super(message)
    this.name = 'ValidationError'
  }
}
