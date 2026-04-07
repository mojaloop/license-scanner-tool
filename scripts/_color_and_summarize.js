#!/usr/bin/env node

const ExcelJS = require('exceljs')
const fuzz = require('fuzzball')

const Const = require('./Constants')
const { allowedList, excludeList } = require('./Config')

const getCellForSheet = (worksheet, column, row) => {
  const cell = worksheet.getCell(row + 1, column + 1)
  return cell.value || undefined
}

/**
 * @function applyStyleToCell
 *
 * @description Apply an ExcelJS style object to a cell
 */
const applyStyleToCell = (cell, style) => {
  if (style.font) {
    cell.font = style.font
  }
  if (style.fill) {
    cell.fill = style.fill
  }
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
      return acc
    }

    if (fuzz.ratio(curr, string) > threshold) {
      return idx
    }

    return acc
  }, -1)
}

/**
 * @function getErrorRows
 *
 * @description Gets the rows that contain errors in the sheet
 *
 * @param {ExcelJS.Worksheet} worksheet
 */
const getErrorRows = (worksheet) => {
  const errorRowNumbers = []
  const rowCount = worksheet.rowCount

  for (let row = 0; row < rowCount; ++row) {
    const licenseString = getCellForSheet(worksheet, Const.COLUMN_LICENSE, row)
    if (!licenseString) {
      continue
    }

    const fuzzyIndex = fuzzyContains(allowedList, licenseString, Const.LICENSE_STRING_MATCH_THRESHOLD)
    if (fuzzyIndex > -1) {
      continue
    }
    const pkg = getCellForSheet(worksheet, Const.COLUMN_PACKAGE, row)
    const github = getCellForSheet(worksheet, Const.COLUMN_GITHUB, row)

    // Whitelist package
    const warningRowIdx = excludeList.map(r => r.pkg).indexOf(pkg)
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
        pkg,
        github
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
 * @param {ExcelJS.Worksheet} worksheet
 */
const getWarningRows = (worksheet) => {
  const warningRowNumbers = []
  const rowCount = worksheet.rowCount

  for (let row = 0; row < rowCount; ++row) {
    const packageString = getCellForSheet(worksheet, Const.COLUMN_PACKAGE, row)
    if (!packageString) {
      continue
    }

    const warningRowIdx = excludeList.map(r => r.pkg).indexOf(packageString)
    if (warningRowIdx > -1) {
      const license = getCellForSheet(worksheet, Const.COLUMN_LICENSE, row)
      const github = getCellForSheet(worksheet, Const.COLUMN_GITHUB, row)

      warningRowNumbers.push({
        row,
        ctx: {
          ...excludeList[warningRowIdx],
          license,
          github
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
 * @param {ExcelJS.Worksheet} worksheet
 * @param {Array<{row: number, ctx: {license: string, reason: string}}>} errorRows
 */
const addErrorsToSheet = (worksheet, errorRows) => {
  const columnCount = worksheet.columnCount

  /* Add a new "Reason" header */
  const reasonCol = Const.COLUMN_ERROR_MESSAGE + 1
  worksheet.getCell(1, reasonCol).value = 'reason'

  errorRows.forEach(row => {
    const excelRow = row.row + 1

    // Add error reason
    const reasonCell = worksheet.getCell(excelRow, reasonCol)
    reasonCell.value = row.ctx.reason
    applyStyleToCell(reasonCell, Const.cellStyleError)

    // Style existing cells in the row
    for (let C = 1; C <= columnCount; ++C) {
      const cell = worksheet.getCell(excelRow, C)
      if (!cell.value) {
        continue
      }
      applyStyleToCell(cell, Const.cellStyleError)
    }
  })
}

/**
 * @function addWarningsToSheet
 *
 * @description Add the warnings to the worksheet
 *
 * @param {ExcelJS.Worksheet} worksheet
 * @param {Array<{row: number, ctx: {package: string, reason: string}}>} warningRows
 */
const addWarningsToSheet = (worksheet, warningRows) => {
  const columnCount = worksheet.columnCount

  warningRows.forEach(row => {
    const excelRow = row.row + 1

    // Add warning reason
    const reasonCol = Const.COLUMN_ERROR_MESSAGE + 1
    const reasonCell = worksheet.getCell(excelRow, reasonCol)
    reasonCell.value = row.ctx.reason
    applyStyleToCell(reasonCell, Const.cellStyleWarning)

    // Style existing cells in the row
    for (let C = 1; C <= columnCount; ++C) {
      const cell = worksheet.getCell(excelRow, C)
      if (!cell.value) {
        continue
      }
      applyStyleToCell(cell, Const.cellStyleWarning)
    }
  })
}

const addToSummaryRows = (sheetName, errorRows, message) => {
  const rows = []

  errorRows.forEach(row => {
    const summaryRow = [
      sheetName,
      row.ctx.pkg,
      row.ctx.license,
      row.ctx.github,
      '',
      message,
      row.ctx.reason
    ]
    rows.push(summaryRow)
  })

  return rows
}

/**
 * @function addSummaryRowsToSummarySheet
 *
 * @description Given a worksheet, add summary rows with styling
 *
 * @param {ExcelJS.Worksheet} worksheet
 * @param {Array} summaryRows
 * @param {Object} style
 * @param {number} startRow - 0-indexed start row
 *
 * @returns {number} count - the number of rows added
 */
const addSummaryRowsToSummarySheet = (worksheet, summaryRows, style, startRow) => {
  let rowIdx = startRow
  summaryRows.forEach(row => {
    rowIdx += 1
    const excelRow = rowIdx + 1

    for (let C = 0; C <= 6; ++C) {
      const cell = worksheet.getCell(excelRow, C + 1)
      cell.value = row[C]
      applyStyleToCell(cell, style)
    }
  })

  return summaryRows.length
}

/* istanbul ignore next */
const main = async () => {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(Const.xlsxFile)

  // Collect sheet data first, then process
  const sheetData = []
  workbook.eachSheet((worksheet) => {
    sheetData.push({ name: worksheet.name, worksheet })
  })

  // Create summary sheet in a new workbook for proper ordering
  const outputWorkbook = new ExcelJS.Workbook()
  const summarySheet = outputWorkbook.addWorksheet('summary')
  summarySheet.columns = [
    { width: 20 },
    { width: 20 },
    { width: 16 },
    { width: 45 },
    { width: 2 },
    { width: 15 },
    { width: 55 }
  ]

  const headerCell = summarySheet.getCell(1, 1)
  headerCell.value = 'License Summary'
  applyStyleToCell(headerCell, Const.cellStyleBold)

  const headers = ['Project', 'Package', 'License', 'Github', '', 'Severity', 'Notes']
  headers.forEach((h, i) => {
    const cell = summarySheet.getCell(4, i + 1)
    cell.value = h
    applyStyleToCell(cell, Const.cellStyleBold)
  })

  let summaryRowIdx = 5

  sheetData.forEach(({ name, worksheet }) => {
    console.log('Processing Sheet:', name)

    const errorRows = getErrorRows(worksheet)
    const warningRows = getWarningRows(worksheet)

    addErrorsToSheet(worksheet, errorRows)
    addWarningsToSheet(worksheet, warningRows)

    /* Add to Summary */
    const errorSummaryRows = addToSummaryRows(name, errorRows, 'BAD')
    summaryRowIdx += addSummaryRowsToSummarySheet(summarySheet, errorSummaryRows, Const.cellStyleError, summaryRowIdx)

    const warnSummaryRows = addToSummaryRows(name, warningRows, 'WARN')
    summaryRowIdx += addSummaryRowsToSummarySheet(summarySheet, warnSummaryRows, Const.cellStyleWarning, summaryRowIdx)

    // Copy processed sheet to output workbook
    const outSheet = outputWorkbook.addWorksheet(name)
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const newRow = outSheet.getRow(rowNumber)
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const newCell = newRow.getCell(colNumber)
        newCell.value = cell.value
        if (cell.font) newCell.font = cell.font
        if (cell.fill && cell.fill.type) newCell.fill = cell.fill
      })
    })
  })

  await outputWorkbook.xlsx.writeFile(Const.xlsxFile)
}

if (require.main === module) {
  main()
}

module.exports = {
  fuzzyContains,
  getCellForSheet,
  getErrorRows,
  getWarningRows,
  addErrorsToSheet,
  addWarningsToSheet,
  addToSummaryRows,
  addSummaryRowsToSummarySheet,
  applyStyleToCell
}
