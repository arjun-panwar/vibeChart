# Vibe Chart

A powerful interactive visualization tool for exploring codebases. Vibe Chart visualizes directory structures, file relationships, and data flow (function calls) in a beautiful, interactive graph.

## Features

-   **Interactive File System Tree**: Visualize folders, files, classes, and functions as nodes.
-   **Data Flow Analysis**: Automatically detects function calls in Python code and renders them as "pink" data flow edges.
-   **Dynamic Anchoring**: Edges automatically route to visible parent nodes when children are collapsed.
-   **Navigation Controls**:
    -   **Breadcrumbs**: Track your path and navigate back easily.
    -   **Search**: Instantly find and focus on specific code entities.
    -   **Go to Parent**: Navigate up the hierarchy with a single click.
-   **Full-Screen Visualization**: Immersive React Flow based UI.

## Prerequisites

-   **Python 3.11+**
-   **Node.js 18+**
-   **Conda** (recommended for environment management)
-   **Poetry** (for Python dependency management)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone git@github.com:arjun-panwar/vibeChart.git
cd vibe-chart
```

### 2. Backend Setup

The backend is built with FastAPI and handles scanning, parsing, and data flow analysis.

1.  **Create and Activate Conda Environment**:
    ```bash
    conda create -n vibe_chart_env python=3.11
    conda activate vibe_chart_env
    ```

2.  **Install Python Dependencies**:
    ```bash
    pip install poetry
    poetry install
    ```

3.  **Run the Backend Server**:
    ```bash
    # Runs on http://localhost:8000
    poetry run uvicorn backend.main:app --reload --port 8000
    ```

### 3. Frontend Setup

The frontend is built with React, Vite, and React Flow.

1.  **Navigate to frontend directory**:
    ```bash
    cd frontend
    ```

2.  **Install Node Dependencies**:
    ```bash
    npm install
    ```

3.  **Run the Development Server**:
    ```bash
    # Runs on http://localhost:5173
    npm run dev
    ```

## Usage

1.  Open your browser and navigate to `http://localhost:5173`.
2.  Enter the absolute path of the directory you want to visualize (e.g., `/home/user/projects/my-python-project`).
3.  Click **Scan** to generate the graph.
4.  **Interact**:
    -   **Click Folders** to expand/collapse.
    -   **Search** for specific functions or classes using the search bar (top-right).
    -   **Follow Breadcrumbs** (top-left) to see where you are.
    -   **Observe Pink Edges** to see function calls. Click an edge to focus on the target.
