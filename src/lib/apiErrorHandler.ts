/**
 * API 错误处理和恢复策略
 */

export interface ApiError {
  code: string;
  message: string;
  status?: number;
  isRetryable: boolean;
  retryAfter?: number;
}

export class ApiErrorHandler {
  static parseError(error: unknown): ApiError {
    if (error && typeof error === "object" && "code" in error && "isRetryable" in error) {
      return {
        code: (error as any).code,
        message: (error as any).message || "Unknown error",
        status: (error as any).status,
        isRetryable: (error as any).isRetryable ?? false,
      };
    }

    if (error instanceof TypeError) {
      return { code: "NETWORK_ERROR", message: error.message || "Network request failed", isRetryable: true };
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      return { code: "TIMEOUT", message: "Request timeout", isRetryable: true, retryAfter: 2000 };
    }

    return {
      code: "UNKNOWN_ERROR",
      message: error instanceof Error ? error.message : String(error),
      isRetryable: false,
    };
  }

  static getUserMessage(error: ApiError): string {
    const messages: Record<string, string> = {
      NETWORK_ERROR: "网络连接失败，请检查你的网络连接。系统将自动重试。",
      TIMEOUT: "请求超时，系统将自动重试。请稍候...",
      ENV_MISSING: "应用配置不完整，请联系管理员。",
      NO_RESPONSE_BODY: "服务器响应异常，请稍后重试。",
      HTTP_500: "服务器出错，我们正在修复。请稍后重试。",
      HTTP_502: "服务暂时不可用，请稍后重试。",
      HTTP_503: "服务维护中，请稍后重试。",
      HTTP_429: "请求过于频繁，请稍后再试。",
      HTTP_401: "认证失败，请重新登录。",
      HTTP_403: "权限不足。",
      HTTP_404: "资源不存在。",
      STREAM_ABORTED: "请求被中断，请重试。",
    };

    return messages[error.code] || messages[`HTTP_${error.status}`] || "发生错误，请稍后重试。";
  }

  static logError(context: string, error: ApiError, additionalInfo?: Record<string, unknown>): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      context,
      code: error.code,
      message: error.message,
      status: error.status,
      isRetryable: error.isRetryable,
      ...additionalInfo,
    };
    console.error(`[${context}] Error:`, logEntry);
  }
}
