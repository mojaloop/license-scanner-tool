#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR=${DIR}/..
LIB_DIR=${ROOT_DIR}/lib
source ${DIR}/colors.sh

##
# Set up the environment: 
# 1. the common .env
# 2. env from config.toml
# 3. Any env overrides found
##
source .env
eval $(${LIB_DIR}/toml-to-env/bin/toml-to-env.js ${ROOT_DIR}/config.toml)
source .env_override

if [ ! -d "${pathToRepo}" ]; then 
  logErr "cannot find pathToRepo: ${pathToRepo}. Please check and try again"
  exit 1
fi

mkdir -p ${ROOT_DIR}/results

excludeList=`echo ${excludeList} | awk '{MAX=split($0,a,";"); for (x=1; x <= MAX; x = x + 2) {printf a[x]; printf ";";}}'`

echo "Excluding the following packages: ${excludeList}"
echo "Failing on the following licenses: ${failList}"

function listLicenses() {
  cd ${pathToRepo}
  ${LIB_DIR}/node_modules/.bin/license-checker . \
    --production --csv > ${ROOT_DIR}/results/licenses.csv
}

function checkLicenses() {
  output=/tmp/license_output

  cd ${pathToRepo}
  ${LIB_DIR}/node_modules/.bin/license-checker  . \
    --excludePackages ${excludeList} \
    --failOn ${failList} \
    --production --csv > ${output}

  if [ "${LOG_LEVEL}" == "info" ]; then
    cat ${output}
  fi
}

listLicenses
checkLicenses