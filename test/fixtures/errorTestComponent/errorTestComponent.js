/**
 * Test component with deliberate errors for testing error capture system
 */
import { LightningElement, track } from 'lwc';

export default class ErrorTestComponent extends LightningElement {
  @track counter = 0;

  connectedCallback() {
    // Deliberate error: calling undefined method
    this.nonExistentMethod();
  }

  handleClick() {
    // Deliberate error: accessing undefined property
    console.log(this.undefinedProp.someMethod());
  }

  renderedCallback() {
    // Intentional error to test lifecycle detection
    if (this.counter > 5) {
      throw new Error('Counter exceeded maximum value in renderedCallback');
    }
  }

  handleIncrement() {
    this.counter++;
  }
}
