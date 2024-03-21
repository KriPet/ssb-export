// ==UserScript==
// @name         SSB transaction export
// @namespace    http://bakemo.no/
// @version      0.5.2
// @author       Peter Kristoffersen
// @description  Press "-" to export the last month of transactions from all accounts
// @match        https://www.dengulebanken.no/*
// @downloadUrl    https://github.com/KriPet/ssb-export/raw/master/ssb-export.user.js
// ==/UserScript==

class SsbUtilities {

    private static readonly rootUrl = "https://www.dengulebanken.no/dagligbank-lokalbank-web/rest"
    private static readonly accountsUrl = `${this.rootUrl}/resource/accounts`
    private static readonly transactionsUrl = (accountId: SSBAccountId) => `${this.rootUrl}/resource/accounts/${accountId}/transactions`

    private static ssbFetch(url: string) {
        return fetch(url, {
            "credentials": "include",
            "method": "GET",
            "headers": { "Accept": "application/json" }
        });
    }

    private static async getAccounts(): Promise<SSBAccount[]> {
        const response = await SsbUtilities.ssbFetch(this.accountsUrl);
        return await response.json();
    }

    private static async getTransactions(accountId: SSBAccountId): Promise<SSBTransaction[]> {
        const response = await SsbUtilities.ssbFetch(this.transactionsUrl(accountId));

        // Todo: We can add ?nextReference=<ref> to URL to support pagination

        const body: { transactions: SSBTransaction[], nextReference: unknown } = await response.json();

        return body.transactions;
    }

    private static async downloadTransactions(account: SSBAccount) {
        const transactions = await this.getTransactions(account.accountId.value);
        if (transactions.length == 0)
            return;

        const { doc, transactionListElement } = this.createXmlDocument();

        for (const transaction of transactions) {
            const transactionElement = doc.createElement("STMTTRN");
            const dateElem = transactionElement.appendChild(doc.createElement("DTPOSTED"));
            const amountElem = transactionElement.appendChild(doc.createElement("TRNAMT"));
            const nameElem = transactionElement.appendChild(doc.createElement("NAME"));
            const memoElem = transactionElement.appendChild(doc.createElement("MEMO"));
            nameElem.append(transaction.text);
            dateElem.append(transaction.bookingDate.replace(/-/g, ''));
            memoElem.append(transaction.purpose);
            amountElem.append((transaction.transactionAmount).toString());
            transactionListElement.appendChild(transactionElement);
        }

        const xmlText = new XMLSerializer().serializeToString(doc);

        const blob = new Blob([xmlText], { type: "application/x-ofx" });


        const link = document.createElement("a");
        const dateString = new Date().toISOString().substring(0, 10);
        link.download = `${dateString} ${account.alias}.ofx`;
        link.href = URL.createObjectURL(blob);
        link.click();
    }

    private static createXmlDocument() {
        const doc = document.implementation.createDocument(null, "OFX", null);
        const OFX = doc.documentElement;
        const BANKMSGSRSV1 = OFX.appendChild(doc.createElement("BANKMSGSRSV1"));
        const STMTTRNRS = BANKMSGSRSV1.appendChild(doc.createElement("STMTTRNRS"));
        const STMTRS = STMTTRNRS.appendChild(doc.createElement("STMTRS"));
        const transactionListElement = STMTRS.appendChild(doc.createElement("BANKTRANLIST"));
        return { doc, transactionListElement }
    }

    private static async downloadAllAccountTransactions() {
        const accounts = await this.getAccounts();
        for (const account of accounts) {
            SsbUtilities.downloadTransactions(account);
        }
    }

    public static initialize() {
        console.log("Initializing SSB utitilies");
        document.addEventListener('keyup', (event) => {
            switch (event.key) {
                case "-": {
                    SsbUtilities.downloadAllAccountTransactions();
                    break;
                }
            }
        });
    }
}


SsbUtilities.initialize();