#!/usr/bin/env node

const XLSX = require('xlsx-style')
const fuzz = require('fuzzball');

const Const = require('./Constants')
const { allowedList, excludeList} = require('./Config')


const getCellForSheet = (sheet, column, row) => {
  const add = { c: column, r: row };
  const ref = XLSX.utils.encode_cell(add);

  return sheet[ref] && sheet[ref].v
}

/**
 * @function fuzzyContains
 * 
 * @description Use a fuzzy search to see if a string is in an array
 * 
 * @param {*} stringList 
 * @param {*} string 
 * @param {*} threshold 
 * 
 * @returns the index of the first fuzzy match, or -1 if not found
 */
const fuzzyContains = (stringList, string, threshold = 95) => {
  return stringList.reduce((acc, curr, idx) => {
    if (acc > -1) {
      return acc;
    }

    if (fuzz.ratio(curr, string) > threshold) {
      return idx;
    }

    return acc
  }, -1)
}


/**
 * @function getErrorRows
 *
 * @description Gets the rows that contain errors in the sheet
 * 
 * @param {XLSX.Sheet} sheet 
 */
const getErrorRows = (sheet) => {
  const range = XLSX.utils.decode_range(sheet['!ref'])

  /* Find the rows with */
  const errorRowNumbers = []
  for (var row = range.s.r; row <= range.e.r; ++row) {
    const licenseString = getCellForSheet(sheet, Const.COLUMN_LICENSE, row)
    if (!licenseString) {
      continue
    }

    const fuzzyIndex = fuzzyContains(allowedList, licenseString, Const.LICENSE_STRING_MATCH_THRESHOLD)
    if (fuzzyIndex > -1) {
      continue
    }
    const package = getCellForSheet(sheet, Const.COLUMN_PACKAGE, row)
    const github = getCellForSheet(sheet, Const.COLUMN_GITHUB, row)
    
    //Whitelist package
    const warningRowIdx = excludeList.map(r => r.package).indexOf(package);
    if (warningRowIdx > -1) {
      continue
    }

    const error = {
      license: allowedList[fuzzyIndex],
      reason: 'Disallowed license'
    }
    
    errorRowNumbers.push({
      row, 
      ctx: { 
        ...error,
        license: licenseString,
        package,
        github,
      }
    })
  }

  return errorRowNumbers
}

/**
 * @function getWarningRows
 * 
 * @description Gets the rows that contain warnings
 * 
 * @param {XLSX.Sheet} sheet 
 */
const getWarningRows = (sheet) => {
  const range = XLSX.utils.decode_range(sheet['!ref'])

  /* Find the rows with */
  const warningRowNumbers = []
  for (var row = range.s.r; row <= range.e.r; ++row) {
    const packageString = getCellForSheet(sheet, Const.COLUMN_PACKAGE, row)
    if (!packageString) {
      continue
    }

    const warningRowIdx = excludeList.map(r => r.package).indexOf(packageString);
    if (warningRowIdx > -1) {
      const license = getCellForSheet(sheet, Const.COLUMN_LICENSE, row)
      const github = getCellForSheet(sheet, Const.COLUMN_GITHUB, row)

      warningRowNumbers.push({
        row, 
        ctx: {
          ...excludeList[warningRowIdx],
          license,
          github,
        }
      })
    }
  }

  return warningRowNumbers
}


/**
 * @function addErrorsToSheet
 *
 * @description Add the errors to the worksheet
 *
 * @param {XLSX.Sheet} sheet
 * @param {Array<{row: number, ctx: {license: string, reason: string}}>} errorRows - An array contaning the indexes of errors
 */
const addErrorsToSheet = (sheet, errorRows) => {
  const range = XLSX.utils.decode_range(sheet['!ref'])
  
  /* Add a new "Reason" header */
  const reasonRef = XLSX.utils.encode_cell({ c: Const.COLUMN_ERROR_MESSAGE, r: 0 });
  sheet[reasonRef] = {
    v: "reason",
    t: 's',
  }

  /**  
   * For each errorRow:
   * - add an "Error message" column
   * - change the color to red
   */
  errorRows.forEach(row => {
    const r = row.row;
    const address = { c: Const.COLUMN_ERROR_MESSAGE, r };
    const ref = XLSX.utils.encode_cell(address);

    sheet[ref] = {
      v: row.ctx.reason, 
      t: 's',
      s: Const.cellStyleError,
    }
    
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ c: C, r });
      const cell = sheet[cellRef]
        
      if (!cell) {
        continue
      }
        
      sheet[cellRef] = {
        ...cell,
        s: Const.cellStyleError
      }
    }
  })

  const columns = range.e.c + 1;
  const newRange = {
    s: range.s,
    e: {
      ...range.e,
      c: columns
    }
  }

  //Manually update the ref
  sheet['!ref'] = XLSX.utils.encode_range(newRange)
}

/**
 * @function addWarningsToSheet
 *
 * @description Add the errors to the worksheet
 *
 * @param {XLSX.Sheet} sheet
 * @param {Array<{row: number, ctx: {package: string, reason: string}}>} warningRows - An array contaning the indexes of warnings
 */
const addWarningsToSheet = (sheet, warningRows) => {
  const range = XLSX.utils.decode_range(sheet['!ref'])

  warningRows.forEach(row => {
    const r = row.row;
    const reason = row.ctx.reason;

    //Add warning messages
    const address = { c: Const.COLUMN_ERROR_MESSAGE, r };
    const ref = XLSX.utils.encode_cell(address);
    sheet[ref] = {
      v: reason, 
      t: 's',
      s: Const.cellStyleWarning,
    }
    
    //Change color of row
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ c: C, r });
      const cell = sheet[cellRef]
        
      if (!cell) {
        continue
      }
        
      sheet[cellRef] = {
        ...cell,
        s: Const.cellStyleWarning
      }
    }
  })
}

const addToSummaryRows = (sheetName, errorRows, message) => {
  const rows = []

  errorRows.forEach(row => {
    const summaryRow = [
      sheetName,
      row.ctx.package,
      row.ctx.license,
      row.ctx.github,
      "",
      message,
      row.ctx.reason,
    ]
    rows.push(summaryRow)
  });

  return rows;
}


/**
 * @function addToSummaryPage
 * 
 * @description Given a sheet, error rows and warning rows, add to the summary page
 * 
 * @param {*} sheet 
 * @param {*} summaryRows
 * @param {*} style
 * 
 * @returns {number} count - the number of rows added
 */
const addSummaryRowsToSummarySheet = (sheet, summaryRows, style, startRow) => {
  let rowIdx = startRow
  summaryRows.forEach(row => {
    rowIdx += 1

    for (let C = 0; C <= 6; ++C) {
      const cellRef = XLSX.utils.encode_cell({ c: C, r: rowIdx });
      summarySheet[cellRef] = {
        v: row[C],
        t: 's',
        s: style,
      }
    }
  })

  return summaryRows.length
}


const wb = XLSX.readFile(Const.xlsxFile);
const sheets = wb.SheetNames.map(sheetIdx => wb.Sheets[sheetIdx])
const summarySheet = {
  '!ref': 'A1:G5',
  '!cols': [
    {'wch': 20},
    {'wch': 20},
    {'wch': 16},
    {'wch': 45},
    {'wch': 2},
    {'wch': 15},
    {'wch': 55},
  ],
  'A1': {v: 'License Summary', t: 's', s: Const.cellStyleBold},
  'A4': {v: 'Project', t: 's', s: Const.cellStyleBold},
  'B4': {v: 'Package', t: 's', s: Const.cellStyleBold},
  'C4': {v: 'License', t: 's', s: Const.cellStyleBold},
  'D4': {v: 'Github', t: 's', s: Const.cellStyleBold},
  'F4': {v: 'Severity', t: 's', s: Const.cellStyleBold},
  'G4': {v: 'Notes', t: 's', s: Const.cellStyleBold},
}

const summaryRows = []

let summaryRowIdx = 5

sheets.forEach((sheet, idx) => {
  const sheetName = wb.SheetNames[idx]
  console.log("Processing Sheet:", sheetName)

  const errorRows = getErrorRows(sheet);
  const warningRows = getWarningRows(sheet);

  addErrorsToSheet(sheet, errorRows);
  addWarningsToSheet(sheet, warningRows);

  /* Add to Summary */
  const errorSummaryRows = addToSummaryRows(sheetName, errorRows, "BAD")
  summaryRowIdx += addSummaryRowsToSummarySheet(summarySheet, errorSummaryRows, Const.cellStyleError, summaryRowIdx)

  const warnSummaryRows = addToSummaryRows(sheetName, warningRows, "WARN")
  summaryRowIdx += addSummaryRowsToSummarySheet(summarySheet, warnSummaryRows, Const.cellStyleWarning, summaryRowIdx)

})

/* Finish formatting Summary */
const newSummaryRange = {
  s: { c: 0, r: 0 },
  e: { c: 7, r: summaryRowIdx },
}
summarySheet['!ref'] = XLSX.utils.encode_range(newSummaryRange)
wb.Sheets['summary'] = summarySheet
wb.SheetNames.unshift('summary')


XLSX.writeFile(wb, Const.xlsxFile);
