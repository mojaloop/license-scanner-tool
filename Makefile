# The legacy `make`-based license-scanner has been REMOVED.
#
# It depended on an unmaintained license-checker fork and used eval / docker cp
# (supply-chain + command-injection risks). It is replaced by the npm package
# @mojaloop/license-scanner-tool (see README.md).
#
# This stub exists only so old CI that still runs `make build … run` fails with a
# clear, actionable message instead of a cryptic "no rule to make target" error.

define REMOVED_MSG
ERROR: the legacy make-based license-scanner has been removed.
       It is now the npm package @mojaloop/license-scanner-tool.
       Upgrade your CI to mojaloop/build@>=2.0.0 (which runs:
         npx @mojaloop/license-scanner-tool <dir-or-sbom>)
       See https://github.com/mojaloop/license-scanner-tool#readme
endef
export REMOVED_MSG

.PHONY: build default-files set-up run postprocess cleanup

build default-files set-up run postprocess cleanup:
	@echo "$$REMOVED_MSG" >&2
	@exit 1

.DEFAULT:
	@echo "$$REMOVED_MSG" >&2
	@exit 1
