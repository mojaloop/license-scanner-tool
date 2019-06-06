# License-Scanner

A Tool for scanning the licenses of multiple github projects at once


## Installation

```bash
make build
```


## Running

```bash
# clone all of the repos defined in `config.toml`
make set-up

# run the analysis
make run

# if you chose `fossa-json` or `csv`, results will be available in the results dir 

# get your disk space back
make cleanup

```