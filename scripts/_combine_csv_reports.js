#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const ExcelJS = require('exceljs')
const CsvReadableStream = require('csv-reader')

const Const = require('./Constants')

const resultsDir = '../results/'

const getCsvFiles = (dir) => {
  return new Promise((resolve, reject) => {
    fs.readdir(dir || resultsDir, function (err, items) {
      if (err) {
        return reject(err)
      }

      return resolve(items.filter(fn => fn.indexOf('.csv') > -1))
    })
  })
}

const readAndParseFile = (filePath) => {
  return new Promise((resolve, reject) => {
    const inputStream = fs.createReadStream(filePath, 'utf8')
    const rows = []

    inputStream
      .pipe(CsvReadableStream({ parseNumbers: true, parseBooleans: true, trim: true }))
      .on('data', function (row) {
        rows.push(row)
      })
      .on('end', function () {
        return resolve(rows)
      })
      .on('error', (err) => {
        return reject(err)
      })
  })
}

const buildWorkbook = (csvFiles, csvRows) => {
  const workbook = new ExcelJS.Workbook()

  csvRows.forEach((sheet, idx) => {
    const sheetName = csvFiles[idx].replace('.csv', '')
    console.log('Processing sheet:', sheetName)

    const worksheet = workbook.addWorksheet(sheetName)

    // Sort the sheet by the 2nd column, license
    const headingRow = sheet.shift()
    sheet.sort((r1, r2) => {
      const license1 = r1[1]
      const license2 = r2[1]

      return license1.localeCompare(license2)
    })
    sheet.unshift(headingRow)

    // Add rows to the worksheet
    sheet.forEach((row) => {
      worksheet.addRow(row)
    })
  })

  return workbook
}

/* istanbul ignore next */
const main = async () => {
  const csvFiles = await getCsvFiles()
  const csvRows = await Promise.all(csvFiles.map(f => readAndParseFile(`${resultsDir}/${f}`)))

  const workbook = buildWorkbook(csvFiles, csvRows)

  const outputPath = path.resolve(__dirname, Const.xlsxFile)
  await workbook.xlsx.writeFile(outputPath)
  console.log('Saved:', outputPath)
}

if (require.main === module) {
  main()
}

module.exports = {
  getCsvFiles,
  readAndParseFile,
  buildWorkbook
}
