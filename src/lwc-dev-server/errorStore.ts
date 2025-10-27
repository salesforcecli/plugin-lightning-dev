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

import { ErrorDiagnosticPayload } from '../types/errorPayload.js';

/**
 * Statistics about errors in the store
 */
export type ErrorStatistics = {
  totalErrors: number;
  totalOccurrences: number;
  byComponent: Record<string, number>;
  bySeverity: Record<string, number>;
};

/**
 * In-memory error store for runtime errors captured during LWC development.
 *
 * Features:
 * - Maintains insertion order
 * - Deduplicates errors with same signature (increments occurrenceCount)
 * - Supports max size limit (FIFO eviction)
 * - Provides filtering and statistics
 */
export class ErrorStore {
  private errors: Map<string, ErrorDiagnosticPayload> = new Map();
  private maxSize: number;

  /**
   * Creates a new error store
   *
   * @param maxSize - Maximum number of unique errors to store (default: 1000)
   */
  public constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Generates a signature for an error based on its key characteristics.
   * Used to identify duplicate errors.
   *
   * @param error - Error diagnostic payload
   * @returns Signature string
   */
  private static getErrorSignature(error: ErrorDiagnosticPayload): string {
    const componentName = error.component.name ?? 'unknown';
    const fileName = error.source.fileName ?? 'unknown';
    const lineNumber = error.source.lineNumber ?? 0;
    return `${error.error.message}|${componentName}|${fileName}|${lineNumber}`;
  }

  /**
   * Adds an error to the store.
   * If an error with the same signature exists, increments its occurrence count.
   * If max size is reached, removes the oldest error (FIFO).
   *
   * @param error - Error diagnostic payload
   */
  public addError(error: ErrorDiagnosticPayload): void {
    const signature = ErrorStore.getErrorSignature(error);
    const existing = this.findErrorBySignature(signature);

    if (existing) {
      // Increment occurrence count for duplicate error
      existing.metadata.occurrenceCount++;
      existing.timestamp = error.timestamp; // Update to latest timestamp
    } else {
      // Add new error
      if (this.errors.size >= this.maxSize) {
        // Remove oldest error (first entry)
        const firstKey = this.errors.keys().next().value as string | undefined;
        if (firstKey) {
          this.errors.delete(firstKey);
        }
      }
      this.errors.set(error.errorId, error);
    }
  }

  /**
   * Gets an error by its ID
   *
   * @param errorId - Unique error identifier
   * @returns Error or undefined if not found
   */
  public getError(errorId: string): ErrorDiagnosticPayload | undefined {
    return this.errors.get(errorId);
  }

  /**
   * Gets all errors in insertion order
   *
   * @returns Array of all errors
   */
  public getErrors(): ErrorDiagnosticPayload[] {
    return Array.from(this.errors.values());
  }

  /**
   * Gets errors filtered by component name
   *
   * @param componentName - Component name to filter by
   * @returns Array of matching errors
   */
  public getErrorsByComponent(componentName: string): ErrorDiagnosticPayload[] {
    return this.getErrors().filter((error) => error.component.name === componentName);
  }

  /**
   * Gets errors filtered by severity
   *
   * @param severity - Severity level to filter by
   * @returns Array of matching errors
   */
  public getErrorsBySeverity(severity: string): ErrorDiagnosticPayload[] {
    return this.getErrors().filter((error) => error.metadata.severity === severity);
  }

  /**
   * Gets the N most recent errors
   *
   * @param count - Number of errors to retrieve
   * @returns Array of most recent errors
   */
  public getRecentErrors(count: number): ErrorDiagnosticPayload[] {
    const errors = this.getErrors();
    return errors.slice(-count);
  }

  /**
   * Clears all errors from the store
   */
  public clearErrors(): void {
    this.errors.clear();
  }

  /**
   * Gets the count of unique errors in the store
   *
   * @returns Number of errors
   */
  public getErrorCount(): number {
    return this.errors.size;
  }

  /**
   * Gets statistics about errors in the store
   *
   * @returns Statistics object
   */
  public getStatistics(): ErrorStatistics {
    const errors = this.getErrors();
    const stats: ErrorStatistics = {
      totalErrors: errors.length,
      totalOccurrences: 0,
      byComponent: {},
      bySeverity: {},
    };

    for (const error of errors) {
      stats.totalOccurrences += error.metadata.occurrenceCount;

      // Count by component (use 'unknown' for null component names)
      const componentName = error.component.name ?? 'unknown';
      stats.byComponent[componentName] = (stats.byComponent[componentName] || 0) + 1;

      // Count by severity
      const severity = error.metadata.severity;
      stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1;
    }

    return stats;
  }

  /**
   * Exports all errors as JSON
   *
   * @returns JSON string of all errors
   */
  public exportAsJSON(): string {
    return JSON.stringify(this.getErrors(), null, 2);
  }

  /**
   * Imports errors from JSON string
   *
   * @param json - JSON string containing errors
   * @returns Number of errors imported
   */
  public importFromJSON(json: string): number {
    try {
      const errors = JSON.parse(json) as ErrorDiagnosticPayload[];
      if (!Array.isArray(errors)) {
        return 0;
      }

      for (const error of errors) {
        this.addError(error);
      }

      return errors.length;
    } catch {
      return 0;
    }
  }

  /**
   * Finds an error with the same signature
   *
   * @param signature - Error signature to search for
   * @returns Matching error or undefined
   */
  private findErrorBySignature(signature: string): ErrorDiagnosticPayload | undefined {
    for (const error of this.errors.values()) {
      if (ErrorStore.getErrorSignature(error) === signature) {
        return error;
      }
    }
    return undefined;
  }
}

/**
 * Singleton error store instance
 */
let errorStoreInstance: ErrorStore | null = null;

/**
 * Gets the singleton error store instance
 *
 * @returns Error store instance
 */
export function getErrorStore(): ErrorStore {
  if (!errorStoreInstance) {
    errorStoreInstance = new ErrorStore();
  }
  return errorStoreInstance;
}

/**
 * Resets the singleton error store instance (useful for testing)
 */
export function resetErrorStore(): void {
  errorStoreInstance = null;
}
