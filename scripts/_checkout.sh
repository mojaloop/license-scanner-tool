#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR=${DIR}/..
LIB_DIR=${ROOT_DIR}/lib

source .env
eval $(${LIB_DIR}/toml-to-env/bin/toml-to-env.js ${ROOT_DIR}/config.toml)

if [ ${mode} == "ci" ]; then
  echo 'ci mode specified. Skipping checkout'
  exit 0
fi

mkdir -p ${ROOT_DIR}/checked_out
cd ${ROOT_DIR}/checked_out

function checkoutRepo() {
  REPO=$1
  echo "Cloning repo: ${REPO}"
  git clone ${REPO} || echo 'repo has already been cloned'
}

for OUTPUT in ${repos}
do
  # echo $OUTPUT
  GITHUB_URL=`echo ${OUTPUT} | awk '{print $1}'`
  checkoutRepo ${GITHUB_URL}
done
