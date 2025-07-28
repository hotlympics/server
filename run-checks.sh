#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -n "Installing dependencies ..."
    OUTPUT=$(npm install 2>&1)
    if [ $? -eq 0 ]; then
        echo -e " ${GREEN}[PASSED]${NC}"
    else
        echo -e " ${RED}[FAILED]${NC}"
        echo "$OUTPUT"
        exit 1
    fi
fi

# Run formatter with auto-fix
echo -n "Checking code formatting ..."
OUTPUT=$(npm run format 2>&1)
if [ $? -eq 0 ]; then
    echo -e " ${GREEN}[PASSED]${NC}"
else
    echo -e " ${RED}[FAILED]${NC}"
    echo "$OUTPUT"
    exit 1
fi

# Run linter with auto-fix
echo -n "Running ESLint ..."
OUTPUT=$(npm run lint:fix 2>&1)
if [ $? -eq 0 ]; then
    echo -e " ${GREEN}[PASSED]${NC}"
else
    echo -e " ${RED}[FAILED]${NC}"
    echo "$OUTPUT"
    exit 1
fi

# Run build (includes TypeScript check)
echo -n "Running build (TypeScript check) ..."
OUTPUT=$(npm run build 2>&1)
if [ $? -eq 0 ]; then
    echo -e " ${GREEN}[PASSED]${NC}"
else
    echo -e " ${RED}[FAILED]${NC}"
    echo "$OUTPUT"
    exit 1
fi