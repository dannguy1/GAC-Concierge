# GAC-Concierge Agent & Development Guidelines

Welcome to the GAC-Concierge codebase. This project migrates a prototype AI-waiter into a professional, enterprise-grade concierge application. 

## Architectural Setup

### Backend (FastAPI)
- **Directory**: `backend/`
- **Main Entry**: `api.py`
- **Responsibilities**: 
  - Host RAG models, menu logic, and LLM orchestration (`agent.py`). 
  - Manage checkout payload from the frontend.
  - Return JSON for frontend consumption.
  
### Frontend (React + Vite)
- **Directory**: `frontend/`
- **Main Entry**: `src/main.jsx` and `src/App.jsx`
- **Responsibilities**:
  - Exclusively handle the user interface, routing, and form validation.
  - Present a stunning, premium aesthetic.
  - Connect to FastAPI via robust service calls.
  
## Rules for AI Assistants
1. **Never use TailwindCSS.** Stick to Vanilla CSS. The design logic here requires tailored component classes.
2. **Prioritize Aesthetics.** Any UI changes must include responsive logic and polished design details (padding, shadows, rich colors, interactive states).
3. **Keep APIs synced.** When updating backend input formats, corresponding frontend functions must also be updated.
4. **Follow Workflows.** Use proper `task_boundary` tools when you are completing a task. Always verify code with a standard Node/Python environment pass.

## Core User Interaction Model
The concierge/waiter must embody the classic **"pencil and paper"** approach to customer service:
1. **Introduction**: Approach the customer with a professional introduction about the restaurant and its offerings.
2. **Consultation**: Answer any questions the customer may have about the menu, ingredients, or history.
3. **Drafting**: Take "notes" (using backend tools) of their desired items and any general comments/allergies.
4. **Summary**: Provide a clear, structured summary of the entire order.
5. **Finalization**: Create a thorough, final order payload ready for the kitchen to prepare.
