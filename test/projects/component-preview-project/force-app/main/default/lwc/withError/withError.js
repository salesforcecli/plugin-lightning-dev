import { LightningElement } from 'lwc';
export default class helloWorld extends LightningElement {
  renderedCallback() {
    throw new Error('Component generated error');
  }
}
