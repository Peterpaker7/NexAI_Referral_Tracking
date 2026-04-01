# NexAI — Patient Registration Module

## Project Structure
```
nexai/
├── backend/
│   ├── server.js          # Express API
│   ├── schema.sql         # PostgreSQL schema
│   ├── package.json
│   └── .env.example
└── frontend/
    └── src/components/
        └── PatientRegistration.jsx   # React component
```

## Setup Instructions

### 1. Database
```bash
# Create database
createdb nexai

# Run schema
psql -d nexai -f backend/schema.sql
```

### 2. Backend
```bash
cd backend
npm install

# Copy and fill environment variables
cp .env.example .env
# Edit .env: set your DATABASE_URL

npm run dev   # development
npm start     # production
```

### 3. Frontend
```bash
# In your React project, copy PatientRegistration.jsx
# Install dependencies if needed:
npm install

# Use in App.jsx:
import PatientRegistration from './components/PatientRegistration'
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /patients | Register new patient |
| GET | /patients?search= | Search patients |
| GET | /patients/:id | Get patient by ID |
| GET | /health | Health check |

## Features
- ✅ Auto-generate patient code (NX-000001 format)
- ✅ Auto-calculate EDD from LMP
- ✅ Real-time gestational age display
- ✅ Mobile-first responsive UI
- ✅ Search by name, phone, or patient code
- ✅ Input validation (frontend + backend)
- ✅ Patient detail modal

## Environment Variables
```
DATABASE_URL=postgresql://username:password@localhost:5432/nexai
PORT=5000
```
