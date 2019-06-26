#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR=${DIR}/..
LIB_DIR=${ROOT_DIR}/lib

# Allow users to override variables with an env variable
env | grep "mode" >> /tmp/ls_env_override
env | grep "pathToRepo" >> /tmp/ls_env_override
env | grep "dockerImage" >> /tmp/ls_env_override

source .env
eval $(${LIB_DIR}/toml-to-env/bin/toml-to-env.js ${ROOT_DIR}/config.toml)

eval `cat /tmp/ls_env_override`
rm -rf ls_env_override

case ${mode} in
  docker)
    ${DIR}/_run_docker.sh
    ;;
  ci)
    ${DIR}/_run_ci.sh
    ;;
  standalone)
    ${DIR}/_run_standalone.sh
    ;;
  *)
    echo "unsupported mode: ${mode}"
    echo "check your config.toml and try again."
    ;;
esac