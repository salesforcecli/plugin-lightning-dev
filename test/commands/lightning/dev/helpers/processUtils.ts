/*
 * Copyright 2026, Salesforce, Inc.
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

import { type ChildProcess } from 'node:child_process';

/**
 * Clean up a server process and all its child processes. Uses tree-kill so
 * descendant node processes (e.g. LWR workers) are terminated.
 */
export function killServerProcess(serverProcess: ChildProcess | undefined): void {
  // Clean up
  try {
    if (serverProcess?.pid && process.kill(serverProcess.pid, 0)) {
      process.kill(serverProcess.pid, 'SIGTERM');
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ESRCH') throw error;
  }
}
