PROJECT = "LICENSE_SCANNER"
dir = $(shell pwd)
env_file = $(dir)/.env
lib_dir = $(dir)/lib
scripts_dir = $(dir)/scripts


default:
	make build set-up run cleanup

##
# build tool
## 
build:
	@mkdir -p ${lib_dir}
	@cd ${lib_dir} && git clone git@github.com:vessels-tech/toml-to-env.git || echo 'Already cloned'
	@cd ${lib_dir}/toml-to-env && npm install

	@cd ${lib_dir}/ && npm install

	@cd ${scripts_dir}/ && npm install

##
# Set Up
##
check-env:
	@if [ -f "${env_file}" ]; then echo 'OK'; else echo "Error: No env file found. Please fill out before continuing"; cat $(dir)/.env.template > .env; exit 1; fi

check-config:
	@${lib_dir}/toml-to-env/bin/toml-to-env.js ${dir}/config.toml || exit 1
	@echo 'OK'

set-up:
	@make check-env
	@make set-up-git set-up-install

set-up-git:
	@${scripts_dir}/_checkout.sh

set-up-install:
	@${scripts_dir}/_install.sh

##
# Run Commands
##
run:
	@${scripts_dir}/_run.sh

cleanup:
	@${scripts_dir}/_cleanup.sh


##
# Post-Processing
## 
post-csv-to-excel:
	@cd ${scripts_dir} && node _combine_csv_reports.js
	@#fix issues with the xlsx package:
	@mv ${scripts_dir}/.xlsx  $(dir)/results/license-summary.xlsx 


post-summarize-csv:
	@echo 'Not implemented yet'
	@exit 1


.PHONY: run-all run-one cleanup