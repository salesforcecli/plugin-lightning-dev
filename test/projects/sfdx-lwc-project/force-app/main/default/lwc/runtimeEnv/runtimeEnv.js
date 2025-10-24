import { LightningElement } from 'lwc';

export function isVSCodeExtension() {
  try {
    // 1) VS Code webview API present
    // eslint-disable-next-line no-undef
    if (typeof acquireVsCodeApi === 'function') return true;

    // 2) Origin indicates VS Code webview
    if (window.parent !== window && location.origin.startsWith('vscode-webview://')) return true;

    // 3) Dev/testing override
    const qs = new URLSearchParams(location.search);
    if (qs.get('env') === 'vscode') return true;

    // 4) UA hint (VS Code desktop often includes Electron/VSCode/Code)
    const ua = navigator.userAgent || '';
    if (
      ua.includes('VSCode') ||
      ua.includes('vscode-webview') ||
      ua.includes('Electron') ||
      ua.includes('Code/')
    ) {
      return true;
    }
  } catch (e) {
    // fall through; treat as browser
  }
  return false;
}

export function isBrowser() {
  return !isVSCodeExtension();
}

export function getOriginSafe() {
  try {
    return window && window.location ? window.location.origin : null;
  } catch (_) {
    return null;
  }
}

// Component shell to allow importing this bundle as `c/runtimeEnv`.
export default class RuntimeEnv extends LightningElement {}


