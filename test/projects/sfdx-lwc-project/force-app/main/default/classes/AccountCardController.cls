public with sharing class AccountCardController {
    @AuraEnabled(cacheable=true)
    public static List<Contact> getAccountContacts(Id accountId) {
        if (accountId == null) {
            return new List<Contact>();
        }
        try {
            return [
                SELECT Id, Name, Email, Phone, Title, Department
                FROM Contact
                WHERE AccountId = :accountId
                AND IsDeleted = false
                ORDER BY CreatedDate DESC
                LIMIT 2
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving contacts: ' + e.getMessage());
        }
    }
}