import { useState } from 'react'
import PageLayout from '../../components/PageLayout'

interface PrepItem { id: number; name: string; priority: 1 | 2 | 3 }
interface CartItem extends PrepItem { qty: number }

const PREP_ITEMS: PrepItem[] = [
  { id: 1, name: 'Lettuce',   priority: 1 },
  { id: 2, name: 'Tomatoes',  priority: 1 },
  { id: 3, name: 'Onions',    priority: 1 },
  { id: 4, name: 'Cheese',    priority: 2 },
  { id: 5, name: 'Pickles',   priority: 2 },
  { id: 6, name: 'Sauces',    priority: 2 },
  { id: 7, name: 'Bread',     priority: 3 },
  { id: 8, name: 'Patties',   priority: 3 },
]

const PRIORITIES: { id: 1 | 2 | 3; label: string }[] = [
  { id: 1, label: '12 PM' },
  { id: 2, label: '2 PM' },
  { id: 3, label: '4 PM' },
]

export default function Tally() {
  const [priority, setPriority] = useState<1 | 2 | 3>(1)
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)

  const totalItems = cart.reduce((n, c) => n + c.qty, 0)

  function toggle(item: PrepItem) {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) return prev.filter(c => c.id !== item.id)
      return [...prev, { ...item, qty: 1 }]
    })
  }

  function changeQty(id: number, delta: number) {
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty: Math.max(1, Math.min(30, c.qty + delta)) } : c))
  }

  const cartRight = (
    <button
      onClick={() => setCartOpen(true)}
      style={{
        position: 'relative',
        background: totalItems > 0 ? '#0d6efd' : '#f8f9fa',
        color: totalItems > 0 ? '#fff' : '#6c757d',
        border: '1px solid #ced4da',
        borderRadius: 10,
        padding: '8px 16px',
        fontWeight: 700,
        fontSize: '1rem',
        minHeight: 44,
      }}
    >
      Cart {totalItems > 0 && <span style={{ marginLeft: 4, background: '#fff', color: '#0d6efd', borderRadius: 99, padding: '0 7px', fontSize: '0.85rem', fontWeight: 800 }}>{totalItems}</span>}
    </button>
  )

  return (
    <PageLayout title="Prep List" back right={cartRight} noPad>
      {/* Priority tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #dee2e6' }}>
        {PRIORITIES.map(p => (
          <button
            key={p.id}
            onClick={() => setPriority(p.id)}
            style={{
              flex: 1, minHeight: 56, border: 'none',
              borderBottom: priority === p.id ? '3px solid #ffc107' : '3px solid transparent',
              background: priority === p.id ? '#fff9e6' : '#f8f9fa',
              fontWeight: priority === p.id ? 700 : 400,
              fontSize: '1.1rem',
              color: priority === p.id ? '#664d03' : '#495057',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Item list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10 }}>
        {PREP_ITEMS.filter(i => i.priority === priority).map(item => {
          const inCart = cart.find(c => c.id === item.id)
          return (
            <button
              key={item.id}
              onClick={() => toggle(item)}
              style={{
                minHeight: 68,
                border: inCart ? '3px solid #0d6efd' : '2px solid #dee2e6',
                borderRadius: 10,
                background: inCart ? '#e7f1ff' : '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 20px',
                fontSize: '1.2rem',
                fontWeight: inCart ? 700 : 400,
                color: inCart ? '#0d6efd' : '#212529',
                cursor: 'pointer',
              }}
            >
              <span>{item.name}</span>
              {inCart && (
                <span style={{
                  background: '#0d6efd', color: '#fff',
                  borderRadius: 99, width: 32, height: 32,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.9rem', fontWeight: 800,
                }}>
                  {inCart.qty}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Cart bottom sheet */}
      {cartOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setCartOpen(false)} />
          <div style={{
            position: 'relative', background: '#fff', borderRadius: '16px 16px 0 0',
            padding: 16, maxHeight: '70%', overflow: 'hidden auto',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>Cart</span>
              <button onClick={() => setCartOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', minHeight: 40, padding: '0 8px', color: '#6c757d' }}>✕</button>
            </div>

            {cart.length === 0 && <p style={{ color: '#6c757d', textAlign: 'center', padding: 16 }}>Nothing added yet.</p>}

            {cart.map(item => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0', borderBottom: '1px solid #dee2e6',
              }}>
                <span style={{ flex: 1, fontSize: '1.1rem' }}>{item.name}</span>
                <button onClick={() => changeQty(item.id, -1)} style={{ width: 44, height: 44, border: '1px solid #ced4da', borderRadius: 8, background: '#f8f9fa', fontSize: '1.2rem' }}>−</button>
                <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: '1.1rem' }}>{item.qty}</span>
                <button onClick={() => changeQty(item.id, 1)} style={{ width: 44, height: 44, border: '1px solid #ced4da', borderRadius: 8, background: '#f8f9fa', fontSize: '1.2rem' }}>+</button>
                <button onClick={() => toggle(item)} style={{ width: 44, height: 44, border: '1px solid #f8d7da', borderRadius: 8, background: '#f8d7da', fontSize: '1.1rem', color: '#842029' }}>✕</button>
              </div>
            ))}

            {cart.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  style={{ flex: 1, minHeight: 60, background: '#0d6efd', color: '#fff', border: 'none', borderRadius: 10, fontSize: '1.1rem', fontWeight: 700 }}
                >
                  Print List
                </button>
                <button
                  onClick={() => { setCart([]); setCartOpen(false) }}
                  style={{ minHeight: 60, background: '#f8d7da', color: '#842029', border: 'none', borderRadius: 10, fontSize: '1rem', padding: '0 16px' }}
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  )
}
