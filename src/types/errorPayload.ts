/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Represents a single frame in a parsed stack trace.
 */
export type StackFrame = {
  /** Function name, or null if anonymous */
  functionName: string | null;
  /** File path or URL where the error occurred */
  fileName: string;
  /** Line number in the source file */
  lineNumber: number;
  /** Column number in the source file */
  columnNumber: number;
  /** Whether this frame references local project source code */
  isLocalSource: boolean;
  /** Original unparsed stack frame string */
  raw?: string;
};

/**
 * Core error diagnostic payload structure.
 * This is the standardized format for all runtime errors captured during local development.
 */
export type ErrorDiagnosticPayload = {
  /** Unique identifier for this error instance (UUID v4) */
  errorId: string;

  /** ISO 8601 timestamp when the error was captured */
  timestamp: string;

  /** Detailed error information */
  error: {
    /** Error message */
    message: string;
    /** Error type (TypeError, ReferenceError, SyntaxError, etc.) */
    name: string;
    /** Full stack trace as a string */
    stack: string;
    /** Parsed and sanitized stack frames */
    sanitizedStack: StackFrame[];
    /** Error code if available */
    code?: string;
  };

  /** LWC component context information */
  component: {
    /** Component name (e.g., 'c-hello-world', 'myNamespace-my-component') */
    name: string | null;
    /** Component namespace (e.g., 'c', 'myNamespace') */
    namespace: string | null;
    /** Custom element tag name (e.g., 'c-hello-world') */
    tagName: string | null;
    /** Lifecycle hook where error occurred (if detectable) */
    lifecycle: string | null;
    /** Local file path to the component source */
    filePath: string | null;
  };

  /** Runtime environment context */
  runtime: {
    /** Browser user agent string */
    userAgent: string;
    /** Viewport dimensions */
    viewport: {
      width: number;
      height: number;
    };
    /** Current page URL */
    url: string;
    /** LWC framework version if detectable */
    lwcVersion: string | null;
    /** Development mode indicator */
    isDevelopment: boolean;
  };

  /** Component state at time of error (limited to prevent circular refs) */
  state: {
    /** Public properties/attributes (sanitized, max depth 3) */
    props: Record<string, unknown> | null;
    /** Public property names */
    publicProperties: string[];
    /** Whether component was connected to DOM */
    isConnected: boolean;
  };

  /** Precise error location in source code */
  source: {
    /** Source file name */
    fileName: string | null;
    /** Line number where error occurred */
    lineNumber: number | null;
    /** Column number where error occurred */
    columnNumber: number | null;
  };

  /** Additional metadata */
  metadata: {
    /** Error severity level */
    severity: 'error' | 'warning' | 'fatal';
    /** Whether error was handled by a boundary */
    wasHandled: boolean;
    /** Number of times this error occurred (for deduplication) */
    occurrenceCount: number;
    /** Tags for categorization */
    tags: string[];
  };
};

/**
 * Simplified error payload for transmission over network.
 * Excludes redundant data to minimize payload size.
 */
export type ErrorPayloadDTO = {
  errorId: string;
  timestamp: string;
  error: {
    message: string;
    name: string;
    stack: string;
  };
  component: {
    name: string | null;
    tagName: string | null;
    lifecycle: string | null;
  };
  source: {
    fileName: string | null;
    lineNumber: number | null;
    columnNumber: number | null;
  };
  metadata: {
    severity: 'error' | 'warning' | 'fatal';
  };
};

/**
 * Configuration options for error capture system
 */
export type ErrorCaptureConfig = {
  /** Whether to capture errors */
  enabled: boolean;
  /** Local dev server URL */
  serverUrl: string;
  /** Whether to log errors to console */
  logToConsole: boolean;
  /** Maximum stack trace depth to capture */
  maxStackDepth: number;
  /** Maximum number of errors to store in memory */
  maxStoredErrors: number;
  /** Debounce time for duplicate errors (ms) */
  debounceTime: number;
};

/**
 * Type guard to check if an error is an Error object
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error || (typeof error === 'object' && error !== null && 'message' in error);
}

/**
 * Type guard to check if a payload is a valid ErrorDiagnosticPayload
 */
export function isValidErrorPayload(payload: unknown): payload is ErrorDiagnosticPayload {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const p = payload as Partial<ErrorDiagnosticPayload>;

  return (
    typeof p.errorId === 'string' &&
    typeof p.timestamp === 'string' &&
    typeof p.error === 'object' &&
    p.error !== null &&
    typeof p.error.message === 'string' &&
    typeof p.error.name === 'string' &&
    Array.isArray(p.error.sanitizedStack)
  );
}
