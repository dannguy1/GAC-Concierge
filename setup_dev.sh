#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "========================================="
echo "   GAC Concierge - Development Setup"
echo "========================================="

# 1. Setup Backend (Python Virtual Environment)
echo ""
echo ">>> Setting up Python backend environment..."
if [ ! -d "venv" ]; then
    echo "Creating virtual environment in 'venv'..."
    python3 -m venv venv
else
    echo "Virtual environment 'venv' already exists."
fi

echo "Activating virtual environment and installing requirements..."
source venv/bin/activate
pip install --upgrade pip
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
else
    echo "Warning: requirements.txt not found!"
fi

# 2. Setup Frontend (Node.js/npm)
echo ""
echo ">>> Setting up Node.js frontend environment..."
if [ -d "frontend" ]; then
    cd frontend
    if command -v npm &> /dev/null; then
        echo "Installing frontend dependencies..."
        npm install
    else
        echo "Error: npm is not installed. Please install Node.js and npm to setup the frontend."
        exit 1
    fi
    cd ..
else
    echo "Warning: frontend directory not found!"
fi

# 3. Directories Setup
echo ""
echo ">>> Creating necessary working directories..."
mkdir -p data models cache
echo "Created: data/ models/ cache/"

# 4. Environment Variables Setup
echo ""
echo ">>> Checking Environment Variables..."
if [ ! -f ".env" ]; then
    echo "Creating a default .env file..."
    cat <<EOF > .env
# --- Backend Environment Variables ---
OPENAI_API_KEY=your_openai_api_key_here

# Optional Configurations
PORT=8000
HOST=0.0.0.0

# --- Frontend Environment Variables ---
# (Optionally handled inside frontend/.env)
EOF
    echo ".env file created. Please update it with your actual OPENAI_API_KEY."
else
    echo ".env file already exists."
fi

# 5. Final Instructions
echo ""
echo "========================================="
echo "Setup Complete!"
echo ""
echo "To start development:"
echo "1. Activate the Python virtual environment:"
echo "   source venv/bin/activate"
echo ""
echo "2. Start the backend Server (using your existing script or uvicorn):"
echo "   ./gac_service.sh start"
echo "   or"
echo "   uvicorn backend.main:app --reload"
echo ""
echo "3. Start the frontend development server:"
echo "   cd frontend && npm run dev"
echo "========================================="
