# Assami - CBT (Computer-Based Test) Platform

## Overview
Assami is a static HTML/CSS/JavaScript CBT platform for mock test preparation. It supports:
- Full Mock Mode: Complete exam simulation with Tech/Non-Tech sections
- Subject-wise Practice Mode: Focused practice on specific subjects

## Key Features
- No backend required - all data stored in localStorage
- Pattern management for exam configurations
- Performance analytics and session history
- Smart retake system with 4 modes (Same, All New, Improve, Weak Areas)
- Responsive design for desktop and mobile

## Project Structure
```
/
├── index.html           # Main HTML file with all UI components
├── assets/
│   └── js/
│       ├── init.js            # App initialization
│       ├── core-ui.js         # Theme, modals, navigation
│       ├── data-storage.js    # localStorage management
│       ├── exam-engine.js     # Question loading, exam logic
│       ├── navigation.js      # Tab navigation, patterns
│       ├── performance-hub.js # Session history, analytics
│       ├── results-view.js    # Results display, PDF export
│       └── retake-engine.js   # Smart retake functionality
└── replit.md            # This file
```

## localStorage Keys
- `assami_sessions`: Array of completed test sessions
- `assami_patterns`: Saved exam patterns/configurations
- `assami_settings`: User preferences

## Running Locally
The app is served as a static site on port 5000 using Python's http.server.

## Recent Changes
- Fixed subject-wise configuration with per-subject question counts
- Improved layout for Patterns and Performance tabs (no scroll needed)
- Fixed exam engine question loading and navigation
- Added section toggle bar for Full Mock mode
- Cleaned sidebar/palette for different modes
- Enhanced Performance Hub with real session data
