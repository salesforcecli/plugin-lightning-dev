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

import path from 'node:path';
import { StackFrame } from '../types/errorPayload.js';

/**
 * Parses a stack trace string into structured StackFrame objects.
 * Supports Chrome, Firefox, and Safari stack trace formats.
 *
 * @param stack - Raw stack trace string
 * @param projectRoot - Project root directory for determining local sources
 * @returns Array of parsed stack frames
 */
export function parseStackTrace(stack: string, projectRoot?: string): StackFrame[] {
  if (!stack) {
    return [];
  }

  const lines = stack.split('\n');
  const frames: StackFrame[] = [];

  for (const line of lines) {
    const frame = parseStackFrame(line, projectRoot);
    if (frame) {
      frames.push(frame);
    }
  }

  return frames;
}

/**
 * Parses a single line of a stack trace into a StackFrame.
 * Handles multiple browser formats.
 *
 * @param line - Single line from stack trace
 * @param projectRoot - Project root directory
 * @returns Parsed StackFrame or null if parsing fails
 */
export function parseStackFrame(line: string, projectRoot?: string): StackFrame | null {
  const trimmedLine = line.trim();

  // Try Chrome/Node format: "at FunctionName (file:line:column)" or "at file:line:column"
  const chromeMatch = trimmedLine.match(/^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
  if (chromeMatch) {
    const [, functionName, fileName, lineNumber, columnNumber] = chromeMatch;
    return createStackFrame(
      functionName?.trim() || null,
      fileName,
      parseInt(lineNumber, 10),
      parseInt(columnNumber, 10),
      projectRoot,
      trimmedLine
    );
  }

  // Try Firefox format: "FunctionName@file:line:column"
  const firefoxMatch = trimmedLine.match(/^(.+?)@(.+?):(\d+):(\d+)$/);
  if (firefoxMatch) {
    const [, functionName, fileName, lineNumber, columnNumber] = firefoxMatch;
    return createStackFrame(
      functionName?.trim() || null,
      fileName,
      parseInt(lineNumber, 10),
      parseInt(columnNumber, 10),
      projectRoot,
      trimmedLine
    );
  }

  // Try Safari format: "FunctionName@[native code]" or "FunctionName@file:line:column"
  const safariMatch = trimmedLine.match(/^(.+?)@(.+?)$/);
  if (safariMatch) {
    const [, functionName, location] = safariMatch;

    // Handle [native code]
    if (location === '[native code]') {
      return createStackFrame(functionName?.trim() || null, '[native code]', 0, 0, projectRoot, trimmedLine);
    }

    // Try to extract line:column
    const locationMatch = location.match(/(.+?):(\d+):(\d+)$/);
    if (locationMatch) {
      const [, fileName, lineNumber, columnNumber] = locationMatch;
      return createStackFrame(
        functionName?.trim() || null,
        fileName,
        parseInt(lineNumber, 10),
        parseInt(columnNumber, 10),
        projectRoot,
        trimmedLine
      );
    }
  }

  // Try simple format: "file:line:column" (no function name)
  const simpleMatch = trimmedLine.match(/^(.+?):(\d+):(\d+)$/);
  if (simpleMatch) {
    const [, fileName, lineNumber, columnNumber] = simpleMatch;
    return createStackFrame(
      null,
      fileName,
      parseInt(lineNumber, 10),
      parseInt(columnNumber, 10),
      projectRoot,
      trimmedLine
    );
  }

  // Could not parse this line
  return null;
}

/**
 * Creates a StackFrame object with all fields populated
 */
function createStackFrame(
  functionName: string | null,
  fileName: string,
  lineNumber: number,
  columnNumber: number,
  projectRoot: string | undefined,
  raw: string
): StackFrame {
  return {
    functionName,
    fileName: sanitizeFileName(fileName),
    lineNumber,
    columnNumber,
    isLocalSource: isLocalSource(fileName, projectRoot),
    raw,
  };
}

/**
 * Sanitizes a file name by removing webpack/bundler artifacts
 *
 * @param fileName - Raw file name from stack trace
 * @returns Cleaned file name
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName) {
    return fileName;
  }

  let sanitized = fileName;

  // Remove webpack internal paths
  sanitized = sanitized.replace(/webpack:\/\/\//g, '');
  sanitized = sanitized.replace(/webpack-internal:\/\/\//g, '');

  // Remove query parameters
  sanitized = sanitized.split('?')[0];

  // Remove hash fragments
  sanitized = sanitized.split('#')[0];

  // Convert file:// URLs to paths
  if (sanitized.startsWith('file://')) {
    try {
      sanitized = new URL(sanitized).pathname;
    } catch {
      sanitized = sanitized.replace('file://', '');
    }
  }

  // Convert http/https URLs to just the pathname
  if (sanitized.startsWith('http://') || sanitized.startsWith('https://')) {
    try {
      const url = new URL(sanitized);
      sanitized = url.pathname;
    } catch {
      // Keep as is if URL parsing fails
    }
  }

  return sanitized;
}

/**
 * Determines if a file path refers to local project source code
 *
 * @param fileName - File name or path
 * @param projectRoot - Project root directory
 * @returns True if this is local source code
 */
export function isLocalSource(fileName: string, projectRoot?: string): boolean {
  if (!fileName) {
    return false;
  }

  const sanitized = sanitizeFileName(fileName);

  // Check for node_modules
  if (sanitized.includes('node_modules')) {
    return false;
  }

  // Check for browser/framework internals
  if (sanitized.includes('[native code]') || sanitized.startsWith('<anonymous>') || sanitized.startsWith('eval at')) {
    return false;
  }

  // Check for external URLs
  if (sanitized.startsWith('http://') || sanitized.startsWith('https://')) {
    return false;
  }

  // If we have a project root, check if file is within it
  if (projectRoot) {
    try {
      const absolutePath = path.isAbsolute(sanitized) ? sanitized : path.resolve(projectRoot, sanitized);
      const relativePath = path.relative(projectRoot, absolutePath);
      // If path doesn't start with '..' it's within project root
      return !relativePath.startsWith('..');
    } catch {
      return false;
    }
  }

  // If no project root, assume local if it looks like a relative path
  return !sanitized.startsWith('http') && !sanitized.startsWith('[');
}

/**
 * Extracts the likely component name from a stack trace.
 * Looks for patterns like "c-component-name" or "namespace-component-name"
 *
 * @param frames - Parsed stack frames
 * @returns Component name or null
 */
export function extractComponentNameFromStack(frames: StackFrame[]): string | null {
  for (const frame of frames) {
    // Look in file names
    const fileMatch = frame.fileName.match(/([a-z]+-[a-z-]+)\.js/i);
    if (fileMatch) {
      return fileMatch[1];
    }

    // Look in function names
    if (frame.functionName) {
      const funcMatch = frame.functionName.match(/([a-z]+-[a-z-]+)/i);
      if (funcMatch) {
        return funcMatch[1];
      }
    }
  }

  return null;
}

/**
 * Extracts the likely lifecycle hook from a stack trace.
 * Looks for patterns like "connectedCallback", "disconnectedCallback", etc.
 *
 * @param frames - Parsed stack frames
 * @returns Lifecycle hook name or null
 */
export function extractLifecycleHookFromStack(frames: StackFrame[]): string | null {
  const lifecycleHooks = [
    'constructor',
    'connectedCallback',
    'disconnectedCallback',
    'renderedCallback',
    'errorCallback',
    'render',
  ];

  for (const frame of frames) {
    if (frame.functionName) {
      const lowerFunc = frame.functionName.toLowerCase();
      for (const hook of lifecycleHooks) {
        if (lowerFunc.includes(hook.toLowerCase())) {
          return hook;
        }
      }
    }
  }

  return null;
}

/**
 * Filters stack frames to only include local source files
 *
 * @param frames - Stack frames to filter
 * @returns Filtered array of local frames
 */
export function filterLocalFrames(frames: StackFrame[]): StackFrame[] {
  return frames.filter((frame) => frame.isLocalSource);
}

/**
 * Formats a stack frame for display
 *
 * @param frame - Stack frame to format
 * @returns Formatted string
 */
export function formatStackFrame(frame: StackFrame): string {
  const funcName = frame.functionName ?? '<anonymous>';
  return `${funcName} (${frame.fileName}:${String(frame.lineNumber)}:${String(frame.columnNumber)})`;
}

/**
 * Formats an array of stack frames for display
 *
 * @param frames - Stack frames to format
 * @returns Formatted multi-line string
 */
export function formatStackTrace(frames: StackFrame[]): string {
  return frames.map((frame, index) => `  ${index + 1}. ${formatStackFrame(frame)}`).join('\n');
}
