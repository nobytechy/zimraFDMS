/**
 * zimFDMS — type contracts for the v7.2 ZIMRA Fiscal Device Gateway API.
 *
 * Pure JSDoc — gives developers full autocomplete in VS Code without
 * dragging in TypeScript tooling. Update this file when the spec changes.
 *
 * Source: "Fiscal Device Gateway API Specification v7.2", ZIMRA.
 */

/** @typedef {'Online'|'Offline'} DeviceOperatingMode */

/** @typedef {'FiscalDayClosed'|'FiscalDayOpened'|'FiscalDayCloseInitiated'|'FiscalDayCloseFailed'} FiscalDayStatus */

/** @typedef {'Automatic'|'Manual'} FiscalDayReconciliationMode */

/** @typedef {'FiscalInvoice'|'CreditNote'|'DebitNote'} ReceiptType */

/** @typedef {'Sale'|'Discount'} ReceiptLineType */

/** @typedef {'Receipt48'|'InvoiceA4'} ReceiptPrintForm */

/** @typedef {'Cash'|'Card'|'MobileWallet'|'Other'|'BankTransfer'|'Credit'} MoneyType */

/**
 * @typedef {Object} Address
 * @property {string} [houseNo]
 * @property {string} [street]
 * @property {string} [city]
 * @property {string} [district]
 * @property {string} [province]
 */

/**
 * @typedef {Object} Contacts
 * @property {string} [phoneNo]
 * @property {string} [email]
 */

/**
 * @typedef {Object} Tax
 * @property {number} taxID                Unique tax ID from FDMS.
 * @property {number} [taxPercent]         Tax percent. Omitted means exempt.
 * @property {string} taxName              Display name.
 * @property {string} taxValidFrom         ISO date.
 * @property {string} [taxValidTill]       ISO date if expiring.
 */

/**
 * @typedef {Object} SignatureData
 * @property {string} hash                 Base64 SHA-256 hash of the canonical concat string.
 * @property {string} signature            Base64 signature over the hash.
 */

/**
 * @typedef {Object} ReceiptLine
 * @property {ReceiptLineType} receiptLineType
 * @property {number} receiptLineNo
 * @property {string} [receiptLineHSCode]
 * @property {string} receiptLineName
 * @property {number} [receiptLinePrice]
 * @property {number} receiptLineQuantity
 * @property {number} receiptLineTotal
 * @property {string} [taxCode]
 * @property {number} [taxPercent]
 * @property {number} taxID
 */

/**
 * @typedef {Object} ReceiptTax
 * @property {string} [taxCode]
 * @property {number} [taxPercent]
 * @property {number} taxID
 * @property {number} taxAmount
 * @property {number} salesAmountWithTax
 */

/**
 * @typedef {Object} Payment
 * @property {MoneyType} moneyTypeCode
 * @property {number} paymentAmount
 */

/**
 * @typedef {Object} Buyer
 * @property {string} buyerRegisterName
 * @property {string} [buyerTradeName]
 * @property {string} buyerTIN
 * @property {string} [VATNumber]
 * @property {Contacts} [buyerContacts]
 * @property {Address} [buyerAddress]
 */

/**
 * @typedef {Object} CreditDebitNote
 * @property {number} [receiptID]
 * @property {number} [deviceID]
 * @property {number} [receiptGlobalNo]
 * @property {number} [fiscalDayNo]
 */

/**
 * @typedef {Object} Receipt
 * @property {ReceiptType} receiptType
 * @property {string} receiptCurrency             ISO 4217 — uppercase (USD, ZWL, ZIG).
 * @property {number} receiptCounter              Daily ascending, resets per fiscal day.
 * @property {number} receiptGlobalNo             Cumulative across device lifetime.
 * @property {string} invoiceNo
 * @property {Buyer} [buyerData]
 * @property {string} [receiptNotes]
 * @property {string} receiptDate                 Local time, ISO 8601 no zone.
 * @property {CreditDebitNote} [creditDebitNote]
 * @property {boolean} receiptLinesTaxInclusive
 * @property {ReceiptLine[]} receiptLines
 * @property {ReceiptTax[]} receiptTaxes
 * @property {Payment[]} receiptPayments
 * @property {number} receiptTotal
 * @property {ReceiptPrintForm} [receiptPrintForm]
 * @property {SignatureData} receiptDeviceSignature
 * @property {string} [username]
 * @property {string} [userNameSurname]
 */

/**
 * @typedef {Object} DeviceConfig                ← getConfig response.
 * @property {string} operationID
 * @property {string} taxPayerName
 * @property {string} taxPayerTIN
 * @property {string} [vatNumber]
 * @property {string} deviceSerialNo
 * @property {string} deviceBranchName
 * @property {Address} deviceBranchAddress
 * @property {Contacts} [deviceBranchContacts]
 * @property {DeviceOperatingMode} deviceOperatingMode
 * @property {number} taxPayerDayMaxHrs
 * @property {number} taxpayerDayEndNotificationHrs
 * @property {Tax[]} applicableTaxes
 * @property {string} certificateValidTill
 * @property {string} qrUrl
 */

// Re-exports for IDE go-to-definition. The actual file has no runtime code.
export const TYPES = 'jsdoc-only'
