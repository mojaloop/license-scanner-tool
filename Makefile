PROJECT = "LICENSE_SCANNER"
dir = $(shell pwd)
# include ./config/.compiled_env
# env_dir := $(dir)/config


# ##
# # Env
# ##

# env:
# 	cat ${env_dir}/mojaloop.public.sh ${env_dir}/mojaloop.private.sh > ${env_dir}/.compiled_env

default:
	make set-up run cleanup

##
# Set Up
##
set-up:
	@make set-up-git set-up-install

set-up-git:
	@./_checkout.sh

set-up-install:
	@./_install.sh


##
# Run Commands
##
run:
	@./_run.sh

run-one:
	@echo "Command not supported yet"

cleanup:
	@./_cleanup.sh




.PHONY: run-all run-one cleanup