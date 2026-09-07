#!/bin/bash
cd "c:/src/portfolio-engineering/portfolio-engineering"
node --test --experimental-strip-types "apps/frontend/src/sessionState.test.ts" 2>&1
EXIT_CODE=$?
echo ""
echo "EXIT_CODE: $EXIT_CODE"
