#!/bin/bash
# Class J helper: materialize a throwaway git repo from a case's fixture files so an
# agent can run `git diff <base>..HEAD` exactly as in a real /ship run.
# usage: mkfixture.sh evals/cases/J04   -> prints the temp repo path (base-ref=main, diff scope main..HEAD)
set -e
CASE="$1"
if [ -z "$CASE" ] || [ ! -d "$CASE" ]; then
  echo "usage: mkfixture.sh <case-dir>" >&2
  exit 1
fi
if [ ! -d "$CASE/base" ] || [ ! -d "$CASE/head" ]; then
  echo "ERROR: $CASE has no base/ and/or head/ fixture tree — author them from the case.md spec first" >&2
  exit 1
fi
DIR=$(mktemp -d "${TMPDIR:-/tmp}/ship-eval-XXXX")
git -C "$DIR" init -q
git -C "$DIR" checkout -qb main
# 1. base tree -> synthetic base commit
cp -R "$CASE/base/." "$DIR/"
git -C "$DIR" add -A
git -C "$DIR" -c user.email=eval@ship -c user.name=ship-eval commit -qm 'base' --allow-empty
# 2. head tree -> the phase work on a branch off base
git -C "$DIR" checkout -qb eval/case
cp -R "$CASE/head/." "$DIR/"
git -C "$DIR" add -A
git -C "$DIR" -c user.email=eval@ship -c user.name=ship-eval commit -qm 'phase 1: fixture' --allow-empty
echo "$DIR"
