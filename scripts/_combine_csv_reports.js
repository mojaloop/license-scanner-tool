#!/usr/bin/env node

const fs = require('fs')
const Workbook = require('xlsx-workbook').Workbook
const CsvReadableStream = require('csv-reader')

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

/* istanbul ignore next */
const main = () => {
  // Create a new workbook
  const workbook = new Workbook()

  let csvFiles

  getCsvFiles()
    .then(_csvFiles => {
      csvFiles = _csvFiles

      return Promise.all(csvFiles.map(f => readAndParseFile(`${resultsDir}/${f}`)))
    })
    .then(csvRows => {
      csvRows.forEach((sheet, idx) => {
        const sheetName = csvFiles[idx].replace('.csv', '')
        console.log('Processing sheet:', sheetName)

        const newSheet = workbook.add(sheetName)

        // Sort the sheet by the 2nd column, license
        const headingRow = sheet.shift()
        sheet.sort((r1, r2) => {
          const license1 = r1[1]
          const license2 = r2[1]

          return license1.localeCompare(license2)
        })
        sheet.unshift(headingRow)

        // iterate over the sheet and add rows and columns
        sheet.forEach((row, i) => {
          row.forEach((column, j) => {
            newSheet[i][j] = column
          })
        })
      })

      // this should save as "license-summary.xlsx", but for some reason is just ".xlsx"
      workbook.save('license-summary')
    })
}

if (require.main === module) {
  main()
}

module.exports = {
  getCsvFiles,
  readAndParseFile
}
