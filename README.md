# Sports Ecommerce API

Node.js + Express backend for a sports ecommerce store, connected to MongoDB through `config/db.js`.

## Setup

1. Install [MongoDB](https://www.mongodb.com/docs/manual/installation/) locally, or use a MongoDB Atlas connection string.
2. Copy environment variables:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Set `MONGO_URI` and `JWT_SECRET` in `.env`.
4. Install dependencies and start the API:

```bash
npm install
npm run dev
```

The server listens on `http://localhost:5000` by default.

## MongoDB config

`config/db.js` reads `MONGO_URI` and connects with Mongoose when the app starts.

## API overview

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | no | Health check |
| POST | `/api/auth/register` | no | Create customer account |
| POST | `/api/auth/login` | no | Login, returns JWT |
| GET | `/api/auth/me` | JWT | Current user |
| GET | `/api/categories` | no | List categories |
| POST | `/api/categories` | admin | Create category |
| GET | `/api/products` | no | List products (`sport`, `category`, `featured`, `search`, `page`, `limit`) |
| GET | `/api/products/:id` | no | Product details |
| POST | `/api/products` | admin | Create product |
| PUT | `/api/products/:id` | admin | Update product |
| DELETE | `/api/products/:id` | admin | Delete product |
| GET/POST/PUT/DELETE | `/api/cart` | JWT | Cart |
| POST | `/api/orders` | JWT | Checkout from cart |
| GET | `/api/orders/mine` | JWT | My orders |
| GET | `/api/orders` | `orders:read` | All orders |
| PUT | `/api/orders/:id/status` | `orders:write` | Update order status |
| GET | `/api/search?q=` | optional JWT | Search products, categories, orders, users |
| GET | `/api/users` | `users:manage` | List users |
| POST | `/api/users` | `users:manage` | Create user |
| PATCH | `/api/users/:id/access` | `users:manage` | Grant role and permissions |

Admin role has every permission. Staff can be given specific rights.

Send the JWT as `Authorization: Bearer <token>`.
