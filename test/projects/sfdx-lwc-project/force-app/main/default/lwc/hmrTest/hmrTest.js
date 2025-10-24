import { LightningElement, track } from 'lwc';
import { isVSCodeExtension, isBrowser, getOriginSafe } from 'c/runtimeEnv';

export default class HmrTest extends LightningElement {
  @track counter = 0;
  @track env = { isVSCode: false, isBrowser: true, origin: '' };

  handleIncrement() {
    this.counter++;
  }

  connectedCallback() {
    // Verify runtimeEnv module import
    // eslint-disable-next-line no-console
    console.log('[runtimeEnv]', {
      isVSCode: isVSCodeExtension(),
      isBrowser: isBrowser(),
      origin: getOriginSafe(),
    });

    // Update on-screen env status for quick verification
    this.env = {
      isVSCode: isVSCodeExtension(),
      isBrowser: isBrowser(),
      origin: getOriginSafe(),
    };
  }
}
