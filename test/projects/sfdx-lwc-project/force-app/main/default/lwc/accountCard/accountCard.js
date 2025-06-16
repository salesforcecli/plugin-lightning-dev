import { LightningElement, api, wire } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import getAccountContacts from '@salesforce/apex/AccountCardController.getAccountContacts';

import NAME_FIELD from '@salesforce/schema/Account.Name';
import WEBSITE_FIELD from '@salesforce/schema/Account.Website';
import INDUSTRY_FIELD from '@salesforce/schema/Account.Industry';
import ANNUAL_REVENUE_FIELD from '@salesforce/schema/Account.AnnualRevenue';
import EMPLOYEES_FIELD from '@salesforce/schema/Account.NumberOfEmployees';
import STATUS_FIELD from '@salesforce/schema/Account.Active__c';
import BILLING_CITY_FIELD from '@salesforce/schema/Account.BillingCity';
import BILLING_STATE_FIELD from '@salesforce/schema/Account.BillingState';

const ACCOUNT_FIELDS = [
  NAME_FIELD,
  WEBSITE_FIELD,
  INDUSTRY_FIELD,
  ANNUAL_REVENUE_FIELD,
  EMPLOYEES_FIELD,
  // STATUS_FIELD,
  BILLING_CITY_FIELD,
  BILLING_STATE_FIELD,
];

export default class AccountCard extends LightningElement {
  @api recordId = '001xx000003GYn2AAG';
  accountData = null;
  accountError = null;
  contacts = [];
  contactsError = null;

  @wire(getRecord, {
    recordId: '$recordId',
    fields: ACCOUNT_FIELDS,
  })
  handleAccountData({ error, data }) {
    if (data) {
      this.accountData = data;
      this.accountError = null;
    } else if (error) {
      this.accountData = null;
      this.accountError = error;
      console.error('Error loading account data', error);
    }
  }

  @wire(getAccountContacts, { accountId: '$recordId' })
  handleContactsData({ error, data }) {
    if (data) {
      this.contacts = this.processContacts(data);
      this.contactsError = null;
    } else if (error) {
      this.contacts = [];
      this.contactsError = error;
      console.error('Error loading contacts', error);
    }
  }

  processContacts(contacts) {
    return contacts.map((contact) => {
      const names = contact.Name ? contact.Name.split(' ') : [];
      let initials = '';

      if (names.length > 1) {
        initials = `${names[0].charAt(0)}${names[names.length - 1].charAt(0)}`;
      } else if (names.length === 1) {
        initials = names[0].charAt(0);
      }

      return {
        ...contact,
        Initials: initials,
      };
    });
  }

  getFieldValue(field) {
    if (!this.accountData || !this.accountData.fields || !field) {
      return null;
    }

    const fieldData = this.accountData.fields[field.fieldApiName];
    return fieldData ? fieldData.value : null;
  }

  get name() {
    return this.getFieldValue(NAME_FIELD);
  }

  get industry() {
    return this.getFieldValue(INDUSTRY_FIELD);
  }

  get website() {
    return this.getFieldValue(WEBSITE_FIELD);
  }

  get annualRevenue() {
    const revenue = this.getFieldValue(ANNUAL_REVENUE_FIELD);
    return revenue
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          notation: 'compact',
          maximumFractionDigits: 1,
        }).format(revenue)
      : '$0';
  }

  get employees() {
    return this.getFieldValue(EMPLOYEES_FIELD) || '250';
  }

  get status() {
    return this.getFieldValue(STATUS_FIELD) ? 'Active' : 'Active';
  }

  get statusDotClass() {
    return this.getFieldValue(STATUS_FIELD) ? 'status-dot-active' : 'status-dot-active';
  }

  get location() {
    const city = this.getFieldValue(BILLING_CITY_FIELD) || 'San Francisco';
    const state = this.getFieldValue(BILLING_STATE_FIELD) || 'CA';

    return `${city}, ${state}`;
  }

  get hasContacts() {
    return this.contacts && this.contacts.length > 0;
  }

  get noContactsMessage() {
    return this.contactsError ? 'Error loading contacts' : 'No contacts found for this account';
  }

  get isLoading() {
    return !this.accountData && !this.accountError;
  }

  get hasError() {
    return this.accountError ? true : false;
  }

  handleEdit() {
    this[NavigationMixin.Navigate]({
      type: 'standard__recordPage',
      attributes: {
        recordId: this.recordId,
        objectApiName: 'Account',
        actionName: 'edit',
      },
    });
  }

  handleCall(event) {
    const contactId = event.currentTarget.dataset.id;
    const contact = this.contacts.find((cont) => cont.Id === contactId);

    if (contact && contact.Phone) {
      window.open(`tel:${contact.Phone}`, '_blank');
    }
  }

  handleEmail(event) {
    const contactId = event.currentTarget.dataset.id;
    const contact = this.contacts.find((cont) => cont.Id === contactId);

    if (contact && contact.Email) {
      window.open(`mailto:${contact.Email}`, '_blank');
    }
  }
}
