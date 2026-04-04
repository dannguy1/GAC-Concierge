#!/bin/bash
# GAC Concierge Service Manager
# Supports: start | stop | restart | status

PROJECT_DIR="/home/danlnguyen/GAC/GAC-Concierge"
FRONTEND_DIR="$PROJECT_DIR/frontend"

BACKEND_PID_FILE="$PROJECT_DIR/backend.pid"
FRONTEND_PID_FILE="$PROJECT_DIR/frontend.pid"

start() {
    echo "Starting GAC Concierge services..."
    
    # Start Backend
    if [ -f "$BACKEND_PID_FILE" ] && kill -0 $(cat "$BACKEND_PID_FILE") 2>/dev/null; then
        echo "[INFO] Backend is already running (PID: $(cat $BACKEND_PID_FILE))"
    else
        echo "[START] Starting FastAPI Backend..."
        cd "$PROJECT_DIR" || exit 1
        nohup venv/bin/python backend/api.py > backend.log 2>&1 &
        echo $! > "$BACKEND_PID_FILE"
        echo "[SUCCESS] Backend started (PID: $(cat $BACKEND_PID_FILE))"
    fi

    # Start Frontend
    if [ -f "$FRONTEND_PID_FILE" ] && kill -0 $(cat "$FRONTEND_PID_FILE") 2>/dev/null; then
        echo "[INFO] Frontend is already running (PID: $(cat $FRONTEND_PID_FILE))"
    else
        echo "[START] Starting Vite React Frontend..."
        cd "$FRONTEND_DIR" || exit 1
        nohup npm run dev > frontend.log 2>&1 &
        echo $! > "$FRONTEND_PID_FILE"
        echo "[SUCCESS] Frontend started (PID: $(cat $FRONTEND_PID_FILE))"
    fi
    echo "Ready! Backend on http://localhost:8000 | Frontend on http://localhost:5173"
}

stop() {
    echo "Stopping GAC Concierge services..."
    
    # Stop Backend
    if [ -f "$BACKEND_PID_FILE" ]; then
        PID=$(cat "$BACKEND_PID_FILE")
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            echo "[STOP] Backend (PID: $PID) successfully stopped."
        else
            echo "[INFO] Backend was not running."
        fi
        rm -f "$BACKEND_PID_FILE"
    else
        pkill -f "python backend/api.py"
        pkill -f "uvicorn"
        echo "[STOP] Backend process killed via fallback."
    fi

    # Stop Frontend
    if [ -f "$FRONTEND_PID_FILE" ]; then
        PID=$(cat "$FRONTEND_PID_FILE")
        if kill -0 $PID 2>/dev/null; then
            # Kill parent node command and child vite process
            pkill -P $PID
            kill $PID
            echo "[STOP] Frontend (PID: $PID) successfully stopped."
        else
            echo "[INFO] Frontend was not running."
        fi
        rm -f "$FRONTEND_PID_FILE"
    else
        pkill -f "vite" && echo "[STOP] Frontend Vite process killed via fallback."
    fi
}

status() {
    echo "=== Service Status ==="
    
    if [ -f "$BACKEND_PID_FILE" ] && kill -0 $(cat "$BACKEND_PID_FILE") 2>/dev/null; then
        echo "🟢 Backend: RUNNING (PID: $(cat $BACKEND_PID_FILE))"
    else
        echo "🔴 Backend: STOPPED"
    fi

    if [ -f "$FRONTEND_PID_FILE" ] && kill -0 $(cat "$FRONTEND_PID_FILE") 2>/dev/null; then
        echo "🟢 Frontend: RUNNING (PID: $(cat $FRONTEND_PID_FILE))"
    else
        echo "🔴 Frontend: STOPPED"
    fi
    echo "======================"
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        stop
        sleep 2
        start
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
