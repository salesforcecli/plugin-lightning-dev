/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable no-console */

class Logger {
  public static info(message: unknown): void {
    console.log(Logger.formatMessage('36', 'ℹ️ INFO:', message)); // Cyan
  }

  public static warn(message: unknown): void {
    console.warn(Logger.formatMessage('33', '⚠️ WARN:', message)); // Yellow
  }

  public static error(message: unknown): void {
    console.error(Logger.formatMessage('31', '❌ ERROR:', message)); // Red
  }

  public static debug(message: unknown): void {
    console.debug(Logger.formatMessage('2', '🐛 DEBUG:', message)); // Dim
  }

  public static success(message: unknown): void {
    console.log(Logger.formatMessage('32', '✅ SUCCESS:', message)); // Green
  }

  private static formatMessage(color: string, label: string, message: unknown): string {
    return `\x1b[${color}m${label} ${String(message)}\x1b[0m`;
  }
}

export default Logger;
