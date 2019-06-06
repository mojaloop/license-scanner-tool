#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LIB_DIR=${DIR}/lib
export CFLAGS=-I/usr/local/opt/openssl/include
export LDFLAGS=-L/usr/local/opt/openssl/lib

source .env
eval $(${LIB_DIR}/toml-to-env/bin/toml-to-env.js ${DIR}/config.toml)

mkdir -p ${DIR}/checked_out
cd ${DIR}/checked_out

function checkoutRepo() {
  REPO=$1
  echo "Cloning repo: ${REPO}"
  git clone ${REPO}
}

for OUTPUT in ${repos}
do
  # echo $OUTPUT
  GITHUB_URL=`echo ${OUTPUT} | awk '{print $1}'`
  checkoutRepo ${GITHUB_URL}
done
