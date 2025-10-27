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

import { ErrorDiagnosticPayload, StackFrame } from '../types/errorPayload.js';
import { filterLocalFrames } from './stackTraceUtils.js';

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
};

/**
 * Formats an error diagnostic payload for CLI display with colors and structure
 *
 * @param error - Error diagnostic payload to format
 * @param options - Formatting options
 * @returns Formatted string ready for console output
 */
export function formatErrorForCLI(error: ErrorDiagnosticPayload, options: FormatterOptions = {}): string {
  const { showFullStack = false, colorize = true, compact = false } = options;

  const c = colorize ? COLORS : createNoColorPalette();

  const lines: string[] = [];

  // Header with severity badge
  const severityBadge = getSeverityBadge(error.metadata.severity, c);
  const timestamp = new Date(error.timestamp).toLocaleTimeString();

  lines.push('');
  lines.push(`${severityBadge} ${c.bright}${error.error.name}${c.reset} ${c.gray}[${timestamp}]${c.reset}`);

  // Error message
  lines.push(`${c.red}${error.error.message}${c.reset}`);
  lines.push('');

  // Component context (if available)
  if (error.component.name) {
    lines.push(`${c.cyan}Component:${c.reset} ${c.bright}${error.component.name}${c.reset}`);
    if (error.component.lifecycle) {
      lines.push(`${c.cyan}Lifecycle:${c.reset} ${error.component.lifecycle}`);
    }
    lines.push('');
  }

  // Source location
  if (error.source.fileName) {
    const location = `${error.source.fileName}:${String(error.source.lineNumber ?? 0)}:${String(
      error.source.columnNumber ?? 0
    )}`;
    lines.push(`${c.cyan}Location:${c.reset} ${location}`);
    lines.push('');
  }

  // Stack trace
  if (!compact) {
    const frames = showFullStack ? error.error.sanitizedStack : filterLocalFrames(error.error.sanitizedStack);

    if (frames.length > 0) {
      lines.push(`${c.cyan}Stack Trace:${c.reset}`);
      frames.forEach((frame, index) => {
        lines.push(formatStackFrameForCLI(frame, index, c));
      });

      if (!showFullStack && error.error.sanitizedStack.length > frames.length) {
        const hiddenCount = error.error.sanitizedStack.length - frames.length;
        lines.push(`${c.gray}  ... ${hiddenCount} more frames (framework/library code)${c.reset}`);
      }
      lines.push('');
    }
  }

  // Occurrence count if > 1
  if (error.metadata.occurrenceCount > 1) {
    lines.push(
      `${c.yellow}⚠${c.reset}  ${c.gray}This error occurred ${c.bright}${error.metadata.occurrenceCount}${c.reset}${c.gray} times${c.reset}`
    );
    lines.push('');
  }

  // Separator
  lines.push(`${c.gray}${'─'.repeat(80)}${c.reset}`);

  return lines.join('\n');
}

/**
 * Formats a stack frame for CLI display
 */
function formatStackFrameForCLI(frame: StackFrame, index: number, colors: ColorPalette): string {
  const funcName = frame.functionName ?? '<anonymous>';
  const location = `${frame.fileName}:${String(frame.lineNumber)}:${String(frame.columnNumber)}`;

  if (frame.isLocalSource) {
    return `  ${colors.gray}${index + 1}.${colors.reset} ${colors.bright}${funcName}${colors.reset} ${
      colors.dim
    }(${location})${colors.reset}`;
  } else {
    return `  ${colors.gray}${index + 1}. ${funcName} (${location})${colors.reset}`;
  }
}

/**
 * Gets a colored severity badge
 */
function getSeverityBadge(severity: 'error' | 'warning' | 'fatal', colors: ColorPalette): string {
  switch (severity) {
    case 'fatal':
      return `${colors.bgRed}${colors.white} FATAL ${colors.reset}`;
    case 'error':
      return `${colors.red}✖${colors.reset}`;
    case 'warning':
      return `${colors.yellow}⚠${colors.reset}`;
    default:
      return '•';
  }
}

/**
 * Formats an error as a compact single-line summary
 *
 * @param error - Error diagnostic payload
 * @param colorize - Whether to use colors
 * @returns Compact formatted string
 */
export function formatErrorCompact(error: ErrorDiagnosticPayload, colorize = true): string {
  const c = colorize ? COLORS : createNoColorPalette();

  const timestamp = new Date(error.timestamp).toLocaleTimeString();
  const component = error.component.name ?? 'unknown';
  const location = error.source.fileName
    ? `${error.source.fileName}:${String(error.source.lineNumber ?? 0)}`
    : 'unknown';

  return `${c.red}✖${c.reset} ${c.bright}${error.error.name}${c.reset}: ${error.error.message} ${c.gray}(${component} @ ${location}) [${timestamp}]${c.reset}`;
}

/**
 * Formats multiple errors as a summary
 *
 * @param errors - Array of error diagnostic payloads
 * @param colorize - Whether to use colors
 * @returns Formatted summary string
 */
export function formatErrorSummary(errors: ErrorDiagnosticPayload[], colorize = true): string {
  const c = colorize ? COLORS : createNoColorPalette();

  if (errors.length === 0) {
    return `${c.green}✓${c.reset} No errors captured`;
  }

  const lines: string[] = [];
  lines.push('');
  lines.push(`${c.bright}Error Summary${c.reset} ${c.gray}(${errors.length} total)${c.reset}`);
  lines.push(`${c.gray}${'─'.repeat(80)}${c.reset}`);
  lines.push('');

  // Group by component
  const byComponent = new Map<string, ErrorDiagnosticPayload[]>();
  for (const error of errors) {
    const componentName = error.component.name ?? 'unknown';
    if (!byComponent.has(componentName)) {
      byComponent.set(componentName, []);
    }
    byComponent.get(componentName)!.push(error);
  }

  // Display grouped errors
  for (const [component, componentErrors] of byComponent) {
    lines.push(`${c.cyan}${component}${c.reset} ${c.gray}(${componentErrors.length} errors)${c.reset}`);
    for (const error of componentErrors.slice(0, 3)) {
      // Show up to 3 per component
      lines.push(`  ${formatErrorCompact(error, colorize)}`);
    }
    if (componentErrors.length > 3) {
      lines.push(`  ${c.gray}... ${componentErrors.length - 3} more errors${c.reset}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Formats error statistics
 *
 * @param stats - Error statistics object
 * @param colorize - Whether to use colors
 * @returns Formatted statistics string
 */
export function formatErrorStatistics(
  stats: {
    totalErrors: number;
    totalOccurrences: number;
    byComponent: Record<string, number>;
    bySeverity: { error: number; warning: number; fatal: number };
  },
  colorize = true
): string {
  const c = colorize ? COLORS : createNoColorPalette();

  const lines: string[] = [];
  lines.push('');
  lines.push(`${c.bright}Error Statistics${c.reset}`);
  lines.push(`${c.gray}${'─'.repeat(80)}${c.reset}`);
  lines.push('');
  lines.push(`Total Errors: ${c.bright}${stats.totalErrors}${c.reset}`);
  lines.push(`Total Occurrences: ${c.bright}${stats.totalOccurrences}${c.reset}`);
  lines.push('');

  lines.push(`${c.cyan}By Severity:${c.reset}`);
  lines.push(`  Fatal: ${c.red}${stats.bySeverity.fatal}${c.reset}`);
  lines.push(`  Error: ${c.yellow}${stats.bySeverity.error}${c.reset}`);
  lines.push(`  Warning: ${c.yellow}${stats.bySeverity.warning}${c.reset}`);
  lines.push('');

  if (Object.keys(stats.byComponent).length > 0) {
    lines.push(`${c.cyan}By Component:${c.reset}`);
    for (const [component, count] of Object.entries(stats.byComponent)) {
      lines.push(`  ${component}: ${c.bright}${count}${c.reset}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Formats an error as JSON for logging systems
 *
 * @param error - Error diagnostic payload
 * @param pretty - Whether to pretty-print JSON
 * @returns JSON string
 */
export function formatErrorAsJSON(error: ErrorDiagnosticPayload, pretty = false): string {
  return JSON.stringify(error, null, pretty ? 2 : 0);
}

/**
 * Creates a color palette with all empty strings (for no-color output)
 */
function createNoColorPalette(): ColorPalette {
  return {
    reset: '',
    bright: '',
    dim: '',
    red: '',
    green: '',
    yellow: '',
    blue: '',
    magenta: '',
    cyan: '',
    white: '',
    gray: '',
    bgRed: '',
    bgYellow: '',
  };
}

/**
 * Formatter options
 */
export type FormatterOptions = {
  /** Whether to show the full stack trace (including framework code) */
  showFullStack?: boolean;
  /** Whether to colorize output */
  colorize?: boolean;
  /** Whether to use compact formatting */
  compact?: boolean;
};

/**
 * Color palette type
 */
type ColorPalette = typeof COLORS;
