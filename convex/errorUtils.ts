/**
 * Centralized error handling utilities for WhatsApp integration and campaigns
 */

export interface WhatsAppErrorCode {
  code: number;
  name: string;
  category: ErrorCategory;
  retryable: boolean;
  description: string;
  suggestedAction: string;
}

export type ErrorCategory = 
  | "PHONE_NOT_ALLOWED"
  | "TEMPLATE_FORMAT"
  | "RATE_LIMIT"
  | "INVALID_TEMPLATE"
  | "INVALID_PHONE"
  | "NETWORK_ERROR"
  | "AUTH_ERROR"
  | "MEDIA_ERROR"
  | "OTHER";

/**
 * Comprehensive WhatsApp error code reference
 * Source: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
export const WHATSAPP_ERROR_CODES: Record<number, WhatsAppErrorCode> = {
  // Phone number errors
  131000: {
    code: 131000,
    name: "Invalid recipient type",
    category: "PHONE_NOT_ALLOWED",
    retryable: false,
    description: "Recipient is not a valid WhatsApp user",
    suggestedAction: "Verify the phone number format and ensure it's registered on WhatsApp",
  },
  131001: {
    code: 131001,
    name: "Invalid phone format",
    category: "INVALID_PHONE",
    retryable: false,
    description: "Phone number format is invalid",
    suggestedAction: "Ensure phone number includes country code without + symbol (e.g., 201234567890)",
  },
  131002: {
    code: 131002,
    name: "Message type not supported",
    category: "TEMPLATE_FORMAT",
    retryable: false,
    description: "The message type is not supported",
    suggestedAction: "Use supported message types: text, image, video, document, template",
  },
  131030: {
    code: 131030,
    name: "Recipient not in allowed list",
    category: "PHONE_NOT_ALLOWED",
    retryable: false,
    description: "Recipient phone number not in allowed list (test mode)",
    suggestedAction: "Add phone number to WhatsApp test list in Facebook Developer Portal",
  },
  131045: {
    code: 131045,
    name: "Message rejected",
    category: "OTHER",
    retryable: true,
    description: "Message was rejected by WhatsApp",
    suggestedAction: "Retry after a short delay or contact WhatsApp support",
  },
  131053: {
    code: 131053,
    name: "Media upload error",
    category: "MEDIA_ERROR",
    retryable: false,
    description: "WhatsApp failed to download media from the provided URL (403 Forbidden or expired link)",
    suggestedAction: "For carousel templates, do not include header parameters - WhatsApp uses the template's original media. For dynamic media, upload via POST /media endpoint and use media IDs",
  },
  
  // Template errors
  132000: {
    code: 132000,
    name: "Template error",
    category: "INVALID_TEMPLATE",
    retryable: false,
    description: "Generic template error",
    suggestedAction: "Verify template exists and is approved",
  },
  132001: {
    code: 132001,
    name: "Template not in translation",
    category: "INVALID_TEMPLATE",
    retryable: false,
    description: "Template name does not exist in the requested language",
    suggestedAction: "Use a template name and language that exist in your WABA. In Meta Business Manager, check Templates and ensure the template is approved for the language you send (e.g. en, ar).",
  },
  132012: {
    code: 132012,
    name: "Parameter format mismatch",
    category: "TEMPLATE_FORMAT",
    retryable: false,
    description: "Template parameters don't match the template format",
    suggestedAction: "Ensure template parameters match the defined components (header, body, footer)",
  },
  132014: {
    code: 132014,
    name: "Template suspended",
    category: "INVALID_TEMPLATE",
    retryable: false,
    description: "Template has been suspended",
    suggestedAction: "Review WhatsApp policies, create a new template",
  },
  132015: {
    code: 132015,
    name: "Template rejected",
    category: "INVALID_TEMPLATE",
    retryable: false,
    description: "Template was rejected during approval",
    suggestedAction: "Review rejection reason and submit a new template",
  },

  // Rate limit and quota errors
  80005: {
    code: 80005,
    name: "Message rate limit",
    category: "RATE_LIMIT",
    retryable: true,
    description: "Message rate limit exceeded",
    suggestedAction: "Implement exponential backoff; wait before retrying",
  },
  200: {
    code: 200,
    name: "Unsupported get request",
    category: "RATE_LIMIT",
    retryable: true,
    description: "API request throttled",
    suggestedAction: "Implement rate limiting; retry with exponential backoff",
  },
  368: {
    code: 368,
    name: "Temporary throttle",
    category: "RATE_LIMIT",
    retryable: true,
    description: "Temporarily throttled from making this request",
    suggestedAction: "Wait a few minutes before retrying",
  },
  130429: {
    code: 130429,
    name: "Rate limit exceeded",
    category: "RATE_LIMIT",
    retryable: true,
    description: "Message throughput limit exceeded (80 msgs/sec default)",
    suggestedAction: "Slow down sending rate and retry with exponential backoff",
  },

  // Auth errors
  10: {
    code: 10,
    name: "Permission denied",
    category: "AUTH_ERROR",
    retryable: false,
    description: "Application does not have permission for this action",
    suggestedAction: "Check WhatsApp Business API permissions in Meta Business Suite",
  },
  190: {
    code: 190,
    name: "Invalid OAuth access token",
    category: "AUTH_ERROR",
    retryable: false,
    description: "Access token is invalid, expired, or app is deleted/unlinked",
    suggestedAction: "Reconnect your WhatsApp number in Integrations and replace the access token from the active Meta app.",
  },
  401: {
    code: 401,
    name: "Unauthorized",
    category: "AUTH_ERROR",
    retryable: false,
    description: "Invalid access token or permissions",
    suggestedAction: "Verify WhatsApp access token and permissions",
  },
  403: {
    code: 403,
    name: "Forbidden",
    category: "AUTH_ERROR",
    retryable: false,
    description: "Insufficient permissions",
    suggestedAction: "Ensure account has correct WhatsApp Business API permissions",
  },

  // Network errors
  500: {
    code: 500,
    name: "Internal server error",
    category: "NETWORK_ERROR",
    retryable: true,
    description: "WhatsApp server error",
    suggestedAction: "Retry with exponential backoff",
  },
  502: {
    code: 502,
    name: "Bad gateway",
    category: "NETWORK_ERROR",
    retryable: true,
    description: "Gateway error",
    suggestedAction: "Retry with exponential backoff",
  },
  503: {
    code: 503,
    name: "Service unavailable",
    category: "NETWORK_ERROR",
    retryable: true,
    description: "Service temporarily unavailable",
    suggestedAction: "Retry with exponential backoff",
  },
};

/**
 * Categorizes and analyzes a WhatsApp API error response
 */
export function categorizeWhatsAppError(
  errorCode: number,
  errorMessage: string
): WhatsAppErrorCode {
  return WHATSAPP_ERROR_CODES[errorCode] || {
    code: errorCode,
    name: "Unknown error",
    category: "OTHER",
    retryable: true,
    description: errorMessage || "Unknown WhatsApp API error",
    suggestedAction: "Review error message and retry",
  };
}

/**
 * Structured error for WhatsApp API failures
 */
export class WhatsAppAPIError extends Error {
  constructor(
    public code: number,
    public category: ErrorCategory,
    public retryable: boolean,
    public rawError: any,
    message: string
  ) {
    super(message);
    this.name = "WhatsAppAPIError";
    Object.setPrototypeOf(this, WhatsAppAPIError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      retryable: this.retryable,
      message: this.message,
      rawError: this.rawError,
    };
  }
}

/**
 * Validates and formats a phone number for WhatsApp
 * Returns cleaned number or throws error
 */
export function validateAndCleanPhoneNumber(phoneNumber: string): string {
  // Remove all non-digits
  const cleaned = phoneNumber.replace(/\D/g, '');

  // Validate minimum length
  if (!cleaned || cleaned.length < 7) {
    throw new Error(
      `Invalid phone number format: "${phoneNumber}". Minimum 7 digits required.`
    );
  }

  // Check for suspicious patterns
  if (cleaned.length > 15) {
    throw new Error(
      `Invalid phone number format: "${phoneNumber}". Maximum 15 digits allowed.`
    );
  }

  return cleaned;
}

/**
 * Formats a phone number for display
 */
export function formatPhoneNumberForDisplay(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/\D/g, '');

  // Format with country code if detectable
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    // US format: +1 (XXX) XXX-XXXX
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  // International format: +XXX XXX XXX
  if (cleaned.length > 7) {
    const countryCode = cleaned.slice(0, cleaned.length - 7);
    const areaCode = cleaned.slice(-7, -4);
    const phone = cleaned.slice(-4);
    return `+${countryCode} ${areaCode} ${phone}`;
  }

  return `+${cleaned}`;
}

/**
 * Creates a detailed error report for logging
 */
export interface ErrorReport {
  timestamp: number;
  category: ErrorCategory;
  code: number;
  message: string;
  retryable: boolean;
  contact?: string;
  campaignId?: string;
  suggestedAction: string;
  details: Record<string, any>;
}

/**
 * Creates a detailed error report for logging and debugging.
 * 
 * This function ensures that error category is always set by:
 * 1. Using the error's existing category if valid
 * 2. Falling back to centralized error categorization based on code
 * 3. Attempting to extract category from error message if it contains JSON
 * 4. Defaulting to "OTHER" if no category can be determined
 */
export function createErrorReport(
  error: Error & { code?: number; category?: string; retryable?: boolean },
  context?: {
    contact?: string;
    campaignId?: string;
    [key: string]: any;
  }
): ErrorReport {
  const errorCode = error.code || 0;
  const errorInfo = categorizeWhatsAppError(errorCode, error.message);

  // Determine category with multiple fallbacks to ensure it's never undefined
  let category: ErrorCategory = errorInfo.category;
  
  // Use error's category if it's a valid ErrorCategory
  if (error.category && isValidErrorCategory(error.category)) {
    category = error.category as ErrorCategory;
  }
  
  // Try to extract category from message if it contains JSON (Convex action boundary case)
  if (category === "OTHER" && error.message) {
    const categoryMatch = error.message.match(/"category"\s*:\s*"([^"]+)"/);
    if (categoryMatch && isValidErrorCategory(categoryMatch[1])) {
      category = categoryMatch[1] as ErrorCategory;
    }
  }

  return {
    timestamp: Date.now(),
    category,
    code: errorCode,
    message: error.message,
    retryable: error.retryable !== undefined ? error.retryable : errorInfo.retryable,
    contact: context?.contact,
    campaignId: context?.campaignId,
    suggestedAction: errorInfo.suggestedAction,
    details: context || {},
  };
}

/**
 * Type guard to check if a string is a valid ErrorCategory
 */
function isValidErrorCategory(category: string): category is ErrorCategory {
  const validCategories: ErrorCategory[] = [
    "PHONE_NOT_ALLOWED",
    "TEMPLATE_FORMAT",
    "RATE_LIMIT",
    "INVALID_TEMPLATE",
    "INVALID_PHONE",
    "NETWORK_ERROR",
    "AUTH_ERROR",
    "MEDIA_ERROR",
    "OTHER"
  ];
  return validCategories.includes(category as ErrorCategory);
}

/**
 * Should we retry this error?
 */
export function shouldRetry(error: Error & { retryable?: boolean; code?: number }): boolean {
  if (error.retryable !== undefined) {
    return error.retryable;
  }

  const errorCode = error.code || 0;
  const errorInfo = categorizeWhatsAppError(errorCode, error.message);
  return errorInfo.retryable;
}
