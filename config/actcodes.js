let actCode = [
    {
        "code": "000",
        "message": "Success",
        "service": "GIP"
    },
    {
        "code": "100",
        "message": "Rejected",
        "service": "GIP"
    },
    {
        "code": "125",
        "message": "Dormant account",
        "service": "GIP"
    },
    {
        "code": "114",
        "message": "Account not found",
        "service": "GIP"
    },
    {
        "code": "912",
        "message": "Issuer not available",
        "service": "GIP"
    },
    {
        "code": "999",
        "message": "Transaction failed",
        "service": "GIP"
    },
    {
        "code": "909",
        "message": "System Defect",
        "service": "GIP"
    },
    {
        "code": "001",
        "message": "Approved with ID",
        "service": "GIP"
    },
    {
        "code": "007",
        "message": "Approved update chip",
        "service": "GIP"
    },
    {
        "code": "101",
        "message": "Expired Card",
        "service": "GIP"
    },
    {
        "code": "104",
        "message": "Private Card",
        "service": "GIP"
    },
    {
        "code": "107",
        "message": "Refer to card issuer",
        "service": "GIP"
    },
    {
        "code": "109",
        "message": "Bad Merchant",
        "service": "GIP"
    },
    {
        "code": "111",
        "message": "Invalid card number",
        "service": "GIP"
    },
    {
        "code": "114",
        "message": "Wrong Account/Wallet",
        "service": "GIP"
    },
    { "code": "116", "message": "No sufficient funds", "service": "GIP" },
    { "code": "118", "message": "No such card", "service": "GIP" },
    { "code": "120", "message": "Terminal transaction not permitted", "service": "GIP" },
    { "code": "122", "message": "Security violation", "service": "GIP" },
    { "code": "125", "message": "Card not in service", "service": "GIP" },
    { "code": "127", "message": "Error PIN length", "service": "GIP" },
    { "code": "129", "message": "Suspected fraud", "service": "GIP" },
    { "code": "181", "message": "No cheque account", "service": "GIP" },
    { "code": "183", "message": "Bad CVV", "service": "GIP" },
    { "code": "200", "message": "Rejected, Pick up card", "service": "GIP" },
    { "code": "202", "message": "Fraud Suspected, Pick up card", "service": "GIP" },
    { "code": "205", "message": "Issuer call for Acquirer security service, pick up card", "service": "GIP" },
    { "code": "207", "message": "Special conditions, Pick up card", "service": "GIP" },
    { "code": "209", "message": "Card stolen, Pick up", "service": "GIP" },
    { "code": "280", "message": "Alternative amount reserved", "service": "GIP" },
    { "code": "300", "message": "Successfully processed", "service": "GIP" },
    { "code": "302", "message": "Unable to find record in file", "service": "GIP" },
    { "code": "304", "message": "Zone control over", "service": "GIP" },
    { "code": "306", "message": "Unsuccessful", "service": "GIP" },
    { "code": "308", "message": "Duplicate record. New record rejected", "service": "GIP" },
    { "code": "381", "message": "Record not found", "service": "GIP" },
    { "code": "383", "message": "Balance request", "service": "GIP" },
    { "code": "480", "message": "Reversal Accepted", "service": "GIP" },
    { "code": "503", "message": "Counter not available", "service": "GIP" },
    { "code": "582", "message": "Reconciliation not available", "service": "GIP" },
    { "code": "880", "message": "Connection not accepted", "service": "GIP" },
    { "code": "908", "message": "Transaction receiver not referenced for switch", "service": "GIP" },
    { "code": "911", "message": "Timeout", "service": "GIP" },
    { "code": "992", "message": "Issuer not found", "service": "GIP" },
    { "code": "994", "message": "Transaction processing error", "service": "GIP" },
    { "code": "999", "message": "Transaction failed", "service": "GIP" },
    { "code": "003", "message": "Approved VIP", "service": "GIP" },
    { "code": "100", "message": "Rejected", "service": "GIP" },
    { "code": "102", "message": "Suspected fraud", "service": "GIP" },
    { "code": "106", "message": "Allowable number on PIN entry tries exceeded", "service": "GIP" },
    { "code": "108", "message": "Refer to card issuer; special condition", "service": "GIP" },
    { "code": "110", "message": "Invalid amount", "service": "GIP" },
    { "code": "112", "message": "PIN element required for this transaction type", "service": "GIP" },
    { "code": "115", "message": "Function not available", "service": "GIP" },
    { "code": "117", "message": "Incorrect PIN", "service": "GIP" },
    { "code": "119", "message": "Cardholder transaction not permitted", "service": "GIP" },
    { "code": "121", "message": "Exceeds withdrawal frequency limit", "service": "GIP" },
    { "code": "123", "message": "Withdrawal frequency exceeded", "service": "GIP" },
    { "code": "126", "message": "Wrong PIN format", "service": "GIP" },
    { "code": "128", "message": "Cryptographic error", "service": "GIP" },
    { "code": "180", "message": "No credit account", "service": "GIP" },
    { "code": "182", "message": "No saving account", "service": "GIP" },
    { "code": "184", "message": "Invalid date", "service": "GIP" },
    { "code": "201", "message": "Expired card, Pick up card", "service": "GIP" },
    { "code": "204", "message": "Reversed usage, Pick up card", "service": "GIP" },
    { "code": "206", "message": "Number of PIN validation attempts exceeded", "service": "GIP" },
    { "code": "210", "message": "Fraud suspected, Pick up", "service": "GIP" },
    { "code": "299", "message": "Card pick up", "service": "GIP" },
    { "code": "301", "message": "Not supported by receiver", "service": "GIP" },
    { "code": "303", "message": "Duplicate record. Old record replaced.", "service": "GIP" },
    { "code": "305", "message": "File locked", "service": "GIP" },
    { "code": "307", "message": "Format error", "service": "GIP" },
    { "code": "309", "message": "File unknown", "service": "GIP" },
    { "code": "382", "message": "Balanced record cleared", "service": "GIP" },
    { "code": "385", "message": "Reversal accepted", "service": "GIP" },
    { "code": "481", "message": "Invalid reversal amount", "service": "GIP" },
    { "code": "581", "message": "Reconciliation done", "service": "GIP" },
    { "code": "800", "message": "Cut-off in progress", "service": "GIP" },
    { "code": "902", "message": "Invalid transaction", "service": "GIP" },
    { "code": "909", "message": "System defect", "service": "GIP" },
    { "code": "912", "message": "Card issuer not available", "service": "GIP" },
    { "code": "993", "message": "PIN verification error", "service": "GIP" },
    { "code": "995", "message": "Server processing error", "service": "GIP" },
    { "code": "990", "message": "Transaction status unknown", "service": "GIP" },
    { "code": "091", "message": "Institution unavailable", "service": "GIP" }
]

module.exports = {actCode}