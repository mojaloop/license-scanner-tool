#!/usr/bin/env bash

##
# _run_docker allows you to run the license scan against node_modules in a docker image
# for now, it simply runs the docker image, copies the node_modules out, and then runs
# _run_ci tool
##

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR=${DIR}/..
LIB_DIR=${ROOT_DIR}/lib

# Allow users to override variables with an env variable
env | grep "dockerImage" > /tmp/ls_env_override

source .env
eval $(${LIB_DIR}/toml-to-env/bin/toml-to-env.js ${ROOT_DIR}/config.toml)
eval `cat /tmp/ls_env_override`
rm -rf ls_env_override

containerName=$(echo ${dockerImage} | awk -F"/|:" '{print $2}')

mkdir -p /tmp/$containerName/node_modules

docker rm -f $containerName || echo 'Container already stopped'

docker pull $dockerImage
docker run -d \
  --name $containerName \
  $dockerImage /bin/sh -c 'tail -f /dev/null'

docker cp $containerName:/opt/$containerName/node_modules /tmp/$containerName/node_modules


# For now, call _run_ci.sh, with a pathToRepo of /tmp/$containerName/node_modules
pathToRepo=/tmp/$containerName/node_modules ${DIR}/_run_ci.sh
result=$?

#cleanup
rm -rf /tmp/$containerName/node_modules
docker rm -f $containerName


exit ${result}
