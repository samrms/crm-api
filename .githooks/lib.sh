#!/usr/bin/env bash
# Shared helpers for the hooks in this directory.
# shellcheck shell=bash

if [ -t 1 ]; then
  _dim=$'\033[2m'; _red=$'\033[31m'; _green=$'\033[32m'; _off=$'\033[0m'
else
  _dim=''; _red=''; _green=''; _off=''
fi

log() { printf '%s==>%s %s\n' "$_dim" "$_off" "$*"; }
warn() { printf '%swarn:%s %s\n' "$_red" "$_off" "$*" >&2; }
ok() { printf '%sok:%s %s\n' "$_green" "$_off" "$*"; }

need_cmd() {
  command -v "$1" > /dev/null 2>&1 || {
    warn "required command not found: $1"
    exit 1
  }
}
