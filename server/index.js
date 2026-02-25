const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

/**
 * =========================
 * CORS CONFIGURATION
 * =========================
 * Allows:
 * - Local development (Vite)
 * - Deployed Vercel frontend
 */
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://joshoeixi-vape-official.vercel.app',
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (Postman, server-to-server)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('CORS not allowed from this origin'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type'],
  })
);

app.use(express.json());

/**
 * =========================
 * IN-MEMORY INVENTORY
 * =========================
 */
let inventory = [
  {
    id: 1,
    name: 'Strawberry Milk 60ml',
    brand: 'Cloudy Co.',
    category: 'E-Liquid',
    stock: 24,
    rawPrice: 280,
    sellingPrice: 450,
    minStockAlert: 10,
  },
  {
    id: 2,
    name: 'Mint Freeze Disposable',
    brand: 'VapeX',
    category: 'Disposable',
    stock: 15,
    rawPrice: 230,
    sellingPrice: 380,
    minStockAlert: 8,
  },
  {
    id: 3,
    name: 'Mesh Coil 0.8Ω',
    brand: 'SmokeLab',
    category: 'Coils',
    stock: 40,
    rawPrice: 120,
    sellingPrice: 220,
    minStockAlert: 15,
  },
  {
    id: 4,
    name: 'Pod Cartridge 2ml',
    brand: 'VapeX',
    category: 'Pods',
    stock: 28,
    rawPrice: 95,
    sellingPrice: 180,
    minStockAlert: 12,
  },
  {
    id: 5,
    name: 'Battery 18650 3000mAh',
    brand: 'PowerLeaf',
    category: 'Accessories',
    stock: 12,
    rawPrice: 340,
    sellingPrice: 520,
    minStockAlert: 6,
  },
];

/**
 * =========================
 * HELPERS
 * =========================
 */
const nextId = () =>
  inventory.length ? Math.max(...inventory.map((i) => i.id)) + 1 : 1;

const toNumber = (value) => Number(value);

const buildItemResponse = (item) => {
  const rawPrice = toNumber(item.rawPrice);
  const sellingPrice = toNumber(item.sellingPrice);

  return {
    ...item,
    rawPrice,
    sellingPrice,
    minStockAlert: toNumber(item.minStockAlert),
    profit: sellingPrice - rawPrice,
    price: sellingPrice,
  };
};

const validateAndNormalizeItem = ({ body, currentItem, isCreate }) => {
  const name = body.name?.toString().trim() ?? currentItem?.name;
  const brand = body.brand?.toString().trim() ?? currentItem?.brand;
  const category = body.category?.toString().trim() ?? currentItem?.category;

  if (!name || !brand || !category) {
    return { error: 'Name, brand, and category are required.' };
  }

  const stock = toNumber(body.stock ?? currentItem?.stock);
  const rawPrice = toNumber(body.rawPrice ?? currentItem?.rawPrice);
  const sellingPrice = toNumber(
    body.sellingPrice ?? body.price ?? currentItem?.sellingPrice
  );
  const minStockAlert = toNumber(
    body.minStockAlert ?? currentItem?.minStockAlert ?? 10
  );

  if (
    !Number.isFinite(stock) ||
    !Number.isFinite(rawPrice) ||
    !Number.isFinite(sellingPrice) ||
    stock < 0 ||
    rawPrice < 0 ||
    sellingPrice < rawPrice
  ) {
    return { error: 'Invalid numeric values.' };
  }

  if (isCreate && (body.rawPrice === undefined || body.sellingPrice === undefined)) {
    return { error: 'Raw price and selling price are required.' };
  }

  return {
    item: {
      ...(currentItem || {}),
      name,
      brand,
      category,
      stock,
      rawPrice,
      sellingPrice,
      minStockAlert,
    },
  };
};

/**
 * =========================
 * ROUTES
 * =========================
 */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Joshoeixi Vape API' });
});

app.get('/api/items', (req, res) => {
  const q = (req.query.q || '').toLowerCase();

  const data = q
    ? inventory.filter((item) =>
        [item.name, item.brand, item.category].some((f) =>
          f.toLowerCase().includes(q)
        )
      )
    : inventory;

  res.json(data.map(buildItemResponse));
});

app.post('/api/items', (req, res) => {
  const validation = validateAndNormalizeItem({
    body: req.body,
    isCreate: true,
  });

  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  const newItem = { id: nextId(), ...validation.item };
  inventory.push(newItem);

  res.status(201).json(buildItemResponse(newItem));
});

app.put('/api/items/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = inventory.findIndex((i) => i.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Item not found.' });
  }

  const validation = validateAndNormalizeItem({
    body: req.body,
    currentItem: inventory[index],
  });

  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  inventory[index] = { ...inventory[index], ...validation.item };
  res.json(buildItemResponse(inventory[index]));
});

app.delete('/api/items/:id', (req, res) => {
  const id = Number(req.params.id);
  const len = inventory.length;

  inventory = inventory.filter((i) => i.id !== id);

  if (inventory.length === len) {
    return res.status(404).json({ error: 'Item not found.' });
  }

  res.status(204).send();
});

/**
 * =========================
 * START SERVER
 * =========================
 */
app.listen(PORT, () => {
  console.log(`🚀 Joshoeixi Vape API running on port ${PORT}`);
});