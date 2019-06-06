

const fs = require('fs');
const Workbook = require('xlsx-workbook').Workbook;
var CsvReadableStream = require('csv-reader');

const resultsDir = `../results/`;

//Create a new workbook
const workbook = new Workbook();

//List the results that end in .csv

const getCsvFiles = () => {
  return new Promise((resolve, reject) => {
    fs.readdir(resultsDir, function (err, items) {
      if (err) {
        return reject(err);
      }

      return resolve(items.filter(fn => fn.indexOf('.csv') > -1));
    });
  })
}

const readAndParseFile = (path) => {
  return new Promise((resolve, reject) => {
    const inputStream = fs.createReadStream(path, 'utf8');
    const rows = [];

    inputStream
      .pipe(CsvReadableStream({ parseNumbers: true, parseBooleans: true, trim: true }))
      .on('data', function (row) {
        rows.push(row);
      })
      .on('end', function (data) {
        return resolve(rows)
      })
      .on('error', (err) => {
        return reject(err);
      });
  });
}

let csvFiles;

getCsvFiles()
.then(_csvFiles => {
  csvFiles = _csvFiles;

  return Promise.all(csvFiles.map(f => readAndParseFile(`${resultsDir}/${f}`)))
})
.then(csvRows => {
  csvRows.forEach((sheet, idx) => {
    const sheetName = csvFiles[idx].replace(".csv", "");
    console.log("sheet name is", sheetName);

    const newSheet = workbook.add(sheetName);

    //iterate over the sheet and add rows and columns
    sheet.forEach((row, i) => {
      row.forEach((column, j) => {
        newSheet[i][j] = column;
      });
    });
  });

  //this should save as "license-summary.xlsx", but for some reason is just ".xlsx"
  workbook.save("license-summary");
})
