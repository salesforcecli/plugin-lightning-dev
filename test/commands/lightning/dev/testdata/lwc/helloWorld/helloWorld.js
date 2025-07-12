import { LightningElement } from 'lwc';
export default class helloWorld extends LightningElement {
  greeting = 'Hello, World!';
  handleClick() {
    this.greeting = this.greeting === 'Hello, World!' ? 'Hi again!' : 'Hello, World!';
  }
}
