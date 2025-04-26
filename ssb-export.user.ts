// ==UserScript==
// @name         SSB transaction export
// @namespace    http://bakemo.no/
// @version      0.5.5
// @author       Peter Kristoffersen
// @description  Press "-" to export the last month of transactions from all accounts
// @match        https://www.rogalandsparebank.no/*
// @downloadUrl    https://github.com/KriPet/ssb-export/raw/master/ssb-export.user.js
// ==/UserScript==

class SsbUtilities {

    private static readonly rootUrl = "https://www.rogalandsparebank.no/dagligbank-lokalbank-web/rest"
    private static readonly accountsUrl = `${this.rootUrl}/resource/accounts`
    private static readonly transactionsUrl = (accountId: SSBAccountId) =>
        `${this.rootUrl}/resource/accounts/${accountId}/transactions/CSV/download`


    private static ssbFetch(url: string) {
        const init: RequestInit = {
            "credentials": "include",
            "method": "GET",
            "headers": { "Accept": "application/json" }
        }
        return fetch(url, init);
    }

    private static async getAccounts(): Promise<SSBAccount[]> {
        const response = await SsbUtilities.ssbFetch(this.accountsUrl);
        return await response.json();
    }

    private static async getTransactions(accountId: SSBAccountId): Promise<SSBTransaction[]> {
        const fromDate = new Date();
        fromDate.setMonth(fromDate.getMonth() - 1);
        const queryParams = new URLSearchParams({
            "fromDate": fromDate.toISOString()
        });
        const urlWithParams = new URL(this.transactionsUrl(accountId));
        urlWithParams.search = queryParams.toString();
        const url = urlWithParams.toString();
        console.log("Fetching transactions from: ", url);
        const response = await SsbUtilities.ssbFetch(url);

        const decoder = new TextDecoder("iso-8859-1")

        const csvBody = decoder.decode(await response.arrayBuffer())
        const transactions = csvBody.split("\n").slice(1, -8).map(line => {
            const parts = line.split(";")
            if (parts.length != 15)
                return
            const moneyIn = parseFloat(parts[10] || "0")
            const moneyOut = parseFloat(parts[11] || "0")
            const dateParts = parts[1]?.split(".")
            if (dateParts == undefined || dateParts.length != 3)
                return
            const isoDate: DateString = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`
            const transaction: SSBTransaction = {
                transactionAmount: moneyIn + moneyOut,
                bookingDate: isoDate,
                text: parts[3] || "",
                purpose: parts[14] || "",
            }
            return transaction
        })

        const allTransactions = transactions.filter(a => a != undefined)
        return allTransactions
    }

    private static async downloadTransactions(account: SSBAccount) {
        const transactions = await this.getTransactions(account.accountId.value);
        if (transactions.length == 0)
            return;

        console.log(`Found ${transactions.length} transactions for account ${account.alias}`)
        console.table(transactions)

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