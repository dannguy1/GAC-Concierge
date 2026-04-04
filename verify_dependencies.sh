#!/bin/bash
# GAC Concierge Dependency Verification Script
# This script ensures that the system has all required dependencies installed and ready.

echo "========================================"
echo " GAC Concierge Verification Checklist   "
echo "========================================"

FAILED=0

# Helper function for colored status output
check_status() {
    if [ $1 -eq 0 ]; then
        echo -e "[\033[32mOK\033[0m] $2"
    else
        echo -e "[\033[31mFAIL\033[0m] $3"
        FAILED=$((FAILED + 1))
    fi
}

echo ""
echo "--- 1. System Requirements ---"

# Check Node.js
if command -v node >/dev/null 2>&1; then
    check_status 0 "Node.js is installed ($(node -v))" ""
else
    check_status 1 "" "Node.js is missing! Please install Node.js."
fi

# Check npm
if command -v npm >/dev/null 2>&1; then
    check_status 0 "npm is installed ($(npm -v))" ""
else
    check_status 1 "" "npm is missing!"
fi

echo ""
echo "--- 2. Backend Python Environment ---"

if [ -f "venv/bin/python" ]; then
    check_status 0 "Virtual environment found (venv/bin/python)" ""
    
    # Check critical Python packages from requirements
    MISSING_PY_PKGS=""
    # We map pip names to import names where they differ (e.g., python-dotenv -> dotenv)
    for pkg in fastapi uvicorn openai sentence_transformers faiss langdetect dotenv pydantic; do
        if ! ./venv/bin/python -c "import $pkg" >/dev/null 2>&1; then
            MISSING_PY_PKGS="$MISSING_PY_PKGS $pkg"
        fi
    done
    
    if [ -z "$MISSING_PY_PKGS" ]; then
        check_status 0 "All critical Python dependencies are successfully installed." ""
    else
        check_status 1 "" "Missing Python packages:$MISSING_PY_PKGS. Please run: ./venv/bin/pip install -r requirements.txt"
    fi
else
    check_status 1 "" "Virtual environment not found! Please create it using 'python3 -m venv venv' and install requirements."
fi

echo ""
echo "--- 3. Frontend Environment ---"

if [ -d "frontend/node_modules" ]; then
    check_status 0 "Frontend node_modules found." ""
else
    check_status 1 "" "Frontend node_modules missing. Please run 'cd frontend && npm install'."
fi

echo ""
echo "--- 4. Configuration & API Keys ---"

if [ -f ".env" ]; then
    check_status 0 "Backend .env file holds configuration." ""
    
    # 1. Check if keys exist in file
    if grep -q "LLM_API_KEY\|OPENAI_API_KEY" ".env"; then
        check_status 0 "API Keys appear to be configured in .env." ""
        
        # 2. Perform a live ping to the LLM Service
        echo "Pinging LLM Service to verify authentication..."
        LLM_PING=$(./venv/bin/python -c "
import sys, os
try:
    from dotenv import load_dotenv
    from openai import OpenAI
    load_dotenv(override=True)
    
    base_url = os.environ.get('LLM_BASE_URL')
    api_key = os.environ.get('LLM_API_KEY') or os.environ.get('OPENAI_API_KEY')
    
    if not api_key:
        print('MISSING_KEY')
        sys.exit(1)
        
    client = OpenAI(base_url=base_url, api_key=api_key, max_retries=1)
    # Ping the models endpoint to verify auth without generating tokens
    client.models.list()
    print('OK')
except Exception as e:
    print(f'ERROR: {e}')
    sys.exit(1)
" 2>&1)

        if [ "$LLM_PING" = "OK" ]; then
            check_status 0 "LLM Service is REACHABLE and Authentication is VALID." ""
        else
            check_status 1 "" "LLM Service Ping Failed: $LLM_PING"
        fi

    else
        check_status 1 "" "No LLM_API_KEY found in .env. The agent will not work."
    fi
else
    check_status 1 "" "Missing .env file in the root directory! API keys and secrets are required."
fi

echo ""
echo "========================================"
if [ $FAILED -eq 0 ]; then
    echo -e "\033[32mAll primary checks passed! The system dependencies are fully ready.\033[0m"
    echo "You can start the system by running: ./gac_service.sh start"
else
    echo -e "\033[31mFound $FAILED missing dependencies or issues. Please resolve them before starting the system.\033[0m"
fi
exit $FAILED
