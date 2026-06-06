# 🍽️ FoodReels Backend API

Node.js + Express + MongoDB + Socket.IO backend for the FoodReels app.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your MongoDB URI and secrets

# 3. Seed demo data
npm run seed

# 4. Start dev server
npm run dev
# Server runs at http://localhost:5000
```

---

## 👥 User Roles

| Role         | Can Do |
|--------------|--------|
| `customer`   | Browse reels, place orders, track delivery, manage addresses |
| `owner`      | Manage restaurant, upload food videos, manage orders |
| `deliveryman`| Accept orders, update live GPS location, mark delivered |
| `admin`      | Approve restaurants, manage all users, view all orders |

---

## 🔑 Authentication

All protected routes require:
```
Authorization: Bearer <accessToken>
```

Tokens expire in 7 days. Use `/api/auth/refresh` with `refreshToken` to get new tokens.

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/register` | Public | Register (customer/deliveryman) |
| POST | `/api/auth/login` | Public | Login → returns accessToken + refreshToken |
| POST | `/api/auth/refresh` | Public | Refresh access token |
| POST | `/api/auth/logout` | Auth | Logout |
| GET | `/api/auth/me` | Auth | Get current user |

### Users
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/users/profile` | Auth | Get my profile |
| PUT | `/api/users/profile` | Auth | Update profile (+ avatar upload) |
| PUT | `/api/users/password` | Auth | Change password |
| GET | `/api/users/addresses` | Customer | List saved addresses |
| POST | `/api/users/addresses` | Customer | Add address |
| PUT | `/api/users/addresses/:id` | Customer | Update address |
| DELETE | `/api/users/addresses/:id` | Customer | Delete address |
| GET | `/api/users` | Admin | List all users (filter by ?role=) |
| PUT | `/api/users/:id/status` | Admin | Activate/deactivate user |
| PUT | `/api/users/:id/role` | Admin | Change user role |

### Restaurants
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/restaurants` | Public | List approved restaurants |
| GET | `/api/restaurants/:id` | Public | Get single restaurant |
| POST | `/api/restaurants` | Owner | Create restaurant |
| GET | `/api/restaurants/owner/mine` | Owner | Get my restaurant |
| PUT | `/api/restaurants/:id` | Owner | Update restaurant |
| PUT | `/api/restaurants/:id/toggle` | Owner | Open/close toggle |
| GET | `/api/restaurants/admin/pending` | Admin | Pending approval list |
| PUT | `/api/restaurants/:id/approve` | Admin | Approve restaurant |

### Food / Reels
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/food/reels` | Public | Get reel feed (?page=1&limit=10) |
| GET | `/api/food/restaurant/:id` | Public | Get menu of restaurant |
| GET | `/api/food/:id` | Public | Get single food item |
| POST | `/api/food` | Owner | Create food item + upload video |
| PUT | `/api/food/:id` | Owner | Update food item |
| DELETE | `/api/food/:id` | Owner | Delete food item |
| POST | `/api/food/:id/like` | Customer | Like/unlike food reel |

### Orders
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/orders` | Customer | Place order |
| GET | `/api/orders/my` | Customer | My order history |
| POST | `/api/orders/:id/cancel` | Customer | Cancel order |
| GET | `/api/orders/restaurant/:id` | Owner | Restaurant's orders |
| PUT | `/api/orders/:id/status` | Owner | Update status (confirmed/preparing/ready) |
| GET | `/api/orders/available` | Deliveryman | Orders ready for pickup |
| POST | `/api/orders/:id/accept` | Deliveryman | Accept an order |
| PUT | `/api/orders/:id/deliver` | Deliveryman | Mark as delivered |
| GET | `/api/orders/deliveryman/mine` | Deliveryman | My delivery history |
| PUT | `/api/orders/:id/location` | Deliveryman | Update live GPS location |
| GET | `/api/orders` | Admin | All orders |
| GET | `/api/orders/:id` | Auth | Get order detail (role-checked) |

### Deliveryman
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| PUT | `/api/deliveryman/availability` | Deliveryman | Toggle availability |
| PUT | `/api/deliveryman/location` | Deliveryman | Update GPS location |
| PUT | `/api/deliveryman/vehicle` | Deliveryman | Set vehicle info |
| GET | `/api/deliveryman/stats` | Deliveryman | My earnings & stats |
| GET | `/api/deliveryman/all` | Admin | List all deliverymen |

---

## ⚡ Socket.IO Real-Time Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `join_order` | `orderId` | Join order room for live updates |
| `leave_order` | `orderId` | Leave order room |
| `join_restaurant` | `restaurantId` | Owner joins restaurant room |
| `send_location` | `{ orderId, lat, lng }` | Deliveryman sends GPS |
| `set_availability` | `boolean` | Deliveryman toggles availability |
| `order_message` | `{ orderId, message }` | Chat message in order |

### Server → Client
| Event | Description |
|-------|-------------|
| `new_order` | Restaurant owner: new order arrived |
| `order_update` | Status changed (confirmed/preparing/ready/picked_up/delivered) |
| `location_update` | Live GPS `{ lat, lng }` from deliveryman |
| `order_ready_for_pickup` | Broadcast to available deliverymen |
| `order_message` | Chat message in order room |

### Socket Auth
```js
const socket = io("http://localhost:5000", {
  auth: { token: "Bearer eyJhbG..." }
});
```

---

## 📁 Project Structure

```
src/
├── server.js              ← Entry point
├── config/
│   └── db.js              ← MongoDB connection
├── models/
│   ├── User.js            ← customer / owner / deliveryman / admin
│   ├── Restaurant.js
│   ├── FoodItem.js        ← with video URL
│   ├── Order.js           ← full order lifecycle
│   └── Review.js
├── controllers/
│   ├── authController.js
│   ├── userController.js
│   ├── restaurantController.js
│   ├── foodController.js
│   ├── orderController.js
│   └── deliveryController.js
├── middleware/
│   ├── auth.js            ← JWT protect + role authorize
│   └── upload.js          ← Multer video/image upload
├── routes/
│   ├── auth.js
│   ├── users.js
│   ├── restaurants.js
│   ├── food.js
│   ├── orders.js
│   └── delivery.js
├── services/
│   └── socket.js          ← Socket.IO real-time service
└── utils/
    ├── jwt.js
    ├── response.js
    └── seed.js            ← Demo data seeder
```

---

## 🔄 Order Status Flow

```
pending → confirmed → preparing → ready → picked_up → on_the_way → delivered
                                                    ↘ cancelled (owner/customer)
```

---

## 📦 Demo Accounts (after npm run seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@foodreels.com | admin123 |
| Owner | owner@foodreels.com | owner123 |
| Customer | customer@foodreels.com | customer123 |
| Deliveryman | delivery@foodreels.com | delivery123 |
