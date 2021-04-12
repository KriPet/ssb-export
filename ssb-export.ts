// ==UserScript==
// @name         SSB transaction export
// @namespace    http://bakemo.no/
// @version      0.1
// @author       Peter Kristoffersen
// @description  Press "-" to export the last month of transactions from all accounts
// @match        https://id.portalbank.no/*
// @updateUrl    https://github.com/KriPet/ssb-export/raw/master/ssb-export.user.js
// @copyright    2021+, Peter Kristoffersen
// @inject-into  page
// ==/UserScript==


interface SSBAccount {
    entityKey: {accountId: string; agreementId: string};
    name: string;
}

interface SSBTransaction {
    paymentDate: string; // yyyy-mm-dd
    amount: {
        value: number; // Integer øre
    };
    entityKey: {
        accountId: string;
        agreementId: string;
        refNumber: string;
    };
    label: string;
    reconcileMark: boolean;
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


class SsbUtilities{

    private static ssbFetch(url: string, apiVersion: "2" | "3", body: AccountRequestOptions | TransactionRequestOptions)
    {
        return fetch(url, {
            "credentials": "include",
            "headers": {
                "Content-Type": "application/json",
                "X-SDC-API-VERSION": apiVersion
            },
            "body": JSON.stringify(body),
            "method": "POST",
        });
    }

    private static async getAccounts() : Promise<SSBAccount[]>
    {
        const response = await SsbUtilities.ssbFetch(
            "https://www.portalbank.no/servlet/restapi/0001/accounts/list/filter",
            "2",
            { includeCreditAccounts: true, includeDebitAccounts: true, includeLoans: true, onlyFavorites: false, onlyQueryable: false });

        return await response.json();
    }

    private static async getTransactions(accountId: string, agreementId: string) : Promise<SSBTransaction[]>
    {
        const now = new Date();
        const toDate = now.toISOString().substring(0,10);
        const oneMonthAsMillis = 31*24*60*60*1000;
        const lastMonth = new Date(now.getTime() - oneMonthAsMillis);
        const fromDate = lastMonth.toISOString().substring(0,10);

        const response = await SsbUtilities.ssbFetch("https://www.portalbank.no/servlet/restapi/0001/accounts/transactions/search",
        "3",
        {accountId, agreementId, transactionsFrom: fromDate, transactionsTo: toDate, includeReservations: false});

        const body : { transactions: SSBTransaction[], reservations: unknown} = await response.json();

        return body.transactions;
    }

    private static async downloadTransactions(account: SSBAccount)
    {
        const transactions = await this.getTransactions(account.entityKey.accountId, account.entityKey.agreementId);
        const header = "date\tmemo\tamount\n";
        const rows = transactions
            .filter(t => t.reconcileMark === false)
            .map(t => `${t.paymentDate}\t${t.label}\t${t.amount.value/100}\n`);
        if(rows.length === 0)
            return;
        const blob = new Blob([header, ...rows], {type: "text/tsv"});

        const link = document.createElement("a");
        const dateString = new Date().toISOString().substring(0,10);
        link.download = `${dateString} ${account.name}.tsv`;
        link.href = URL.createObjectURL(blob);
        link.click();
    }

    private static async downloadAllAccountTransactions()
    {
        const accounts = await this.getAccounts();
        for(const account of accounts){
            SsbUtilities.downloadTransactions(account);
        }
    }

    public static initialize(){
        console.log("Initializing SSB utitilies");
        document.addEventListener('keyup', (event) => {
            switch(event.key){
                case "-": {
                    SsbUtilities.downloadAllAccountTransactions();
                    break;
                }
            }
        });
    }
}


SsbUtilities.initialize();