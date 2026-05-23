/**
 * Spec page-73 worked examples — used by the Signatures page to prove our
 * canonical-concat + SHA-256 implementation matches the v7.2 spec byte-for-byte.
 *
 * If our crypto.js produces these exact `concat` and `hash` outputs from
 * the input fields, the implementation is provably correct.
 */

export const RECEIPT_TEST_VECTORS = [
  {
    name: 'Spec page 73 · Example 1 (ZWL, 4 tax lines, with previous hash)',
    input: {
      deviceID: 321,
      receipt: {
        receiptType: 'FISCALINVOICE',
        receiptCurrency: 'ZWL',
        receiptGlobalNo: 432,
        receiptDate: '2019-09-19T15:43:12',
        receiptTotal: 9450.00,
        receiptTaxes: [
          { taxID: 1, taxCode: 'A',                 taxAmount: 0.00,   salesAmountWithTax: 2500.00 },
          { taxID: 2, taxCode: 'B', taxPercent: 0,  taxAmount: 0.00,   salesAmountWithTax: 3500.00 },
          { taxID: 3, taxCode: 'C', taxPercent: 15, taxAmount: 150.00, salesAmountWithTax: 1150.00 },
          { taxID: 3, taxCode: 'D', taxPercent: 15, taxAmount: 300.00, salesAmountWithTax: 2300.00 },
        ],
      },
      previousReceiptHash: 'hNVJXP/ACOiE8McD3pKsDlqBXpuaUqQOfPnMyfZWI9k=',
    },
    expected: {
      concat: '321FISCALINVOICEZWL4322019-09-19T15:43:12945000A0250000B0.000350000C15.0015000115000D15.0030000230000hNVJXP/ACOiE8McD3pKsDlqBXpuaUqQOfPnMyfZWI9k=',
      hash:   'zDxEalWUpwX2BcsYxRUAEfY/13OaCrTwDt01So3a6uU=',
    },
  },
  {
    name: 'Spec page 73 · Example 2 (USD, 3 tax lines, with previous hash)',
    input: {
      deviceID: 322,
      receipt: {
        receiptType: 'FISCALINVOICE',
        receiptCurrency: 'USD',
        receiptGlobalNo: 85,
        receiptDate: '2019-09-19T09:23:07',
        receiptTotal: 40.35,
        receiptTaxes: [
          { taxID: 1,                     taxAmount: 0.00, salesAmountWithTax: 7.00  },
          { taxID: 2, taxPercent: 0,      taxAmount: 0.00, salesAmountWithTax: 10.00 },
          { taxID: 3, taxPercent: 14.5,   taxAmount: 0.05, salesAmountWithTax: 0.35  },
        ],
      },
      previousReceiptHash: 'hNVJXP/ACOiE8McD3pKsDlqBXpuaUqQOfPnMyfZWI9k=',
    },
    expected: {
      // Note the spec's stated concat snippet for the taxes block is
      // "07000.000100014.50535" — which corresponds to the 3 lines concatenated.
      // We do not assert the FULL concat here because the spec page snippet
      // is partial. We DO assert the hash output, which is the load-bearing claim.
      hash: '2zInR7ciOQ9PbtQlKaU5XoktQ/4/y1XShfzEEoSVO7s=',
    },
  },
]
