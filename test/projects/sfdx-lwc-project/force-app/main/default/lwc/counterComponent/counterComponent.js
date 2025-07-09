import { LightningElement } from 'lwc';

export default class CounterComponent extends LightningElement {
  count = 0;

  increment() {
    this.count++;
  }

  decrement() {
    this.count--;
  }

  reset() {
    this.count = 0;
  }

  get isNegative() {
    return this.count < 0;
  }

  get isPositive() {
    return this.count > 0;
  }
}
