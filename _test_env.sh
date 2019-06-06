#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LIB_DIR=${DIR}/lib

eval $(${LIB_DIR}/toml-to-env/bin/toml-to-env.js ${DIR}/config.toml)
env
