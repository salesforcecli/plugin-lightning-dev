import { LightningElement, api, track } from 'lwc';

export default class ErrorDisplay extends LightningElement {
  _payload;
  @track propEntriesInternal = [];
  @track view = { title: 'No error payload provided.', errorId: 'LWC-Runtime-EID-DEMO', timestamp: '', componentName: 'c-unknown', stackLines: [] };

  @api
  get payload() {
    return this._payload;
  }
  set payload(value) {
    this._payload = value;
    this.computeView();
    this.normalizeProps();
  }

  connectedCallback() {
    // Provide a visible default so demos render even if parent forgets to pass a payload
    if (!this._payload) {
      // Default to the new wrapper format with one error sample
      this._payload = {
        success: true,
        count: 1,
        errors: [
          {
            errorId: 'a1b2c3d4-e5f6-4a1b-8c9d-0e1f2a3b4c5d',
            timestamp: '2025-10-21T10:30:45.123Z',
            error: {
              name: 'ReferenceError',
              message: 'nonExistentMethod is not defined',
              stack: 'ReferenceError: nonExistentMethod is not defined\n at ErrorTestComponent.connectedCallback...',
              sanitizedStack: [
                {
                  functionName: 'connectedCallback',
                  fileName: 'errorTestComponent.js',
                  lineNumber: 5,
                  columnNumber: 10,
                  isLocalSource: true,
                },
              ],
            },
            component: {
              name: 'c-error-test-component',
              namespace: 'c',
              tagName: 'c-error-test-component',
              lifecycle: 'connectedCallback',
              filePath: null,
            },
            runtime: {
              userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
              viewport: { width: 1920, height: 1080 },
              url: 'https://myorg.lightning.force.com/...',
              lwcVersion: null,
              isDevelopment: true,
            },
            state: { props: { recordId: '001xx000003DHP0' }, publicProperties: ['recordId', 'objectApiName'], isConnected: true },
            source: { fileName: 'errorTestComponent.js', lineNumber: 5, columnNumber: 10 },
            metadata: { severity: 'error', wasHandled: false, occurrenceCount: 1, tags: ['runtime', 'browser', 'lwc'] },
          },
        ],
      };
    }
    this.computeView();
    this.normalizeProps();
  }

  computeView() {
    try {
      let title = 'Unknown error';
      let errorId = 'N/A';
      let timestamp = '';
      let componentName = 'c-unknown';
      let stackLines = [];

      if (this._payload && Array.isArray(this._payload.errors) && this._payload.errors.length > 0) {
        const e = this._payload.errors[0];
        title = (e && e.error && (e.error.message || e.error.name)) || title;
        errorId = e && e.errorId ? e.errorId : errorId;
        timestamp = e && e.timestamp ? e.timestamp : '';
        componentName = (e && e.component && (e.component.name || e.component.tagName)) || componentName;

        if (e && e.error && Array.isArray(e.error.sanitizedStack) && e.error.sanitizedStack.length) {
          stackLines = e.error.sanitizedStack.map((f) => {
            const fn = f.functionName || '<anonymous>';
            const file = f.fileName || 'unknown';
            const line = f.lineNumber != null ? f.lineNumber : '?';
            const col = f.columnNumber != null ? f.columnNumber : '?';
            return `${fn} (${file}:${line}:${col})`;
          });
        } else if (e && e.error && e.error.stack) {
          stackLines = String(e.error.stack)
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .slice(0, 30);
        }

        // also set props for normalizeProps()
        this._propsForView = (e && e.state && e.state.props) || {};
      } else if (this._payload) {
        // Back-compat with older simple shape
        title = this._payload.errorMessage || title;
        errorId = this._payload.errorId || errorId;
        timestamp = this._payload.timestamp || '';
        componentName = this._payload.componentName || componentName;
        stackLines = Array.isArray(this._payload.stackTrace) ? this._payload.stackTrace : [];
        this._propsForView = this._payload.props || {};
      }

      this.view = { title, errorId, timestamp, componentName, stackLines };
    } catch (_) {
      // keep default view
    }
  }

  normalizeProps() {
    const p = this._propsForView || {};
    if (!p) {
      this.propEntriesInternal = [];
      return;
    }
    const entries = [];
    for (const k of Object.keys(p)) {
      let v = p[k];
      try {
        if (typeof v === 'object') v = JSON.stringify(v);
      } catch (e) {
        // ignore stringify errors
      }
      entries.push({ key: k, value: String(v) });
    }
    // Only assign if changed to avoid unnecessary re-renders
    const prev = this.propEntriesInternal || [];
    const sameLength = prev.length === entries.length;
    const samePairs = sameLength && prev.every((it, i) => it.key === entries[i].key && it.value === entries[i].value);
    if (!samePairs) {
      this.propEntriesInternal = entries;
    }
  }

  get hasProps() {
    return this.propEntriesInternal && this.propEntriesInternal.length > 0;
  }

  get propEntries() {
    return this.propEntriesInternal;
  }

  async handleCopy() {
    const text = JSON.stringify(this._payload || {}, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
      } catch (_) {
        // ignore
      }
      document.body.removeChild(ta);
    }
  }
}


