import { LightningElement } from 'lwc';

export default class HelloWorld extends LightningElement {
  greeting = 'Hello, World!';

  handleClick() {
    this.greeting = this.greeting === 'Hello, World!' ? 'Hello, LWC!' : 'Hello, World!';
  }
}
