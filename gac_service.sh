#!/bin/bash
# GAC Concierge Service Manager
# Supports: start | stop | restart | status

PROJECT_DIR="/home/danlnguyen/GAC/GAC-Concierge"
FRONTEND_DIR="$PROJECT_DIR/frontend"
DISPLAY_DIR="$PROJECT_DIR/menu-display"

BACKEND_PID_FILE="$PROJECT_DIR/backend.pid"
FRONTEND_PID_FILE="$PROJECT_DIR/frontend.pid"
DISPLAY_PID_FILE="$PROJECT_DIR/display.pid"

# Kill a process and its entire process group cleanly.
_kill_pid_file() {
    local pid_file="$1"
    local label="$2"
    if [ -f "$pid_file" ]; then
        local PID
        PID=$(cat "$pid_file")
        # Derive the process group ID and kill the whole group so child
        # processes (e.g. Vite spawned by npm) don't become orphans.
        local PGID
        PGID=$(ps -o pgid= -p "$PID" 2>/dev/null | tr -d ' ')
        if [ -n "$PGID" ] && [ "$PGID" != "0" ]; then
            kill -TERM -"$PGID" 2>/dev/null && echo "[STOP] $label process group (PGID: $PGID) stopped."
        elif kill -0 "$PID" 2>/dev/null; then
            kill "$PID" && echo "[STOP] $label (PID: $PID) stopped."
        else
            echo "[INFO] $label was not running."
        fi
        rm -f "$pid_file"
    else
        echo "[INFO] No PID file for $label — nothing to stop."
    fi
}

start() {
    echo "Starting GAC Concierge services..."

    # Start Backend
    if [ -f "$BACKEND_PID_FILE" ] && kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
        echo "[INFO] Backend is already running (PID: $(cat "$BACKEND_PID_FILE"))"
    else
        echo "[START] Starting FastAPI Backend..."
        cd "$PROJECT_DIR" || exit 1
        # setsid gives the process its own session so kill -PGID works reliably
        setsid venv/bin/python backend/api.py > backend.log 2>&1 &
        echo $! > "$BACKEND_PID_FILE"
        echo "[SUCCESS] Backend started (PID: $(cat "$BACKEND_PID_FILE"))"
    fi

    # Start Frontend — wrapped in a restart loop so ECONNRESET crashes auto-recover
    if [ -f "$FRONTEND_PID_FILE" ] && kill -0 "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null; then
        echo "[INFO] Frontend is already running (PID: $(cat "$FRONTEND_PID_FILE"))"
    else
        echo "[START] Starting Vite React Frontend..."
        cd "$FRONTEND_DIR" || exit 1
        setsid bash -c "while true; do cd '$FRONTEND_DIR' && npm run dev >> '$PROJECT_DIR/frontend.log' 2>&1; sleep 2; done" &
        echo $! > "$FRONTEND_PID_FILE"
        echo "[SUCCESS] Frontend started (PID: $(cat "$FRONTEND_PID_FILE"))"
    fi

    # Start Menu Display
    if [ -f "$DISPLAY_PID_FILE" ] && kill -0 "$(cat "$DISPLAY_PID_FILE")" 2>/dev/null; then
        echo "[INFO] Menu Display is already running (PID: $(cat "$DISPLAY_PID_FILE"))"
    else
        echo "[START] Starting Menu Display..."
        cd "$DISPLAY_DIR" || exit 1
        setsid bash -c "while true; do cd '$DISPLAY_DIR' && npm run dev >> '$PROJECT_DIR/display.log' 2>&1; sleep 2; done" &
        echo $! > "$DISPLAY_PID_FILE"
        echo "[SUCCESS] Menu Display started (PID: $(cat "$DISPLAY_PID_FILE"))"
    fi

    echo "Ready! Backend on http://localhost:8000 | Frontend on http://localhost:8501 | Display on http://localhost:8503"
}

stop() {
    echo "Stopping GAC Concierge services..."
    _kill_pid_file "$BACKEND_PID_FILE"  "Backend"
    _kill_pid_file "$FRONTEND_PID_FILE" "Frontend"
    _kill_pid_file "$DISPLAY_PID_FILE"  "Menu Display"
}

status() {
    echo "=== Service Status ==="
    if [ -f "$BACKEND_PID_FILE" ] && kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
        echo "🟢 Backend:  RUNNING (PID: $(cat "$BACKEND_PID_FILE"))"
    else
        echo "🔴 Backend:  STOPPED"
    fi
    if [ -f "$FRONTEND_PID_FILE" ] && kill -0 "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null; then
        echo "🟢 Frontend: RUNNING (PID: $(cat "$FRONTEND_PID_FILE"))"
    else
        echo "🔴 Frontend: STOPPED"
    fi
    if [ -f "$DISPLAY_PID_FILE" ] && kill -0 "$(cat "$DISPLAY_PID_FILE")" 2>/dev/null; then
        echo "🟢 Display:  RUNNING (PID: $(cat "$DISPLAY_PID_FILE"))"
    else
        echo "🔴 Display:  STOPPED"
    fi
    echo "Vite workers: $(ps aux | grep -E 'node.*vite' | grep -v grep | wc -l)"
    echo "======================"
}

case "$1" in
    start)   start   ;;
    stop)    stop    ;;
    restart) stop; sleep 2; start ;;
    status)  status  ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac

