import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { ResourceManager, type ResourceField } from '../components/ResourceManager';
import { useAuth } from '../contexts/AuthContext';
import {
  asNumber,
  deleteRow,
  getRows,
  newId,
  patchRow,
  saveRow,
  today,
  type DataRow,
} from '../services/logisticsService';
import { createStockTransaction, getDocument, toNumber } from '../services/logitrackService';
import type { Item } from '../types/logitrack';

function toOptions(rows: DataRow[]): { value: string; label: string }[] {
  return rows.map(row => ({ value: row.id, label: String(row.name ?? row.id) }));
}

function defaultExpiry(date: string): string {
  const value = new Date(date);
  value.setFullYear(value.getFullYear() + 1);
  return value.toISOString().slice(0, 10);
}

export const StockInPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<DataRow[]>([]);
  const [suppliers, setSuppliers] = useState<DataRow[]>([]);

  useEffect(() => {
    void Promise.all([getRows('products'), getRows('suppliers')]).then(([productRows, supplierRows]) => {
      setProducts(productRows);
      setSuppliers(supplierRows);
    });
  }, []);

  const recordStockChange = async (row: DataRow, delta: number, isNew: boolean) => {
    if (delta === 0 && !isNew) return;
    const item = await getDocument<Item>('products', String(row.productId));
    if (isNew && delta > 0) {
      await createStockTransaction({
        type: 'IN',
        date: row.date,
        itemId: row.productId,
        itemName: row.productName,
        categoryId: item?.categoryId || '',
        categoryName: item?.categoryName || '',
        quantity: delta,
        unit: item?.unit || row.unit || 'Pcs',
        source: row.supplierName || '',
        senderName: row.supplierName || '',
        receiverName: currentUser?.displayName || '',
        warehouseId: 'wh-1',
        storageLocation: row.storageLocation || '',
        referenceType: 'stock_in',
        referenceId: row.id,
        notes: row.notes || '',
        status: 'Confirmed',
      }, currentUser);
    } else if (item && delta !== 0) {
      await createStockTransaction({
        type: 'ADJUSTMENT',
        date: row.date,
        itemId: item.id,
        itemName: item.name,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        quantity: toNumber(item.currentStock) + delta,
        unit: item.unit,
        source: 'Penyesuaian transaksi barang masuk',
        receiverName: currentUser?.displayName || '',
        warehouseId: 'wh-1',
        storageLocation: row.storageLocation || '',
        referenceType: 'stock_in',
        referenceId: row.id,
        notes: row.notes || '',
        status: 'Confirmed',
      }, currentUser);
    }

    if (isNew) {
      await saveRow('stock_batches', {
        id: newId('batch'),
        productId: row.productId,
        productName: row.productName,
        supplierId: row.supplierId,
        supplierName: row.supplierName,
        warehouseId: 'wh-1',
        quantity: asNumber(row.quantity),
        initialQuantity: asNumber(row.quantity),
        purchasePrice: asNumber(row.purchasePrice),
        expiredDate: defaultExpiry(row.date || today()),
        stockInId: row.id,
        createdAt: new Date(),
      }, currentUser);
      await saveRow('stock_movements', {
        id: newId('mov'),
        productId: row.productId,
        productName: row.productName,
        type: 'IN',
        quantity: asNumber(row.quantity),
        referenceId: row.id,
        date: row.date,
        createdAt: new Date(),
      }, currentUser);
      return;
    }

    const batches = await getRows('stock_batches');
    const batch = batches.find(item => item.stockInId === row.id);
    if (batch) {
      await patchRow('stock_batches', batch.id, {
        quantity: Math.max(0, asNumber(batch.quantity) + delta),
        initialQuantity: Math.max(0, asNumber(batch.initialQuantity) + delta),
      }, currentUser);
    }
    const movements = await getRows('stock_movements');
    const movement = movements.find(item => item.referenceId === row.id && item.type === 'IN');
    if (movement) {
      await patchRow('stock_movements', movement.id, { quantity: asNumber(row.quantity) }, currentUser);
    }
  };

  const handleDelete = async (row: DataRow) => {
    await recordStockChange(row, -asNumber(row.quantity), false);
    const batches = await getRows('stock_batches');
    await Promise.all(batches.filter(item => item.stockInId === row.id).map(item => deleteRow('stock_batches', item.id, currentUser)));
    const movements = await getRows('stock_movements');
    await Promise.all(movements.filter(item => item.referenceId === row.id).map(item => deleteRow('stock_movements', item.id, currentUser)));
  };

  const fields: ResourceField[] = [
    { key: 'invoiceNumber', label: 'Nomor Invoice', required: true, placeholder: 'IN-2026-004' },
    { key: 'supplierId', label: 'Supplier', type: 'select', options: toOptions(suppliers), required: true },
    { key: 'productId', label: 'Bahan Makanan', type: 'select', options: toOptions(products), required: true },
    { key: 'quantity', label: 'Jumlah', type: 'number', required: true },
    { key: 'purchasePrice', label: 'Harga Satuan', type: 'number', required: true },
    { key: 'date', label: 'Tanggal', type: 'date', required: true },
    { key: 'notes', label: 'Catatan', type: 'textarea' },
  ];

  return (
    <ResourceManager
      title="Barang Masuk"
      description="Catat penerimaan barang dari supplier, perbarui batch stok, dan riwayat pergerakan stok."
      collection="stock_in"
      icon={ArrowDown}
      permissions={{ view: 'stock_in.view', create: 'stock_in.create', edit: 'stock_in.edit', delete: 'stock_in.delete' }}
      fields={fields}
      columns={['invoiceNumber', 'supplierName', 'productName', 'quantity', 'totalAmount', 'date']}
      columnLabels={{ invoiceNumber: 'Invoice', supplierName: 'Supplier', productName: 'Bahan', quantity: 'Jumlah', totalAmount: 'Total', date: 'Tanggal' }}
      initialRow={() => ({ date: today(), quantity: 0, purchasePrice: 0, createdBy: currentUser?.uid || '', createdAt: new Date() })}
      transform={row => ({
        ...row,
        supplierName: suppliers.find(item => item.id === row.supplierId)?.name || row.supplierName || '',
        productName: products.find(item => item.id === row.productId)?.name || row.productName || '',
        totalAmount: asNumber(row.quantity) * asNumber(row.purchasePrice),
        createdBy: row.createdBy || currentUser?.uid || '',
      })}
      validate={(row, rows) => {
        if (!row.invoiceNumber || !row.supplierId || !row.productId) return 'Invoice, supplier, dan bahan wajib diisi.';
        if (asNumber(row.quantity) <= 0 || asNumber(row.purchasePrice) <= 0) return 'Jumlah dan harga harus lebih dari nol.';
        if (rows.some(item => item.id !== row.id && item.invoiceNumber === row.invoiceNumber)) return 'Nomor invoice sudah digunakan.';
        return null;
      }}
      renderCell={(key, row) => {
        if (key === 'quantity') return <span className="font-semibold">{row.quantity} {products.find(item => item.id === row.productId)?.unit || ''}</span>;
        return undefined;
      }}
      onSaved={async (row, rows, isNew) => {
        const previous = rows.find(item => item.id === row.id);
        const delta = isNew ? asNumber(row.quantity) : asNumber(row.quantity) - asNumber(previous?.quantity);
        await recordStockChange(row, delta, isNew);
        setProducts(await getRows('products'));
      }}
      onDeleted={async row => {
        await handleDelete(row);
        setProducts(await getRows('products'));
      }}
    />
  );
};

export const StockOutPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<DataRow[]>([]);

  useEffect(() => {
    void getRows('products').then(setProducts);
  }, []);

  const recordOutbound = async (row: DataRow, delta: number, isNew: boolean) => {
    const item = await getDocument<Item>('products', String(row.productId));
    if (item && delta > 0) {
      await createStockTransaction({
        type: 'OUT',
        date: row.date,
        itemId: item.id,
        itemName: item.name,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        quantity: delta,
        unit: item.unit,
        source: row.destination || '',
        receiverName: row.requesterName || row.destination || '',
        senderName: currentUser?.displayName || '',
        warehouseId: item.warehouseId || 'wh-1',
        storageLocation: item.warehouseName || '',
        referenceType: 'stock_out',
        referenceId: row.id,
        notes: row.notes || '',
        status: 'Confirmed',
      }, currentUser);
    } else if (item && delta < 0) {
      await createStockTransaction({
        type: 'ADJUSTMENT',
        date: row.date,
        itemId: item.id,
        itemName: item.name,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        quantity: toNumber(item.currentStock) - delta,
        unit: item.unit,
        source: 'Penyesuaian transaksi barang keluar',
        receiverName: currentUser?.displayName || '',
        warehouseId: item.warehouseId || 'wh-1',
        storageLocation: item.warehouseName || '',
        referenceType: 'stock_out',
        referenceId: row.id,
        notes: row.notes || '',
        status: 'Confirmed',
      }, currentUser);
    }

    if (isNew) {
      await saveRow('stock_movements', {
        id: newId('mov'),
        productId: row.productId,
        productName: row.productName,
        type: 'OUT',
        quantity: asNumber(row.quantity),
        referenceId: row.id,
        date: row.date,
        createdAt: new Date(),
      }, currentUser);
      const batches = await getRows('stock_batches');
      let remaining = asNumber(row.quantity);
      const sorted = [...batches]
        .filter(batch => batch.productId === row.productId && asNumber(batch.quantity) > 0)
        .sort((a, b) => String(a.expiredDate).localeCompare(String(b.expiredDate)));
      for (const batch of sorted) {
        if (remaining <= 0) break;
        const deduction = Math.min(remaining, asNumber(batch.quantity));
        await patchRow('stock_batches', batch.id, { quantity: asNumber(batch.quantity) - deduction }, currentUser);
        remaining -= deduction;
      }
      return;
    }

    const movements = await getRows('stock_movements');
    const movement = movements.find(item => item.referenceId === row.id && item.type === 'OUT');
    if (movement) await patchRow('stock_movements', movement.id, { quantity: asNumber(row.quantity) }, currentUser);
  };

  const handleDelete = async (row: DataRow) => {
    await recordOutbound(row, -asNumber(row.quantity), false);
    const movements = await getRows('stock_movements');
    await Promise.all(movements.filter(item => item.referenceId === row.id).map(item => deleteRow('stock_movements', item.id, currentUser)));
  };

  const fields: ResourceField[] = [
    { key: 'stockOutNumber', label: 'Nomor Barang Keluar', required: true, placeholder: 'OUT-2026-003' },
    { key: 'productId', label: 'Bahan Makanan', type: 'select', options: toOptions(products), required: true },
    { key: 'quantity', label: 'Jumlah', type: 'number', required: true },
    { key: 'date', label: 'Tanggal', type: 'date', required: true },
    { key: 'destination', label: 'Tujuan', required: true, placeholder: 'Contoh: Dapur Putra' },
    { key: 'notes', label: 'Catatan', type: 'textarea' },
  ];

  return (
    <ResourceManager
      title="Barang Keluar"
      description="Catat pengeluaran stok gudang dengan validasi ketersediaan dan pembaruan batch FIFO."
      collection="stock_out"
      icon={ArrowUp}
      permissions={{ view: 'stock_out.view', create: 'stock_out.create', edit: 'stock_out.edit', delete: 'stock_out.delete' }}
      fields={fields}
      columns={['stockOutNumber', 'productName', 'quantity', 'destination', 'date']}
      columnLabels={{ stockOutNumber: 'No. Keluar', productName: 'Bahan', quantity: 'Jumlah', destination: 'Tujuan', date: 'Tanggal' }}
      initialRow={() => ({ date: today(), quantity: 0, createdBy: currentUser?.uid || '', createdAt: new Date() })}
      transform={row => ({
        ...row,
        productName: products.find(item => item.id === row.productId)?.name || row.productName || '',
        createdBy: row.createdBy || currentUser?.uid || '',
      })}
      validate={(row, rows) => {
        if (!row.stockOutNumber || !row.productId || !row.destination) return 'Nomor, bahan, dan tujuan wajib diisi.';
        if (asNumber(row.quantity) <= 0) return 'Jumlah harus lebih dari nol.';
        const previous = rows.find(item => item.id === row.id);
        const product = products.find(item => item.id === row.productId);
        const available = asNumber(product?.currentStock) + asNumber(previous?.productId === row.productId ? previous?.quantity : 0);
        if (asNumber(row.quantity) > available) return `Stok tidak mencukupi. Tersedia ${available}.`;
        if (rows.some(item => item.id !== row.id && item.stockOutNumber === row.stockOutNumber)) return 'Nomor barang keluar sudah digunakan.';
        return null;
      }}
      renderCell={(key, row) => {
        if (key === 'quantity') return <span className="font-semibold">{row.quantity} {products.find(item => item.id === row.productId)?.unit || ''}</span>;
        return undefined;
      }}
      onSaved={async (row, rows, isNew) => {
        const previous = rows.find(item => item.id === row.id);
        const delta = isNew ? asNumber(row.quantity) : asNumber(row.quantity) - asNumber(previous?.quantity);
        await recordOutbound(row, delta, isNew);
        setProducts(await getRows('products'));
      }}
      onDeleted={async row => {
        await handleDelete(row);
        setProducts(await getRows('products'));
      }}
    />
  );
};
