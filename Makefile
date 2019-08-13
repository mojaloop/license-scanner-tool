PROJECT = "LICENSE_SCANNER"
dir = $(shell pwd)
env_file = $(dir)/.env
lib_dir = $(dir)/lib
results_dir = $(dir)/results
scripts_dir = $(dir)/scripts


default: build set-up run

##
# build the license-scanner tool
## 
build:
	@mkdir -p ${lib_dir} ${results_dir}
	@cd ${lib_dir} && git clone https://github.com/vessels-tech/toml-to-env.git || echo 'Already cloned'
	@cd ${lib_dir}/toml-to-env && git fetch && git checkout 69772fd54b05aff36580a739348855f60ee76797 && npm install
	@cd ${lib_dir}/ && npm install
	@cd ${scripts_dir}/ && npm install


	@touch build

default-files:
	@echo 'setting up default files'
	cp .env.template .env


##
# Set Up
##
set-up: check-env set-up-git set-up-install

check-env:
	@if [ -f "${env_file}" ]; then echo 'OK'; else echo "Error: No env file found. Please fill out before continuing"; cat $(dir)/.env.template > .env; exit 1; fi

set-up-git:
	@${scripts_dir}/_checkout.sh

set-up-install:
	@${scripts_dir}/_install.sh


##
# Run Commands
##
run:
	${scripts_dir}/_save_env_override.js
	${scripts_dir}/_run.sh

cleanup: cleanup-results cleanup-repos cleanup-build

cleanup-build:
	@rm -f build

cleanup-repos:
	@${scripts_dir}/_cleanup.sh

cleanup-results:
	@rm -rf ${dir}/results/*
	@rm -f post-csv-to-excel
	@rm -f post-summarize-csv



##
# Post-Processing
## 
postprocess: post-csv-to-excel post-summarize-csv

post-csv-to-excel:
	@cd ${scripts_dir} && node _combine_csv_reports.js
	@#fix issues with the xlsx package
	@mv ${scripts_dir}/.xlsx  $(dir)/results/license-summary.xlsx 
	@touch post-csv-to-excel

post-summarize-csv:
	@cd ${scripts_dir} && ./_color_and_summarize.js
	@touch post-summarize-csv


##
# Utils
## 
util-check-config:
	@${lib_dir}/toml-to-env/bin/toml-to-env.js ${dir}/config.toml || exit 1
	@echo 'OK'


.PHONY: run-all run-one cleanup