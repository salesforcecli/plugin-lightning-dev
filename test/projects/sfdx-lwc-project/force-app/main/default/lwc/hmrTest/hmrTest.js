import { LightningElement, track } from 'lwc';

export default class HmrTest extends LightningElement {
  @track counter = 0;

  handleIncrement() {
    this.counter++;
  }
}
