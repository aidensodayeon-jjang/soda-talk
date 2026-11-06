#!/bin/bash
set -e
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if [ ! -f .env ]; then
  cp .env.example .env
fi

if [ ! -x node_modules/.bin/tsx ]; then
  npm install
fi

exec npm run dev
