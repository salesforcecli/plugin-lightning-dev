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

type ValueOf<T> = T[keyof T];
type Entries<T> = Array<[keyof T, ValueOf<T>]>;

/**
 * Same as `Object.entries()` but with type inference
 *
 * @param obj the object to get the entries of
 * @returns the entries of the object
 */
export function objectEntries<T extends object>(obj: T): Entries<T> {
  return Object.entries(obj) as Entries<T>;
}

/**
 * Same as `Object.keys()` but with type inference
 *
 * @param obj the object to get the keys of
 * @returns the keys of the object
 */
export function objectKeys<T extends object>(obj: T): Array<keyof T> {
  return Object.keys(obj) as unknown as Array<keyof T>;
}
