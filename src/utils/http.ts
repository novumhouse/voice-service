export function errorResponse(code: number, message: string) {
  return { error: { code, message } };
}

export function okResponse<T>(data: T) {
  return { success: true, data };
}


