"use strict";
// ==UserScript==
// @name         SSB transaction export
// @namespace    http://bakemo.no/
// @version      0.4.2
// @author       Peter Kristoffersen
// @description  Press "-" to export the last month of transactions from all accounts
// @match        https://id.portalbank.no/*
// @match        https://www.portalbank.no/*
// @downloadUrl    https://github.com/KriPet/ssb-export/raw/master/ssb-export.user.js
// ==/UserScript==
class SsbUtilities {
    static ssbFetch(url, apiVersion, body) {
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
    static async getAccounts() {
        const response = await SsbUtilities.ssbFetch("https://www.portalbank.no/servlet/restapi/0001/accounts/list/filter", "2", { includeCreditAccounts: true, includeDebitAccounts: true, includeLoans: true, onlyFavorites: false, onlyQueryable: false });
        return await response.json();
    }
    static async getTransactions(accountId, agreementId) {
        const now = new Date();
        const toDate = now.toISOString().substring(0, 10);
        const oneMonthAsMillis = 31 * 24 * 60 * 60 * 1000;
        const lastMonth = new Date(now.getTime() - oneMonthAsMillis);
        const fromDate = lastMonth.toISOString().substring(0, 10);
        const response = await SsbUtilities.ssbFetch("https://www.portalbank.no/servlet/restapi/0001/accounts/transactions/search", "3", { accountId, agreementId, transactionsFrom: fromDate, transactionsTo: toDate, includeReservations: false });
        const body = await response.json();
        return body.transactions;
    }
    static async downloadTransactions(account) {
        const transactions = await this.getTransactions(account.entityKey.accountId, account.entityKey.agreementId);
        if (transactions.length == 0)
            return;
        const unclearedTransactions = transactions.filter(t => !t.reconcileMark);
        if (unclearedTransactions.length == 0)
            return;
        const { doc, transactionListElement } = this.createXmlDocument();
        for (const transaction of unclearedTransactions) {
            const transactionElement = doc.createElement("STMTTRN");
            const dateElem = transactionElement.appendChild(doc.createElement("DTPOSTED"));
            const amountElem = transactionElement.appendChild(doc.createElement("TRNAMT"));
            const nameElem = transactionElement.appendChild(doc.createElement("NAME"));
            nameElem.append(transaction.label);
            dateElem.append(transaction.paymentDate.replace(/-/g, ''));
            amountElem.append((transaction.amount.value / 100).toString());
            transactionListElement.appendChild(transactionElement);
        }
        const xmlText = new XMLSerializer().serializeToString(doc);
        const blob = new Blob([xmlText], { type: "application/x-ofx" });
        const link = document.createElement("a");
        const dateString = new Date().toISOString().substring(0, 10);
        link.download = `${dateString} ${account.name}.ofx`;
        link.href = URL.createObjectURL(blob);
        link.click();
    }
    static createXmlDocument() {
        const doc = document.implementation.createDocument(null, "OFX", null);
        const OFX = doc.documentElement;
        const BANKMSGSRSV1 = OFX.appendChild(doc.createElement("BANKMSGSRSV1"));
        const STMTTRNRS = BANKMSGSRSV1.appendChild(doc.createElement("STMTTRNRS"));
        const STMTRS = STMTTRNRS.appendChild(doc.createElement("STMTRS"));
        const transactionListElement = STMTRS.appendChild(doc.createElement("BANKTRANLIST"));
        return { doc, transactionListElement };
    }
    static async downloadAllAccountTransactions() {
        const accounts = await this.getAccounts();
        for (const account of accounts) {
            SsbUtilities.downloadTransactions(account);
        }
    }
    static initialize() {
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
