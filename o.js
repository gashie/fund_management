function generateTransaction(
    stlBnkAcc,
    curDate = null,
    amount,
    zeroes,
    desc1,
    desc2,
    settlementDate = null,
    type
  ) {
    // Generate the current date in ddMMyy format if not provided
    const getCurrentDate = () => {
      const date = new Date();
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are zero-indexed
      const year = String(date.getFullYear()).slice(-2); // Get last two digits of the year
      return `${day}${month}${year}`;
    };
  
    curDate = curDate || getCurrentDate();
    settlementDate = settlementDate || getCurrentDate();
  
    // Pad the amount to ensure it is 18 characters
    let paddedAmount = amount.padStart(18, "0");
  
    // Construct part 1 and part 2 based on the type (CREDIT or DEBIT)
    let part1, part2;
    if (type === "CREDIT") {
      part1 = `${stlBnkAcc}${curDate}${zeroes}${paddedAmount}${desc1}`;
      part2 = `${desc2}${settlementDate}`;
    } else if (type === "DEBIT") {
      part1 = `${stlBnkAcc}${curDate}${paddedAmount}${zeroes}${desc1}`;
      part2 = `${desc2}${settlementDate}`;
    } else {
      throw new Error("Invalid transaction type. Use 'CREDIT' or 'DEBIT'.");
    }
  
    // Calculate the number of white spaces needed
    const totalLength = part1.length + part2.length;
    const whiteSpacesCount = 90 - totalLength;
    if (whiteSpacesCount < 0) {
      throw new Error(
        "The constructed parts exceed the maximum allowed length of 90 characters."
      );
    }
  
    // Add the required white spaces between part1 and part2
    const whiteSpaces = " ".repeat(whiteSpacesCount);
  
    // Construct the final transaction string
    return `${part1}${whiteSpaces}${part2}`;
  }
  
  // Example usage:
  let stlBnkAcc = "0120730008000";
  let curDate = null; // Let the function generate the date
  let amount = "1672618233";
  let zeroes = "000000000000000000";
  let desc1 = "GIP";
  let desc2 = "RTPS";
  let settlementDate = null; // So if null,Let the function generate the settlement date
  
  const creditTransaction = generateTransaction(
    stlBnkAcc,
    curDate,
    amount,
    zeroes,
    desc1,
    desc2,
    settlementDate,
    "CREDIT"
  );
  
  const debitTransaction = generateTransaction(
    stlBnkAcc,
    curDate,
    amount,
    zeroes,
    desc1,
    desc2,
    settlementDate,
    "DEBIT"
  );
  
  console.log("CREDIT:", creditTransaction);
  console.log("DEBIT:", debitTransaction);
  