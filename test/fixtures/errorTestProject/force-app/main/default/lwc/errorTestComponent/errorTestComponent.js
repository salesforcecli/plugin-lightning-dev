import { LightningElement } from 'lwc';

export default class ErrorTestComponent extends LightningElement {
  connectedCallback() {
    // Deliberately cause a ReferenceError
    this.nonExistentMethod();
  }
}
