// MCP 统一错误类型：服务层抛出，MCP 协议层映射为 JSON-RPC error
export type McpErrorCode =
  | 'UNAUTHORIZED'
  | 'PERMISSION_DENIED'
  | 'INVALID_ARGUMENT'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

export class McpError extends Error {
  code: McpErrorCode;
  details?: Record<string, unknown>;

  constructor(code: McpErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.name = 'McpError';
    this.details = details;
  }
}

export function isMcpError(e: unknown): e is McpError {
  return e instanceof McpError;
}
