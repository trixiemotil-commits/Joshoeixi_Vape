# Joshoeixi Vape Inventory Management

Simple and responsive inventory management system for **Joshoeixi Vape** using React (client) and Node.js + Express (server).

## Features

- Add, edit, delete inventory items
- Search by product name, brand, or category
- Dashboard cards for total products, stock count, and inventory value
- Mobile-friendly responsive layout
- Price formatting in **Philippine Peso (PHP)**

## Tech Stack

- Client: React + Vite
- Server: Node.js + Express

## Run Locally

### 1) Start backend API (port 5000)

```bash
cd ../server
npm install
npm run dev
```

### 2) Start frontend (port 5173)

```bash
cd ../client
npm install
npm run dev
```

Open: `http://localhost:5173`

## API Endpoints

- `GET /api/health`
- `GET /api/items`
- `GET /api/items?q=<search>`
- `POST /api/items`
- `PUT /api/items/:id`
- `DELETE /api/items/:id`
