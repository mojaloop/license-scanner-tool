#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source .env
export CFLAGS=-I/usr/local/opt/openssl/include
export LDFLAGS=-L/usr/local/opt/openssl/lib

mkdir -p ${DIR}/checked_out
cd ${DIR}/checked_out

function checkoutRepo() {
  REPO=$1
  echo "Cloning repo: ${REPO}"
  git clone ${REPO}
}

for OUTPUT in $(cat ${DIR}/repos | grep "^[^#;]")
do
  GITHUB_URL=`echo ${OUTPUT} | awk '{print $1}'`
  checkoutRepo ${GITHUB_URL}
done
