const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  }),
);
app.use(express.json());

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

const nextId = () => (inventory.length ? Math.max(...inventory.map((item) => item.id)) + 1 : 1);

const toNumber = (value) => Number(value);

const buildItemResponse = (item) => {
  const rawPrice = toNumber(item.rawPrice);
  const sellingPrice = toNumber(item.sellingPrice);
  const profit = sellingPrice - rawPrice;

  return {
    ...item,
    rawPrice,
    sellingPrice,
    minStockAlert: toNumber(item.minStockAlert),
    profit,
    price: sellingPrice,
  };
};

const validateAndNormalizeItem = ({ body, currentItem, isCreate }) => {
  const name = body.name !== undefined ? body.name.toString().trim() : currentItem?.name;
  const brand = body.brand !== undefined ? body.brand.toString().trim() : currentItem?.brand;
  const category = body.category !== undefined ? body.category.toString().trim() : currentItem?.category;

  const stockSource = body.stock !== undefined ? body.stock : currentItem?.stock;
  const rawPriceSource = body.rawPrice !== undefined ? body.rawPrice : currentItem?.rawPrice;
  const sellingPriceSource =
    body.sellingPrice !== undefined
      ? body.sellingPrice
      : body.price !== undefined
        ? body.price
        : currentItem?.sellingPrice;
  const minStockAlertSource =
    body.minStockAlert !== undefined ? body.minStockAlert : currentItem?.minStockAlert ?? 10;

  if (!name || !brand || !category) {
    return { error: 'Name, brand, and category are required.' };
  }

  const stock = toNumber(stockSource);
  const rawPrice = toNumber(rawPriceSource);
  const sellingPrice = toNumber(sellingPriceSource);
  const minStockAlert = toNumber(minStockAlertSource);

  if (!Number.isFinite(stock) || stock < 0) {
    return { error: 'Stock must be a valid non-negative number.' };
  }

  if (!Number.isFinite(rawPrice) || rawPrice < 0) {
    return { error: 'Raw price must be a valid non-negative number.' };
  }

  if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
    return { error: 'Selling price must be a valid non-negative number.' };
  }

  if (sellingPrice < rawPrice) {
    return { error: 'Selling price must be greater than or equal to raw price.' };
  }

  if (!Number.isFinite(minStockAlert) || minStockAlert < 0) {
    return { error: 'Minimum stock alert must be a valid non-negative number.' };
  }

  if (isCreate && (body.rawPrice === undefined || (body.sellingPrice === undefined && body.price === undefined))) {
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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Joshoeixi Vape API' });
});

app.get('/api/items', (req, res) => {
  const query = (req.query.q || '').toString().trim().toLowerCase();

  if (!query) {
    return res.json(inventory.map(buildItemResponse));
  }

  const filtered = inventory.filter((item) => {
    return [item.name, item.brand, item.category].some((field) =>
      field.toLowerCase().includes(query),
    );
  });

  return res.json(filtered.map(buildItemResponse));
});

app.post('/api/items', (req, res) => {
  const validation = validateAndNormalizeItem({ body: req.body, isCreate: true });

  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  const newItem = {
    id: nextId(),
    ...validation.item,
  };

  inventory.push(newItem);
  return res.status(201).json(buildItemResponse(newItem));
});

app.put('/api/items/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = inventory.findIndex((item) => item.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Item not found.' });
  }

  const current = inventory[index];
  const validation = validateAndNormalizeItem({
    body: req.body,
    currentItem: current,
    isCreate: false,
  });

  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  inventory[index] = {
    ...current,
    ...validation.item,
  };

  return res.json(buildItemResponse(inventory[index]));
});

app.delete('/api/items/:id', (req, res) => {
  const id = Number(req.params.id);
  const previousLength = inventory.length;
  inventory = inventory.filter((item) => item.id !== id);

  if (inventory.length === previousLength) {
    return res.status(404).json({ error: 'Item not found.' });
  }

  return res.status(204).send();
});

app.listen(port, () => {
  console.log(`Joshoeixi Vape API running on http://localhost:${port}`);
});
