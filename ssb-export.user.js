"use strict";
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
    static rootUrl = "https://www.dengulebanken.no/dagligbank-lokalbank-web/rest";
    static accountsUrl = `${this.rootUrl}/resource/accounts`;
    static transactionsUrl = (accountId) => `${this.rootUrl}/resource/accounts/${accountId}/transactions`;
    static ssbFetch(url) {
        return fetch(url, {
            "credentials": "include",
            "method": "GET",
            "headers": { "Accept": "application/json" }
        });
    }
    static async getAccounts() {
        const response = await SsbUtilities.ssbFetch(this.accountsUrl);
        return await response.json();
    }
    static async getTransactions(accountId) {
        const response = await SsbUtilities.ssbFetch(this.transactionsUrl(accountId));
        // Todo: We can add ?nextReference=<ref> to URL to support pagination
        const body = await response.json();
        return body.transactions;
    }
    static async downloadTransactions(account) {
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
