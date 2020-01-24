
const toml = require('toml');
const fs = require('fs')
const tomlString = fs.readFileSync('../config.toml')

const config = toml.parse(tomlString).environment

//Split the exclude list on the ; delimiter
const excludeList = config.excludeList.map(s => {
  const [ package, reason ] = s.split(';')

  return {
    package,
    reason
  }
})

module.exports = {
  allowedList: config.allowedList,
  excludeList,
}