#!/usr/bin/env bash
# A brand-new installation driven through first-run setup in the browser, then
# invite-only joining and the admin settings.
source "$(dirname "$0")/lib.sh"

new_install fresh 3203 compose.yaml:docker/compose.test.yaml
up fresh
install_playwright fresh-install 3203

log 'Fresh install scenario passed'
