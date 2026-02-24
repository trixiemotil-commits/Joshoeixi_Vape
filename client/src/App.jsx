import { useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'
import './App.css'

const API_BASE_URL = 'http://localhost:5000/api'

const initialFormState = {
  name: '',
  brand: '',
  category: '',
  stock: '',
  rawPrice: '',
  sellingPrice: '',
  minStockAlert: '',
}

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
})

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
const categoryOptions = ['Pods', 'Battery', 'E-Liquid', 'Disposable', 'Coils', 'Accessories', 'Other']

const chartPalette = ['#561C24', '#6D2932', '#8B3A44', '#a05060', '#C7B7A3', '#3a1a20']

function buildChartGradient(segments) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)

  if (total === 0) {
    return 'conic-gradient(#dceaf2 0deg, #dceaf2 360deg)'
  }

  let current = 0
  const ranges = segments.map((segment) => {
    const degree = (segment.value / total) * 360
    const start = current
    current += degree
    return `${segment.color} ${start}deg ${current}deg`
  })

  return `conic-gradient(${ranges.join(', ')})`
}

function buildLinePath(values, width, height, padding) {
  const safeMax = Math.max(...values, 1)
  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2

  return values
    .map((value, index) => {
      const x = padding + (index / (values.length - 1 || 1)) * usableWidth
      const y = padding + ((safeMax - value) / safeMax) * usableHeight
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
}

function SectionHeader({ title, subtitle, children }) {
  return (
    <header className="section-header">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children}
    </header>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function App() {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(initialFormState)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState('dashboard')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false)
  const [stockForm, setStockForm] = useState({ itemId: '', quantity: '' })
  const [saleForm, setSaleForm] = useState({ itemId: '', quantity: '' })
  const [salesLog, setSalesLog] = useState([])
  const [variantEntries, setVariantEntries] = useState([{ name: '', stock: '' }])
  const toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 1800,
    timerProgressBar: true,
    customClass: {
      popup: 'app-toast',
    },
  })

  const rawPriceOf = (item) => Number(item.rawPrice ?? 0)
  const sellingPriceOf = (item) => Number(item.sellingPrice ?? item.price ?? 0)
  const profitPerUnitOf = (item) => Number(item.profit ?? sellingPriceOf(item) - rawPriceOf(item))
  const minStockAlertOf = (item) => Number(item.minStockAlert ?? 10)

  const totalStock = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.stock), 0),
    [items],
  )
  const inventoryValue = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.stock) * sellingPriceOf(item), 0),
    [items],
  )
  const capitalInvested = useMemo(
    () => items.reduce((sum, item) => sum + rawPriceOf(item) * Number(item.stock), 0),
    [items],
  )
  const outOfStockCount = useMemo(
    () => items.filter((item) => Number(item.stock) === 0).length,
    [items],
  )
  const lowStockCount = useMemo(
    () =>
      items.filter((item) => {
        const stock = Number(item.stock)
        const minAlert = minStockAlertOf(item)
        return stock > 0 && stock <= minAlert
      }).length,
    [items],
  )
  const estimatedSales = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + sellingPriceOf(item) * Math.max(0, Math.round(Number(item.stock) * 0.28)),
        0,
      ),
    [items],
  )

  const categorySegments = useMemo(() => {
    const grouped = items.reduce((accumulator, item) => {
      const category = item.category || 'Uncategorized'
      accumulator[category] = (accumulator[category] || 0) + Number(item.stock)
      return accumulator
    }, {})

    return Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], index) => ({
        label,
        value,
        color: chartPalette[index % chartPalette.length],
      }))
  }, [items])

  const topProductsByValue = useMemo(() => {
    return [...items]
      .map((item) => ({
        ...item,
        value: Number(item.stock) * sellingPriceOf(item),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [items])

  const profitPerProduct = useMemo(() => {
    return [...items]
      .map((item) => ({
        id: item.id,
        name: item.name,
        brand: item.brand,
        profitPerUnit: profitPerUnitOf(item),
      }))
      .sort((a, b) => b.profitPerUnit - a.profitPerUnit)
      .slice(0, 8)
  }, [items])

  const totalSalesRevenue = useMemo(
    () => salesLog.reduce((sum, s) => sum + s.totalAmount, 0),
    [salesLog],
  )

  const totalUnitsSold = useMemo(
    () => salesLog.reduce((sum, s) => sum + s.quantity, 0),
    [salesLog],
  )

  const salesRevenueByProduct = useMemo(() => {
    const grouped = salesLog.reduce((acc, sale) => {
      const key = sale.name
      if (!acc[key]) acc[key] = { name: sale.name, revenue: 0, units: 0 }
      acc[key].revenue += sale.totalAmount
      acc[key].units += sale.quantity
      return acc
    }, {})
    return Object.values(grouped)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 7)
  }, [salesLog])

  const itemsByCategory = useMemo(() => {
    const grouped = items.reduce((accumulator, item) => {
      const category = item.category || 'Uncategorized'
      if (!accumulator[category]) {
        accumulator[category] = []
      }
      accumulator[category].push(item)
      return accumulator
    }, {})

    return Object.entries(grouped)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, categoryItems]) => ({
        category,
        totalStock: categoryItems.reduce((sum, item) => sum + Number(item.stock), 0),
        items: [...categoryItems].sort((a, b) => {
          const brandCompare = a.brand.localeCompare(b.brand)
          if (brandCompare !== 0) {
            return brandCompare
          }
          return a.name.localeCompare(b.name)
        }),
      }))
  }, [items])

  const stockMovements = useMemo(() => {
    return [...items]
      .map((item) => {
        const stock = Number(item.stock)
        const minStockAlert = minStockAlertOf(item)
        const status =
          stock === 0 ? 'Out of Stock' : stock <= minStockAlert ? 'Low Stock' : stock >= 40 ? 'Overstock' : 'Healthy'
        const action =
          status === 'Out of Stock'
            ? 'Urgent restock'
            : status === 'Low Stock'
              ? 'Prepare reorder'
              : status === 'Overstock'
                ? 'Run promo bundle'
                : 'Maintain level'

        return {
          id: item.id,
          name: item.name,
          brand: item.brand,
          category: item.category,
          stock,
          minStockAlert,
          status,
          action,
          dateAdded: item.dateAdded || null,
        }
      })
      .sort((a, b) => a.stock - b.stock)
  }, [items])

  const salesByMonth = useMemo(
    () =>
      monthLabels.map((month, index) => {
        const monthValue = Math.round((estimatedSales / 6) * (0.72 + index * 0.1))
        return { month, value: monthValue }
      }),
    [estimatedSales],
  )

  const expenseByMonth = useMemo(
    () =>
      salesByMonth.map((entry, index) => {
        const ratio = 0.56 + (index % 2 === 0 ? 0.05 : 0.02)
        return Math.round(entry.value * ratio)
      }),
    [salesByMonth],
  )

  const profitByMonth = useMemo(
    () => salesByMonth.map((entry, index) => Math.max(0, entry.value - expenseByMonth[index])),
    [salesByMonth, expenseByMonth],
  )

  const totalExpense = useMemo(
    () => expenseByMonth.reduce((sum, value) => sum + value, 0),
    [expenseByMonth],
  )

  const totalProfit = useMemo(
    () => profitByMonth.reduce((sum, value) => sum + value, 0),
    [profitByMonth],
  )

  const profitMargin = useMemo(() => {
    if (!estimatedSales) {
      return 0
    }

    return Math.round((totalProfit / estimatedSales) * 100)
  }, [estimatedSales, totalProfit])

  const salesGrowth = useMemo(() => {
    const first = salesByMonth[0]?.value || 0
    const last = salesByMonth[salesByMonth.length - 1]?.value || 0

    if (!first) {
      return 0
    }

    return Math.round(((last - first) / first) * 100)
  }, [salesByMonth])

  const salesByCategory = useMemo(() => {
    const grouped = items.reduce((accumulator, item) => {
      const category = item.category || 'Uncategorized'
      const projected = sellingPriceOf(item) * Math.max(1, Math.round(Number(item.stock) * 0.3))
      accumulator[category] = (accumulator[category] || 0) + projected
      return accumulator
    }, {})

    return Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }))
  }, [items])

  const loadItems = async (query = '') => {
    try {
      setLoading(true)
      setError('')
      const url = query
        ? `${API_BASE_URL}/items?q=${encodeURIComponent(query)}`
        : `${API_BASE_URL}/items`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to fetch inventory data.')
      }

      const data = await response.json()
      setItems(data)
    } catch (fetchError) {
      setError(fetchError.message || 'Could not load inventory.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [])

  const onSearchSubmit = async (event) => {
    event.preventDefault()
    await loadItems(search)
  }

  const onInputChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const onVariantEntryChange = (index, field, value) => {
    setVariantEntries((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry,
      ),
    )
  }

  const onAddVariantEntry = () => {
    setVariantEntries((current) => [...current, { name: '', stock: '' }])
  }

  const onRemoveVariantEntry = (index) => {
    setVariantEntries((current) => {
      if (current.length <= 1) {
        return current
      }

      return current.filter((_, entryIndex) => entryIndex !== index)
    })
  }

  const resetForm = () => {
    setForm(initialFormState)
    setEditingId(null)
    setVariantEntries([{ name: '', stock: '' }])
  }

  const openAddModal = () => {
    resetForm()
    setForm({
      ...initialFormState,
      minStockAlert: '10',
    })
    setError('')
    setIsAddModalOpen(true)
  }

  const closeAddModal = () => {
    setIsAddModalOpen(false)
  }

  const closeEditModal = () => {
    setIsEditModalOpen(false)
    resetForm()
  }

  const openStockModal = () => {
    if (!items.length) {
      toast.fire({ icon: 'info', title: 'No products yet', text: 'Add products first before adding stock.' })
      return
    }

    setStockForm({ itemId: String(items[0].id), quantity: '' })
    setIsStockModalOpen(true)
  }

  const closeStockModal = () => {
    setIsStockModalOpen(false)
    setStockForm({ itemId: '', quantity: '' })
  }

  const openSaleModal = () => {
    if (!items.length) {
      toast.fire({ icon: 'info', title: 'No products yet', text: 'Add products first before recording a sale.' })
      return
    }

    setSaleForm({ itemId: String(items[0].id), quantity: '' })
    setIsSaleModalOpen(true)
  }

  const closeSaleModal = () => {
    setIsSaleModalOpen(false)
    setSaleForm({ itemId: '', quantity: '' })
  }

  const onFormSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const isEditing = editingId !== null

    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim(),
      category: form.category.trim(),
      stock: Number(form.stock),
      rawPrice: Number(form.rawPrice),
      sellingPrice: Number(form.sellingPrice),
      minStockAlert: Number(form.minStockAlert),
    }

    const normalizedCategory = payload.category.toLowerCase()
    const isPodsCategory = normalizedCategory === 'pods'
    const isBatteryCategory = normalizedCategory === 'battery' || normalizedCategory === 'batteries'
    const allowMultipleNames = isPodsCategory || isBatteryCategory
    const itemFieldLabel = isBatteryCategory ? 'color' : 'flavor'
    const itemList = isEditing ? [form.name.trim()] : [form.name.trim()]
    const multiEntries = allowMultipleNames
      ? variantEntries
          .map((entry) => ({
            name: entry.name.trim(),
            stock: Number(entry.stock),
          }))
          .filter((entry) => entry.name)
      : []

    if (!payload.brand || !payload.category) {
      setError(`Please provide brand, ${itemFieldLabel}, and category.`)
      return
    }

    if (!isEditing && allowMultipleNames && !multiEntries.length) {
      setError(`Please provide at least one ${itemFieldLabel} with stock.`)
      return
    }

    if (!isEditing && !allowMultipleNames && !itemList[0]) {
      setError(`Please provide ${itemFieldLabel}.`)
      return
    }

    if ((!allowMultipleNames || isEditing) && (!Number.isFinite(payload.stock) || payload.stock < 0)) {
      setError('Stock must be a valid non-negative number.')
      return
    }

    if (!isEditing && allowMultipleNames) {
      const hasInvalidStock = multiEntries.some((entry) => !Number.isFinite(entry.stock) || entry.stock < 0)
      if (hasInvalidStock) {
        setError('Each flavor/color stock must be a valid non-negative number.')
        return
      }
    }

    if (!Number.isFinite(payload.rawPrice) || payload.rawPrice < 0) {
      setError('Raw price must be a valid non-negative amount in PHP.')
      return
    }

    if (!Number.isFinite(payload.sellingPrice) || payload.sellingPrice < 0) {
      setError('Selling price must be a valid non-negative amount in PHP.')
      return
    }

    if (payload.sellingPrice < payload.rawPrice) {
      setError('Selling price must be greater than or equal to raw price.')
      return
    }

    if (!Number.isFinite(payload.minStockAlert) || payload.minStockAlert < 0) {
      setError('Minimum stock alert must be a valid non-negative number.')
      return
    }

    try {
      let createdCount = 0

      if (isEditing) {
        const response = await fetch(`${API_BASE_URL}/items/${editingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const result = await response.json()
          throw new Error(result.error || 'Failed to save item.')
        }
      } else {
        const entriesToCreate = allowMultipleNames
          ? multiEntries
          : [{ name: itemList[0], stock: payload.stock }]

        for (const entry of entriesToCreate) {
          const response = await fetch(`${API_BASE_URL}/items`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...payload,
              name: entry.name,
              stock: entry.stock,
            }),
          })

          if (!response.ok) {
            const result = await response.json()
            throw new Error(result.error || 'Failed to save item.')
          }

          createdCount += 1
        }

        if (createdCount === 0) {
          throw new Error('No flavors were added.')
        }
      }

      if (isEditing) {
        closeEditModal()
      } else {
        closeAddModal()
      }

      resetForm()
      await loadItems(search)
      await toast.fire({
        icon: 'success',
        title: isEditing
          ? 'Item updated'
          : createdCount > 1
            ? `${createdCount} ${isBatteryCategory ? 'colors' : 'flavors'} added`
            : isBatteryCategory
              ? 'Color added'
              : 'Flavor added',
      })
    } catch (submitError) {
      setError(submitError.message || 'Could not save inventory item.')
      toast.fire({ icon: 'error', title: 'Save failed', text: submitError.message || 'Could not save inventory item.' })
    }
  }

  const onEdit = (item) => {
    setEditingId(item.id)
    setForm({
      name: item.name,
      brand: item.brand,
      category: item.category,
      stock: String(item.stock),
      rawPrice: String(rawPriceOf(item)),
      sellingPrice: String(sellingPriceOf(item)),
      minStockAlert: String(minStockAlertOf(item)),
    })
    setError('')
    setIsEditModalOpen(true)
  }

  const onDelete = async (id, name) => {
    try {
      const confirm = await Swal.fire({
        title: 'Are you sure?',
        text: `Delete ${name}? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it',
        cancelButtonText: 'Cancel',
      })

      if (!confirm.isConfirmed) {
        return
      }

      setError('')
      const response = await fetch(`${API_BASE_URL}/items/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to delete item.')
      }

      if (editingId === id) {
        resetForm()
      }

      await loadItems(search)
      await toast.fire({
        icon: 'success',
        title: 'Deleted',
        text: `${name} was removed from inventory.`,
      })
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete inventory item.')
      toast.fire({ icon: 'error', title: 'Delete failed', text: deleteError.message || 'Could not delete inventory item.' })
    }
  }

  const onStockFormChange = (event) => {
    const { name, value } = event.target
    setStockForm((current) => ({ ...current, [name]: value }))
  }

  const onSaleFormChange = (event) => {
    const { name, value } = event.target
    setSaleForm((current) => ({ ...current, [name]: value }))
  }

  const onAddStockSubmit = async (event) => {
    event.preventDefault()

    const selectedItem = items.find((item) => String(item.id) === stockForm.itemId)
    const quantity = Number(stockForm.quantity)

    if (!selectedItem) {
      toast.fire({ icon: 'error', title: 'Invalid item', text: 'Please select a valid product.' })
      return
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.fire({ icon: 'error', title: 'Invalid quantity', text: 'Stock quantity must be greater than 0.' })
      return
    }

    const payload = {
      name: selectedItem.name,
      brand: selectedItem.brand,
      category: selectedItem.category,
      stock: Number(selectedItem.stock) + quantity,
      rawPrice: rawPriceOf(selectedItem),
      sellingPrice: sellingPriceOf(selectedItem),
      minStockAlert: minStockAlertOf(selectedItem),
    }

    try {
      const response = await fetch(`${API_BASE_URL}/items/${selectedItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to add stock.')
      }

      closeStockModal()
      await loadItems(search)
      await toast.fire({
        icon: 'success',
        title: 'Stock updated',
        text: `Added ${quantity} stock to ${selectedItem.name}.`,
      })
    } catch (stockError) {
      toast.fire({ icon: 'error', title: 'Update failed', text: stockError.message || 'Could not add stock.' })
    }
  }

  const onAddSaleSubmit = async (event) => {
    event.preventDefault()

    const selectedItem = items.find((item) => String(item.id) === saleForm.itemId)
    const quantity = Number(saleForm.quantity)

    if (!selectedItem) {
      toast.fire({ icon: 'error', title: 'Invalid item', text: 'Please select a valid product.' })
      return
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.fire({ icon: 'error', title: 'Invalid quantity', text: 'Sale quantity must be greater than 0.' })
      return
    }

    const currentStock = Number(selectedItem.stock)
    if (quantity > currentStock) {
      toast.fire({
        icon: 'warning',
        title: 'Not enough stock',
        text: `${selectedItem.name} only has ${currentStock} stocks available.`,
      })
      return
    }

    const payload = {
      name: selectedItem.name,
      brand: selectedItem.brand,
      category: selectedItem.category,
      stock: currentStock - quantity,
      rawPrice: rawPriceOf(selectedItem),
      sellingPrice: sellingPriceOf(selectedItem),
      minStockAlert: minStockAlertOf(selectedItem),
    }

    try {
      const response = await fetch(`${API_BASE_URL}/items/${selectedItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to record sale.')
      }

      const saleRecord = {
        id: Date.now(),
        date: new Date().toISOString(),
        itemId: selectedItem.id,
        name: selectedItem.name,
        brand: selectedItem.brand,
        category: selectedItem.category,
        quantity,
        sellingPrice: sellingPriceOf(selectedItem),
        totalAmount: sellingPriceOf(selectedItem) * quantity,
      }
      setSalesLog((prev) => [saleRecord, ...prev])
      closeSaleModal()
      await loadItems(search)
      await toast.fire({
        icon: 'success',
        title: 'Sale recorded',
        text: `Sold ${quantity} units of ${selectedItem.name}.`,
      })
    } catch (saleError) {
      toast.fire({ icon: 'error', title: 'Sale failed', text: saleError.message || 'Could not record sale.' })
    }
  }

  const maxMonthlySales = Math.max(...salesByMonth.map((entry) => entry.value), 1)
  const maxCategorySales = Math.max(...salesByCategory.map((entry) => entry.value), 1)

  const trendSvgWidth = 640
  const trendSvgHeight = 220
  const trendPadding = 22
  const trendMax = Math.max(...salesByMonth.map((entry) => entry.value), ...expenseByMonth, ...profitByMonth, 1)
  const scaledProfit = profitByMonth.map((value) => Math.max(1, Math.round((value / trendMax) * 1000)))
  const scaledExpense = expenseByMonth.map((value) => Math.max(1, Math.round((value / trendMax) * 1000)))
  const profitPath = buildLinePath(scaledProfit, trendSvgWidth, trendSvgHeight, trendPadding)
  const expensePath = buildLinePath(scaledExpense, trendSvgWidth, trendSvgHeight, trendPadding)

  const sectionTabs = [
    { key: 'dashboard', label: 'Dashboard', icon: '🏠︎' },
    { key: 'products', label: 'Products', icon: '⊞' },
    { key: 'sales', label: 'Sales', icon: '₱' },
  ]

  const activeSectionLabel = sectionTabs.find((tab) => tab.key === activeSection)?.label || 'Dashboard'
  const normalizedFormCategory = form.category.trim().toLowerCase()
  const isFormPods = normalizedFormCategory === 'pods'
  const isFormBattery = normalizedFormCategory === 'battery' || normalizedFormCategory === 'batteries'
  const supportsMultipleNames = isFormPods || isFormBattery
  const itemNameLabel = isFormBattery ? 'Color' : 'Flavor'
  const itemNamePlaceholder = supportsMultipleNames ? `${itemNameLabel} (one per line)` : itemNameLabel

  const onToggleSidebar = () => {
    setIsSidebarOpen((current) => !current)
  }

  const onSectionSelect = (tabKey) => {
    setActiveSection(tabKey)
    if (window.innerWidth <= 980) {
      setIsSidebarOpen(false)
    }
  }

  return (
    <div className={`layout ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="brand-block">
          <div className="profile-avatar">JV</div>
          <div className="profile-info">
            <h1>Joshoeixi Vape</h1>
            <p>Official Vape Shop</p>
          </div>
        </div>
        <nav className="nav-list">
          {sectionTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`nav-btn ${activeSection === tab.key ? 'active' : ''}`}
              onClick={() => onSectionSelect(tab.key)}
            >
              <span className="nav-icon" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="nav-label">{tab.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {isSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onToggleSidebar}
          aria-hidden="true"
        />
      )}

      <main className="content">
        <header className="top-welcome">
          <div className="welcome-left">
            <button
              type="button"
              className="menu-toggle"
              onClick={onToggleSidebar}
              aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              ☰
            </button>
            <h2>Welcome Joshoeixi!</h2>
          </div>
          <form className="search-form top-search" onSubmit={onSearchSubmit}>
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="submit">Search</button>
          </form>
        </header>

        {activeSection === 'dashboard' && (
          <>
            <SectionHeader title={activeSectionLabel} subtitle="Inventory analytics overview" />
            <section className="summary-grid">
              <article className="summary-card card-blue">
                <h3>Total Products</h3>
                <p>{items.length}</p>
              </article>
              <article className="summary-card card-teal">
                <h3>Total Stock</h3>
                <p>{totalStock}</p>
              </article>
              <article className="summary-card card-purple">
                <h3>Inventory Value</h3>
                <p>{peso.format(inventoryValue)}</p>
              </article>
              <article className="summary-card card-green">
                <h3>Capital Invested</h3>
                <p>{peso.format(capitalInvested)}</p>
              </article>
              <article className="summary-card card-amber">
                <h3>Low Stock</h3>
                <p>{lowStockCount}</p>
              </article>
              <article className="summary-card card-red">
                <h3>Out of Stock</h3>
                <p>{outOfStockCount}</p>
              </article>
            </section>

            <section className="dashboard-grid">
              <article className="panel chart-panel">
                <h3>Stock by Category</h3>
                <div className="donut-wrap">
                  <div className="donut" style={{ background: buildChartGradient(categorySegments) }}>
                    <span>{totalStock}</span>
                  </div>
                  <ul className="legend-list">
                    {categorySegments.map((segment) => (
                      <li key={segment.label}>
                        <span style={{ background: segment.color }} />
                        <p>{segment.label}</p>
                        <strong>{segment.value}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>

              <article className="panel">
                <h3>Sales Revenue</h3>
                <p className="panel-sub">Based on recorded sales this session</p>
                <div className="revenue-stats">
                  <div className="revenue-stat">
                    <span>Total Revenue</span>
                    <strong>{peso.format(totalSalesRevenue)}</strong>
                  </div>
                  <div className="revenue-stat">
                    <span>Units Sold</span>
                    <strong>{totalUnitsSold}</strong>
                  </div>
                  <div className="revenue-stat">
                    <span>Transactions</span>
                    <strong>{salesLog.length}</strong>
                  </div>
                </div>
                {salesRevenueByProduct.length === 0 ? (
                  <p className="empty-hint">No sales recorded yet. Record a sale to see revenue data.</p>
                ) : (
                  <ul className="bars-list">
                    {salesRevenueByProduct.map((entry) => {
                      const width = totalSalesRevenue > 0 ? (entry.revenue / totalSalesRevenue) * 100 : 0
                      return (
                        <li key={entry.name}>
                          <p>{entry.name}</p>
                          <div className="bar-track">
                            <span style={{ width: `${Math.max(6, width)}%` }} />
                          </div>
                          <strong>{peso.format(entry.revenue)}</strong>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </article>

              <article className="panel">
                <h3>Profit per Product</h3>
                <p className="panel-sub">Profit per unit sold (selling price − raw cost)</p>
                {profitPerProduct.length === 0 ? (
                  <p className="empty-hint">No products yet.</p>
                ) : (
                  <ul className="bars-list">
                    {profitPerProduct.map((item) => {
                      const max = profitPerProduct[0]?.profitPerUnit || 1
                      const width = (item.profitPerUnit / max) * 100
                      return (
                        <li key={item.id}>
                          <p>{item.name}</p>
                          <div className="bar-track">
                            <span style={{ width: `${Math.max(6, width)}%` }} />
                          </div>
                          <strong>{peso.format(item.profitPerUnit)}</strong>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </article>
            </section>
          </>
        )}

        {activeSection === 'products' && (
          <>

            <section className="panel">
              <div className="products-actions">
                <h2>Products</h2>
                <button type="button" onClick={openAddModal}>Add New Item</button>
              </div>

              {error ? <p className="error-message">{error}</p> : null}
              {loading ? <p className="status-message">Loading inventory...</p> : null}

              {!loading && items.length === 0 && <p className="empty-state">No inventory items found.</p>}

              {!loading && items.length > 0 && (
                <div className="category-groups">
                  {itemsByCategory.map((group) => (
                    <article key={group.category} className="category-group">
                      <div className="category-group-head">
                        <h4>{group.category}</h4>
                        <div className="category-meta">
                          <span>{group.items.length} items</span>
                          <span className="total-stock-badge">
                            <span className="total-stock-circle">{group.totalStock}</span>
                            Total Stocks
                          </span>
                        </div>
                      </div>

                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Brand</th>
                              <th>Flavor / Color</th>
                              <th>Stock</th>
                              <th>Raw Price</th>
                              <th>Selling Price</th>
                              <th>Profit</th>
                              <th>Min Alert</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map((item) => {
                              const stock = Number(item.stock)
                              const minAlert = minStockAlertOf(item)
                              const stockState = stock === 0 ? 'stock-out' : stock <= minAlert ? 'stock-low' : 'stock-ok'

                              return (
                                <tr key={item.id} className={`item-row row-${stockState}`}>
                                  <td data-label="Brand">{item.brand}</td>
                                  <td data-label="Flavor / Color">{item.name}</td>
                                  <td data-label="Stock">
                                    <span className={`value-badge stock-cell ${stockState}`}>{item.stock}</span>
                                  </td>
                                  <td data-label="Raw Price">
                                    <span className="value-badge raw-price-cell">{peso.format(rawPriceOf(item))}</span>
                                  </td>
                                  <td data-label="Selling Price">
                                    <span className="value-badge selling-price-cell">{peso.format(sellingPriceOf(item))}</span>
                                  </td>
                                  <td data-label="Profit">
                                    <span className="value-badge profit-cell">{peso.format(profitPerUnitOf(item))}</span>
                                  </td>
                                  <td data-label="Min Alert">{minAlert}</td>
                                  <td data-label="Actions" className="row-actions">
                                    <button type="button" className="icon-btn icon-edit" onClick={() => onEdit(item)} aria-label="Edit item" title="Edit">
                                      ✎
                                    </button>
                                    <button type="button" className="icon-btn icon-delete" onClick={() => onDelete(item.id, item.name)} aria-label="Delete item" title="Delete">
                                      🗑
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {activeSection === 'sales' && (
          <>
            <SectionHeader title={activeSectionLabel} subtitle="Recent sales transactions">
              <button type="button" onClick={openSaleModal}>Add Sale</button>
            </SectionHeader>

            <section className="summary-grid sales-summary-grid">
              <article className="summary-card">
                <h3>Total Transactions</h3>
                <p>{salesLog.length}</p>
              </article>
              <article className="summary-card">
                <h3>Total Revenue</h3>
                <p>{peso.format(salesLog.reduce((sum, s) => sum + s.totalAmount, 0))}</p>
              </article>
            </section>

            <section className="panel">
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Brand</th>
                      <th>Flavor / Color</th>
                      <th>Qty</th>
                      <th>Selling Price</th>
                      <th>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesLog.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="table-empty-cell">No sales recorded yet.</td>
                      </tr>
                    ) : (
                      salesLog.map((sale) => (
                        <tr key={sale.id}>
                          <td data-label="Date">
                            {new Date(sale.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                            <span className="time-sub">
                              {new Date(sale.date).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>
                          <td data-label="Category">{sale.category}</td>
                          <td data-label="Brand">{sale.brand}</td>
                          <td data-label="Flavor / Color">{sale.name}</td>
                          <td data-label="Qty">
                            <span className="value-badge raw-price-cell">{sale.quantity}</span>
                          </td>
                          <td data-label="Selling Price">
                            <span className="value-badge selling-price-cell">{peso.format(sale.sellingPrice)}</span>
                          </td>
                          <td data-label="Total Amount">
                            <span className="value-badge profit-cell">{peso.format(sale.totalAmount)}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {isAddModalOpen && (
          <Modal title="Add New Item" onClose={closeAddModal}>
            <form className="item-form" onSubmit={onFormSubmit}>
              <input name="brand" placeholder="Brand" value={form.brand} onChange={onInputChange} />
              <select name="category" value={form.category} onChange={onInputChange}>
                <option value="">Select Category</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {supportsMultipleNames ? (
                <div className="variant-entry-grid">
                  <div className="variant-entry-head">
                    <h4>{itemNameLabel} Entries</h4>
                    <button type="button" className="btn-secondary" onClick={onAddVariantEntry}>
                      Add Row
                    </button>
                  </div>
                  {variantEntries.map((entry, index) => (
                    <div className="variant-entry-row" key={`variant-${index}`}>
                      <input
                        placeholder={`${itemNameLabel} ${index + 1}`}
                        value={entry.name}
                        onChange={(event) => onVariantEntryChange(index, 'name', event.target.value)}
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="Stock"
                        value={entry.stock}
                        onChange={(event) => onVariantEntryChange(index, 'stock', event.target.value)}
                      />
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => onRemoveVariantEntry(index)}
                        disabled={variantEntries.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <input
                  name="name"
                  placeholder={itemNamePlaceholder}
                  value={form.name}
                  onChange={onInputChange}
                />
              )}
              {!supportsMultipleNames && (
                <input
                  name="stock"
                  type="number"
                  min="0"
                  placeholder="Stock"
                  value={form.stock}
                  onChange={onInputChange}
                />
              )}
              <input
                name="rawPrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="Raw Price (PHP)"
                value={form.rawPrice}
                onChange={onInputChange}
              />
              <input
                name="sellingPrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="Selling Price (PHP)"
                value={form.sellingPrice}
                onChange={onInputChange}
              />
              <input
                name="minStockAlert"
                type="number"
                min="0"
                placeholder="Min Stock Alert"
                value={form.minStockAlert}
                onChange={onInputChange}
              />
              <input
                value={`Profit per unit: ${peso.format(
                  Math.max(0, Number(form.sellingPrice || 0) - Number(form.rawPrice || 0)),
                )}`}
                readOnly
              />
              <div className="form-actions">
                <button type="submit">Add Item</button>
                <button type="button" className="btn-secondary" onClick={closeAddModal}>
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        )}

        {isEditModalOpen && (
          <Modal title="Update Item" onClose={closeEditModal}>
            <form className="item-form" onSubmit={onFormSubmit}>
              <input name="brand" placeholder="Brand" value={form.brand} onChange={onInputChange} />
              <select name="category" value={form.category} onChange={onInputChange}>
                <option value="">Select Category</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <input name="name" placeholder={itemNameLabel} value={form.name} onChange={onInputChange} />
              <input name="stock" type="number" min="0" placeholder="Stock" value={form.stock} onChange={onInputChange} />
              <input
                name="rawPrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="Raw Price (PHP)"
                value={form.rawPrice}
                onChange={onInputChange}
              />
              <input
                name="sellingPrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="Selling Price (PHP)"
                value={form.sellingPrice}
                onChange={onInputChange}
              />
              <input
                name="minStockAlert"
                type="number"
                min="0"
                placeholder="Min Stock Alert"
                value={form.minStockAlert}
                onChange={onInputChange}
              />
              <input
                value={`Profit per unit: ${peso.format(
                  Math.max(0, Number(form.sellingPrice || 0) - Number(form.rawPrice || 0)),
                )}`}
                readOnly
              />
              <div className="form-actions">
                <button type="submit">Update Item</button>
                <button type="button" className="btn-secondary" onClick={closeEditModal}>
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        )}

        {isStockModalOpen && (
          <Modal title="Add Stocks" onClose={closeStockModal}>
            <form className="item-form" onSubmit={onAddStockSubmit}>
              <select name="itemId" value={stockForm.itemId} onChange={onStockFormChange}>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.stock} in stock)
                  </option>
                ))}
              </select>
              <input
                name="quantity"
                type="number"
                min="1"
                placeholder="Quantity to add"
                value={stockForm.quantity}
                onChange={onStockFormChange}
              />
              <div className="form-actions">
                <button type="submit">Save Stock</button>
                <button type="button" className="btn-secondary" onClick={closeStockModal}>
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        )}

        {isSaleModalOpen && (() => {
          const saleItem = items.find((item) => String(item.id) === saleForm.itemId)
          const saleQty = Number(saleForm.quantity) || 0
          const saleUnitPrice = saleItem ? sellingPriceOf(saleItem) : 0
          const saleTotalAmount = saleUnitPrice * saleQty
          return (
            <Modal title="Add Sale" onClose={closeSaleModal}>
              <form className="item-form" onSubmit={onAddSaleSubmit}>
                <select name="itemId" value={saleForm.itemId} onChange={onSaleFormChange}>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      [{item.category}] {item.brand} — {item.name} ({item.stock} in stock)
                    </option>
                  ))}
                </select>
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  placeholder="Quantity sold"
                  value={saleForm.quantity}
                  onChange={onSaleFormChange}
                />
                <input
                  readOnly
                  value={`Selling Price: ${peso.format(saleUnitPrice)}`}
                  className="computed-field"
                />
                <input
                  readOnly
                  value={`Total Amount: ${peso.format(saleTotalAmount)}`}
                  className="computed-field computed-field-total"
                />
                <div className="form-actions">
                  <button type="submit">Save Sale</button>
                  <button type="button" className="btn-secondary" onClick={closeSaleModal}>
                    Cancel
                  </button>
                </div>
              </form>
            </Modal>
          )
        })()}
      </main>
    </div>
  )
}

export default App
