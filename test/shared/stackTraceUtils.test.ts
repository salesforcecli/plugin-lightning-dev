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

import { expect } from 'chai';
import {
  parseStackTrace,
  parseStackFrame,
  sanitizeFileName,
  isLocalSource,
  extractComponentNameFromStack,
  extractLifecycleHookFromStack,
  filterLocalFrames,
  formatStackFrame,
  formatStackTrace,
} from '../../src/shared/stackTraceUtils.js';

describe('stackTraceUtils', () => {
  describe('parseStackFrame', () => {
    it('should parse Chrome/Node format with function name', () => {
      const line = '    at myFunction (file:///path/to/file.js:10:5)';
      const frame = parseStackFrame(line, '/path/to');

      expect(frame).to.not.be.null;
      expect(frame?.functionName).to.equal('myFunction');
      expect(frame?.fileName).to.equal('/path/to/file.js');
      expect(frame?.lineNumber).to.equal(10);
      expect(frame?.columnNumber).to.equal(5);
      expect(frame?.isLocalSource).to.be.true;
    });

    it('should parse Chrome/Node format without function name', () => {
      const line = '    at /path/to/file.js:10:5';
      const frame = parseStackFrame(line, '/path/to');

      expect(frame).to.not.be.null;
      expect(frame?.functionName).to.be.null;
      expect(frame?.fileName).to.equal('/path/to/file.js');
      expect(frame?.lineNumber).to.equal(10);
      expect(frame?.columnNumber).to.equal(5);
    });

    it('should parse Firefox format', () => {
      const line = 'myFunction@file:///path/to/file.js:10:5';
      const frame = parseStackFrame(line, '/path/to');

      expect(frame).to.not.be.null;
      expect(frame?.functionName).to.equal('myFunction');
      expect(frame?.fileName).to.equal('/path/to/file.js');
      expect(frame?.lineNumber).to.equal(10);
      expect(frame?.columnNumber).to.equal(5);
      expect(frame?.isLocalSource).to.be.true;
    });

    it('should parse Safari format', () => {
      const line = 'myFunction@/path/to/file.js:10:5';
      const frame = parseStackFrame(line, '/path/to');

      expect(frame).to.not.be.null;
      expect(frame?.functionName).to.equal('myFunction');
      expect(frame?.fileName).to.equal('/path/to/file.js');
      expect(frame?.lineNumber).to.equal(10);
      expect(frame?.columnNumber).to.equal(5);
    });

    it('should handle native code', () => {
      const line = 'myFunction@[native code]';
      const frame = parseStackFrame(line);

      expect(frame).to.not.be.null;
      expect(frame?.functionName).to.equal('myFunction');
      expect(frame?.fileName).to.equal('[native code]');
      expect(frame?.lineNumber).to.equal(0);
      expect(frame?.columnNumber).to.equal(0);
      expect(frame?.isLocalSource).to.be.false;
    });

    it('should return null for unparseable lines', () => {
      const line = 'This is not a stack frame';
      const frame = parseStackFrame(line);

      expect(frame).to.be.null;
    });
  });

  describe('parseStackTrace', () => {
    it('should parse multi-line stack trace', () => {
      const stack = `Error: Test error
    at myFunction (file:///path/to/file.js:10:5)
    at anotherFunction (file:///path/to/other.js:20:10)
    at Object.<anonymous> (file:///path/to/main.js:30:15)`;

      const frames = parseStackTrace(stack, '/path/to');

      expect(frames).to.have.length(3);
      expect(frames[0].functionName).to.equal('myFunction');
      expect(frames[1].functionName).to.equal('anotherFunction');
      expect(frames[2].functionName).to.equal('Object.<anonymous>');
    });

    it('should handle empty stack trace', () => {
      const frames = parseStackTrace('');
      expect(frames).to.have.length(0);
    });
  });

  describe('sanitizeFileName', () => {
    it('should remove webpack paths', () => {
      expect(sanitizeFileName('webpack:///./src/file.js')).to.equal('./src/file.js');
      expect(sanitizeFileName('webpack-internal:///./src/file.js')).to.equal('./src/file.js');
    });

    it('should remove query parameters', () => {
      expect(sanitizeFileName('/path/to/file.js?v=123')).to.equal('/path/to/file.js');
    });

    it('should remove hash fragments', () => {
      expect(sanitizeFileName('/path/to/file.js#fragment')).to.equal('/path/to/file.js');
    });

    it('should convert file:// URLs', () => {
      const result = sanitizeFileName('file:///path/to/file.js');
      expect(result).to.include('/path/to/file.js');
    });

    it('should handle http URLs', () => {
      const result = sanitizeFileName('http://localhost:8081/path/to/file.js');
      expect(result).to.equal('/path/to/file.js');
    });

    it('should return unchanged for simple paths', () => {
      expect(sanitizeFileName('/path/to/file.js')).to.equal('/path/to/file.js');
    });
  });

  describe('isLocalSource', () => {
    it('should return false for node_modules', () => {
      expect(isLocalSource('/path/to/node_modules/package/file.js')).to.be.false;
    });

    it('should return false for native code', () => {
      expect(isLocalSource('[native code]')).to.be.false;
    });

    it('should return false for anonymous', () => {
      expect(isLocalSource('<anonymous>')).to.be.false;
    });

    it('should return false for external URLs', () => {
      expect(isLocalSource('http://example.com/file.js', '/path/to')).to.be.false;
      expect(isLocalSource('https://example.com/file.js', '/path/to')).to.be.false;
    });

    it('should return true for local paths', () => {
      expect(isLocalSource('/path/to/file.js', '/path/to')).to.be.true;
      expect(isLocalSource('./file.js')).to.be.true;
    });
  });

  describe('extractComponentNameFromStack', () => {
    it('should extract component name from file names', () => {
      const frames = [
        {
          functionName: null,
          fileName: '/path/to/c-hello-world.js',
          lineNumber: 10,
          columnNumber: 5,
          isLocalSource: true,
        },
      ];

      expect(extractComponentNameFromStack(frames)).to.equal('c-hello-world');
    });

    it('should extract component name from function names', () => {
      const frames = [
        {
          functionName: 'c-my-component.connectedCallback',
          fileName: '/path/to/file.js',
          lineNumber: 10,
          columnNumber: 5,
          isLocalSource: true,
        },
      ];

      expect(extractComponentNameFromStack(frames)).to.equal('c-my-component');
    });

    it('should return null if no component name found', () => {
      const frames = [
        {
          functionName: 'someFunction',
          fileName: '/path/to/file.js',
          lineNumber: 10,
          columnNumber: 5,
          isLocalSource: true,
        },
      ];

      expect(extractComponentNameFromStack(frames)).to.be.null;
    });
  });

  describe('extractLifecycleHookFromStack', () => {
    it('should detect connectedCallback', () => {
      const frames = [
        {
          functionName: 'connectedCallback',
          fileName: '/path/to/file.js',
          lineNumber: 10,
          columnNumber: 5,
          isLocalSource: true,
        },
      ];

      expect(extractLifecycleHookFromStack(frames)).to.equal('connectedCallback');
    });

    it('should detect renderedCallback', () => {
      const frames = [
        {
          functionName: 'MyComponent.renderedCallback',
          fileName: '/path/to/file.js',
          lineNumber: 10,
          columnNumber: 5,
          isLocalSource: true,
        },
      ];

      expect(extractLifecycleHookFromStack(frames)).to.equal('renderedCallback');
    });

    it('should return null if no lifecycle hook found', () => {
      const frames = [
        {
          functionName: 'someOtherMethod',
          fileName: '/path/to/file.js',
          lineNumber: 10,
          columnNumber: 5,
          isLocalSource: true,
        },
      ];

      expect(extractLifecycleHookFromStack(frames)).to.be.null;
    });
  });

  describe('filterLocalFrames', () => {
    it('should filter to only local source frames', () => {
      const frames = [
        {
          functionName: 'myFunction',
          fileName: '/path/to/file.js',
          lineNumber: 10,
          columnNumber: 5,
          isLocalSource: true,
        },
        {
          functionName: 'libraryFunction',
          fileName: '/path/to/node_modules/lib/file.js',
          lineNumber: 20,
          columnNumber: 10,
          isLocalSource: false,
        },
        {
          functionName: 'anotherFunction',
          fileName: '/path/to/other.js',
          lineNumber: 30,
          columnNumber: 15,
          isLocalSource: true,
        },
      ];

      const filtered = filterLocalFrames(frames);

      expect(filtered).to.have.length(2);
      expect(filtered[0].functionName).to.equal('myFunction');
      expect(filtered[1].functionName).to.equal('anotherFunction');
    });
  });

  describe('formatStackFrame', () => {
    it('should format stack frame with function name', () => {
      const frame = {
        functionName: 'myFunction',
        fileName: '/path/to/file.js',
        lineNumber: 10,
        columnNumber: 5,
        isLocalSource: true,
      };

      const formatted = formatStackFrame(frame);
      expect(formatted).to.equal('myFunction (/path/to/file.js:10:5)');
    });

    it('should format stack frame without function name', () => {
      const frame = {
        functionName: null,
        fileName: '/path/to/file.js',
        lineNumber: 10,
        columnNumber: 5,
        isLocalSource: true,
      };

      const formatted = formatStackFrame(frame);
      expect(formatted).to.equal('<anonymous> (/path/to/file.js:10:5)');
    });
  });

  describe('formatStackTrace', () => {
    it('should format multiple frames', () => {
      const frames = [
        {
          functionName: 'function1',
          fileName: '/path/to/file1.js',
          lineNumber: 10,
          columnNumber: 5,
          isLocalSource: true,
        },
        {
          functionName: 'function2',
          fileName: '/path/to/file2.js',
          lineNumber: 20,
          columnNumber: 10,
          isLocalSource: true,
        },
      ];

      const formatted = formatStackTrace(frames);

      expect(formatted).to.include('1. function1');
      expect(formatted).to.include('2. function2');
      expect(formatted).to.include('/path/to/file1.js:10:5');
      expect(formatted).to.include('/path/to/file2.js:20:10');
    });
  });
});
