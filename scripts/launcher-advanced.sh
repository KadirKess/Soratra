#!/usr/bin/env bash

advanced_settings() {
  [ -t 0 ] || fail 'Advanced settings need a terminal. Use configure with flags for unattended port and contact edits.'
  local pending=() choice='' value='' key='' label='' mode='' api_key='' host='' port='' index=0
  advanced_get() {
    local wanted="$1" i=0
    while [ "$i" -lt "${#pending[@]}" ]; do
      if [ "${pending[$i]}" = "$wanted" ]; then printf '%s' "${pending[$((i + 1))]}"; return; fi
      i=$((i + 2))
    done
    config get "$wanted"
  }
  advanced_set() {
    local i=0
    if [ "$1" != RESEND_API_KEY ]; then config validate "$1" "$2"; fi
    while [ "$i" -lt "${#pending[@]}" ]; do
      if [ "${pending[$i]}" = "$1" ]; then pending[$((i + 1))]="$2"; return; fi
      i=$((i + 2))
    done
    pending+=("$1" "$2")
  }
  advanced_prompt() {
    local answer='' current=''
    current="$(advanced_get "$2")"
    printf '  %s [%s]: ' "$1" "${current:-not set}" >&2
    IFS= read -r answer || fail 'Settings cancelled. Nothing was saved.'
    if [ "$answer" = '-' ]; then printf ''; else printf '%s' "${answer:-$current}"; fi
  }
  while true; do
    printf '\n  %sADVANCED SETTINGS%s\n' "$ink" "$reset"
    say 'Changes are saved together. Enter keeps a value; - clears optional fields.'
    printf '\n  1  Personal details       Name and contact on legal pages\n  2  Local port             Address on this computer\n  3  Email recovery         Disabled or a verified Resend sender\n  4  Public hosting         Domain, HTTPS, and access from outside\n  5  Security and source    Reporting contact and source link\n  6  Runtime                Database connections and search visibility\n\n  s  Review and save\n  q  Cancel without saving\n\n'
    choice="$(prompt 'Choose an option' q)"
    case "$choice" in
      1)
        say 'These details appear on the legal and support pages.'
        advanced_set LEGAL_NAME "$(advanced_prompt 'Your name or organisation' LEGAL_NAME)"
        advanced_set SUPPORT_EMAIL "$(advanced_prompt 'Contact email (optional for personal use)' SUPPORT_EMAIL)" ;;
      2)
        say 'An available port between 1024 and 65535; default 3000.'
        port="$(advanced_prompt 'Local port' APP_PORT)"
        port="${port:-3000}"
        config validate APP_PORT "$port"
        if [ "$port" != "$(config get APP_PORT)" ]; then port_available "$port" || fail "Port $port is busy. Nothing was saved."; fi
        advanced_set APP_PORT "$port" ;;
      3)
        say 'Email recovery needs a Resend account and verified sending domain.'
        mode="$(advanced_prompt 'Email mode: disabled or resend' EMAIL_MODE)"
        config validate EMAIL_MODE "$mode"
        advanced_set EMAIL_MODE "$mode"
        if [ "$mode" = resend ]; then
          advanced_set EMAIL_FROM "$(advanced_prompt 'Verified sender (e.g. Soratra <books@your-domain.org>)' EMAIL_FROM)"
          printf '  Resend API key (hidden; Enter keeps the saved key): ' >&2
          IFS= read -rs api_key || fail 'Settings cancelled. Nothing was saved.'
          printf '\n' >&2
          if [ -n "$api_key" ]; then advanced_set RESEND_API_KEY "$api_key"; fi
        fi ;;
      4)
        say 'Personal stays on localhost. Public opens HTTPS ports 80 and 443.'
        say 'Public hosting needs a domain pointing here, real contact details,'
        say 'and verified email recovery. Configure options 1 and 3 before saving.'
        mode="$(advanced_prompt 'Hosting mode: local or public' DEPLOYMENT_MODE)"
        config validate DEPLOYMENT_MODE "$mode"
        advanced_set DEPLOYMENT_MODE "$mode"
        if [ "$mode" = public ]; then
          host="$(advanced_prompt 'Domain (e.g. books.your-domain.org)' PUBLIC_HOST)"
          advanced_set PUBLIC_HOST "$host"
          advanced_set SITE_URL "https://$host"
          advanced_set AUTH_URL "https://$host"
          advanced_set TRUSTED_PROXY_IP_HEADER x-real-ip
        else
          port="$(advanced_get APP_PORT)"; port="${port:-3000}"
          advanced_set SITE_URL "http://localhost:$port"
          advanced_set AUTH_URL "http://localhost:$port"
          advanced_set TRUSTED_PROXY_IP_HEADER ''
          advanced_set PUBLIC_HOST ''
        fi ;;
      5)
        say 'Blank source link uses the source archive bundled with Soratra.'
        advanced_set SECURITY_CONTACT "$(advanced_prompt 'Security contact: mailto: address or HTTPS link' SECURITY_CONTACT)"
        advanced_set SECURITY_EXPIRES "$(advanced_prompt 'Security expiry: future YYYY-MM-DDTHH:MM:SSZ (optional)' SECURITY_EXPIRES)"
        advanced_set SOURCE_CODE_URL "$(advanced_prompt 'Source code HTTPS link (optional)' SOURCE_CODE_URL)" ;;
      6)
        advanced_set POSTGRES_POOL_MAX "$(advanced_prompt 'Maximum database connections (1-20)' POSTGRES_POOL_MAX)"
        say 'preview asks search engines not to index the public pages.'
        advanced_set PUBLIC_DEPLOYMENT "$(advanced_prompt 'Search visibility: preview or public' PUBLIC_DEPLOYMENT)" ;;
      s)
        if [ "${#pending[@]}" -eq 0 ]; then say 'No changes to save.'; continue; fi
        printf '\n  %sREVIEW CHANGES%s\n' "$ink" "$reset"
        index=0
        while [ "$index" -lt "${#pending[@]}" ]; do
          key="${pending[$index]}"; value="${pending[$((index + 1))]}"
          if [ "$key" = RESEND_API_KEY ]; then value='[hidden; new key supplied]'; fi
          case "$key" in
            LEGAL_NAME) label='Name or organisation' ;; SUPPORT_EMAIL) label='Contact email' ;;
            APP_PORT) label='Local port' ;; EMAIL_MODE) label='Email recovery' ;;
            EMAIL_FROM) label='Verified sender' ;; RESEND_API_KEY) label='Resend API key' ;;
            DEPLOYMENT_MODE) label='Hosting mode' ;; PUBLIC_HOST) label='Public domain' ;;
            SITE_URL) label='Journal address' ;; AUTH_URL) label='Sign-in address' ;;
            TRUSTED_PROXY_IP_HEADER) label='Proxy address header' ;;
            SECURITY_CONTACT) label='Security contact' ;; SECURITY_EXPIRES) label='Security contact expiry' ;;
            SOURCE_CODE_URL) label='Source code link' ;; POSTGRES_POOL_MAX) label='Database connections' ;;
            PUBLIC_DEPLOYMENT) label='Search visibility' ;; *) label="$key" ;;
          esac
          printf '  %-25s %s\n' "$label" "${value:-[not set]}"
          index=$((index + 2))
        done
        if [ "$(prompt 'Save these changes? yes/no' no)" != yes ]; then continue; fi
        if printf '%s\0' "${pending[@]}" | config edit-fields; then
          printf '\n'; say 'Saved privately. Database, authentication, and cleanup secrets are preserved.'
          say 'Run ./soratra.sh to apply the settings and start your journal.'
          printf '\n'; return
        else
          say 'Nothing was saved. Correct the settings above or choose q to cancel.'
        fi ;;
      q|0) say 'Cancelled. Saved settings have not changed.'; printf '\n'; return ;;
      *) say 'Choose 1-6, s to save, or q to cancel.' ;;
    esac
  done
}
