import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function InventoryApp() {
  const [items, setItems] = useState([]);
  const [barcode, setBarcode] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const barcodeInputRef = useRef(null);
  const [lastScanned, setLastScanned] = useState(null);

  // Fetch items on mount
  useEffect(() => {
    fetchItems();
    const unsubscribe = subscribeToChanges();
    barcodeInputRef.current?.focus();
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch all inventory items
  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('name');

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to real-time changes
  const subscribeToChanges = () => {
    const subscription = supabase
      .channel('items-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
        fetchItems();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  // Handle barcode scan
  const handleBarcodeScan = async (e) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    try {
      const { data } = await supabase
        .from('items')
        .select('*')
        .eq('barcode', barcode)
        .single();

      if (!data) {
        const { error: insertError } = await supabase
          .from('items')
          .insert([{ barcode, name: `Item ${barcode}`, quantity: 1, location: 'Main' }]);

        if (insertError) throw insertError;
        setLastScanned(`Created: ${barcode}`);
      } else {
        const newQuantity = data.quantity + 1;
        const { error: updateError } = await supabase
          .from('items')
          .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
          .eq('id', data.id);

        if (updateError) throw updateError;
        setLastScanned(`+1 ${data.name}`);
      }

      setBarcode('');
      barcodeInputRef.current?.focus();
    } catch (error) {
      console.error('Error processing barcode:', error);
      setLastScanned('Error processing scan');
    }
  };

  // Add quantity to item
  const addQuantity = async (id, currentQty) => {
    try {
      const { error } = await supabase
        .from('items')
        .update({ quantity: currentQty + 1, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      fetchItems();
    } catch (error) {
      console.error('Error adding quantity:', error);
    }
  };

  // Subtract quantity from item
  const subtractQuantity = async (id, currentQty) => {
    if (currentQty <= 0) return;
    try {
      const { error } = await supabase
        .from('items')
        .update({ quantity: currentQty - 1, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      fetchItems();
    } catch (error) {
      console.error('Error subtracting quantity:', error);
    }
  };

  // Delete item
  const deleteItem = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchItems();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  // Filter items based on search
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.barcode.includes(search) ||
    (item.sku && item.sku.includes(search))
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📦 Inventory Manager</h1>
      </div>

      <div style={styles.scannerSection}>
        <form onSubmit={handleBarcodeScan} style={styles.scanForm}>
          <input
            ref={barcodeInputRef}
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Scan barcode here..."
            style={styles.barcodeInput}
            autoComplete="off"
          />
          <button type="submit" style={styles.scanButton}>
            Scan
          </button>
        </form>
        {lastScanned && <div style={styles.feedback}>{lastScanned}</div>}
      </div>

      <div style={styles.searchSection}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, barcode, or SKU..."
          style={styles.searchInput}
        />
      </div>

      <div style={styles.listContainer}>
        {loading ? (
          <div style={styles.loading}>Loading inventory...</div>
        ) : filteredItems.length === 0 ? (
          <div style={styles.empty}>
            {items.length === 0
              ? 'No items yet. Scan a barcode to add one.'
              : 'No matching items found.'}
          </div>
        ) : (
          <div style={styles.itemsGrid}>
            {filteredItems.map((item) => (
              <div
                key={item.id}
                style={{
                  ...styles.itemCard,
                  borderLeftColor:
                    item.quantity < item.min_quantity ? '#ef4444' : '#10b981',
                }}
              >
                <div style={styles.itemHeader}>
                  <div>
                    <h3 style={styles.itemName}>{item.name}</h3>
                    <p style={styles.itemBarcode}>📍 {item.barcode}</p>
                    {item.sku && <p style={styles.itemSku}>SKU: {item.sku}</p>}
                  </div>
                  <button
                    onClick={() => deleteItem(item.id)}
                    style={styles.deleteBtn}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>

                {item.quantity < item.min_quantity && (
                  <div style={styles.lowStockWarning}>
                    ⚠️ Low stock! ({item.quantity} / {item.min_quantity})
                  </div>
                )}

                <div style={styles.quantitySection}>
                  <button
                    onClick={() => subtractQuantity(item.id, item.quantity)}
                    style={styles.btnMinus}
                    disabled={item.quantity === 0}
                  >
                    −
                  </button>
                  <div style={styles.quantityDisplay}>{item.quantity}</div>
                  <button
                    onClick={() => addQuantity(item.id, item.quantity)}
                    style={styles.btnPlus}
                  >
                    +
                  </button>
                </div>

                <div style={styles.location}>📍 {item.location}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div style={styles.footer}>
          <div>
            Total Items: <strong>{items.length}</strong>
          </div>
          <div>
            Total Units:{' '}
            <strong>{items.reduce((sum, item) => sum + item.quantity, 0)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

// Styles optimized for tablet
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#f9fafb',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    backgroundColor: '#1f2937',
    color: 'white',
    padding: '20px',
    textAlign: 'center',
    borderBottom: '4px solid #3b82f6',
  },
  title: { margin: '0', fontSize: '28px', fontWeight: '600' },
  scannerSection: {
    padding: '20px',
    backgroundColor: 'white',
    borderBottom: '1px solid #e5e7eb',
  },
  scanForm: { display: 'flex', gap: '10px', marginBottom: '10px' },
  barcodeInput: {
    flex: 1,
    padding: '16px',
    fontSize: '16px',
    border: '2px solid #3b82f6',
    borderRadius: '8px',
    outline: 'none',
  },
  scanButton: {
    padding: '16px 24px',
    fontSize: '16px',
    fontWeight: '600',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    minWidth: '100px',
  },
  feedback: {
    padding: '12px',
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
  },
  searchSection: { padding: '16px 20px', backgroundColor: 'white' },
  searchInput: {
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  listContainer: { flex: 1, overflow: 'auto', padding: '20px' },
  itemsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px',
  },
  itemCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '16px',
    borderLeft: '4px solid #10b981',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
  },
  itemName: {
    margin: '0 0 6px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
  },
  itemBarcode: { margin: '4px 0', fontSize: '14px', color: '#6b7280' },
  itemSku: { margin: '4px 0 0 0', fontSize: '12px', color: '#9ca3af' },
  deleteBtn: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    border: 'none',
    borderRadius: '6px',
    width: '32px',
    height: '32px',
    fontSize: '18px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  lowStockWarning: {
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    padding: '8px',
    borderRadius: '6px',
    fontSize: '13px',
    marginBottom: '12px',
    fontWeight: '500',
  },
  quantitySection: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '12px',
    backgroundColor: '#f3f4f6',
    padding: '12px',
    borderRadius: '6px',
  },
  btnMinus: {
    width: '56px',
    height: '56px',
    fontSize: '28px',
    fontWeight: 'bold',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  btnPlus: {
    width: '56px',
    height: '56px',
    fontSize: '28px',
    fontWeight: 'bold',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  quantityDisplay: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#1f2937',
    minWidth: '80px',
    textAlign: 'center',
  },
  location: { fontSize: '13px', color: '#6b7280', textAlign: 'center' },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#6b7280',
    fontSize: '16px',
  },
  empty: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#6b7280',
    fontSize: '16px',
  },
  footer: {
    backgroundColor: 'white',
    padding: '16px 20px',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    gap: '40px',
    justifyContent: 'center',
    fontSize: '16px',
    color: '#1f2937',
  },
};
