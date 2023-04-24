
interface Flavoring<FlavorT> {
    _type?: FlavorT
}

type Flavor<T, FlavorT> = T & Flavoring<FlavorT>

type SSBAccountId = Flavor<string, "Account">

type DateString = Flavor<string, "ISODate">


interface SSBAccount {
    accountId: { value: SSBAccountId };
    alias: string;
}

interface SSBTransaction {
    transactionAmount: number
    bookingDate: DateString
    text: string
}

interface AccountRequestOptions {
    includeCreditAccounts: boolean;
    includeDebitAccounts: boolean;
    includeLoans: boolean;
    onlyFavorites: boolean;
    onlyQueryable: boolean;
}

interface TransactionRequestOptions {
    accountId: string;
    agreementId: string;
    transactionsFrom: string; // yyyy-mm-dd
    transactionsTo: string; // yyyy-mm-dd
    includeReservations: boolean;
}
