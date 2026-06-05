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
  { id: 2, label: '2 PM'  },
  { id: 3, label: '4 PM'  },
]

// ── Tailwind class map ──────────────────────────────────────────────────────
const classes = {
  cartBtn: (hasItems: boolean) =>
    [
      'border border-[#ced4da] rounded-xl px-4 py-2 font-bold text-base min-h-[44px]',
      hasItems ? 'bg-[#0d6efd] text-white' : 'bg-[#f8f9fa] text-[#6c757d]',
    ].join(' '),
  cartBadge:     'ml-1 bg-white text-[#0d6efd] rounded-full px-[7px] text-[0.85rem] font-extrabold',
  tabsContainer: 'flex border-b-2 border-[#dee2e6]',
  tabBtn: (active: boolean) =>
    [
      'flex-1 min-h-[56px] border-solid border-0 border-b-[3px] text-[1.1rem] cursor-pointer',
      active
        ? 'border-[#ffc107] bg-[#fff9e6] font-bold text-[#664d03]'
        : 'border-transparent bg-[#f8f9fa] font-normal text-[#495057]',
    ].join(' '),
  itemList: 'flex flex-col gap-[6px] p-[10px]',
  itemBtn: (inCart: boolean) =>
    [
      'min-h-[68px] rounded-xl flex items-center justify-between px-5 text-[1.2rem] cursor-pointer',
      inCart
        ? 'border-[3px] border-[#0d6efd] bg-[#e7f1ff] font-bold text-[#0d6efd]'
        : 'border-2 border-[#dee2e6] bg-white font-normal text-[#212529]',
    ].join(' '),
  itemQtyBadge:  'bg-[#0d6efd] text-white rounded-full w-8 h-8 flex items-center justify-center text-[0.9rem] font-extrabold',
  modalOverlay:  'fixed inset-0 z-[100] flex flex-col justify-end',
  modalBackdrop: 'absolute inset-0 bg-black/40',
  modalSheet:    'relative bg-white rounded-t-2xl p-4 max-h-[70%] overflow-y-auto shadow-[0_-4px_24px_rgba(0,0,0,0.15)]',
  modalHeader:   'flex justify-between items-center mb-3',
  modalTitle:    'text-[1.2rem] font-bold',
  modalCloseBtn: 'bg-transparent border-0 text-[1.4rem] min-h-[40px] px-2 text-[#6c757d]',
  modalEmpty:    'text-[#6c757d] text-center p-4',
  cartItem:      'flex items-center gap-3 py-[10px] border-b border-[#dee2e6]',
  cartItemName:  'flex-1 text-[1.1rem]',
  cartQtyBtn:    'w-11 h-11 border border-[#ced4da] rounded-lg bg-[#f8f9fa] text-[1.2rem]',
  cartQtyDisplay:'min-w-[28px] text-center font-bold text-[1.1rem]',
  cartDeleteBtn: 'w-11 h-11 border border-[#f8d7da] rounded-lg bg-[#f8d7da] text-[1.1rem] text-[#842029]',
  cartActions:   'flex gap-2 mt-4',
  cartPrintBtn:  'flex-1 min-h-[60px] bg-[#0d6efd] text-white border-0 rounded-xl text-[1.1rem] font-bold',
  cartClearBtn:  'min-h-[60px] bg-[#f8d7da] text-[#842029] border-0 rounded-xl text-base px-4',
}
// ───────────────────────────────────────────────────────────────────────────

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
    <button onClick={() => setCartOpen(true)} className={classes.cartBtn(totalItems > 0)}>
      Cart {totalItems > 0 && <span className={classes.cartBadge}>{totalItems}</span>}
    </button>
  )

  return (
    <PageLayout title="Prep List" back right={cartRight} noPad>
      {/* Priority tabs */}
      <div className={classes.tabsContainer}>
        {PRIORITIES.map(p => (
          <button key={p.id} onClick={() => setPriority(p.id)} className={classes.tabBtn(priority === p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Item list */}
      <div className={classes.itemList}>
        {PREP_ITEMS.filter(i => i.priority === priority).map(item => {
          const inCart = !!cart.find(c => c.id === item.id)
          const cartItem = cart.find(c => c.id === item.id)
          return (
            <button key={item.id} onClick={() => toggle(item)} className={classes.itemBtn(inCart)}>
              <span>{item.name}</span>
              {inCart && <span className={classes.itemQtyBadge}>{cartItem!.qty}</span>}
            </button>
          )
        })}
      </div>

      {/* Cart bottom sheet */}
      {cartOpen && (
        <div className={classes.modalOverlay}>
          <div className={classes.modalBackdrop} onClick={() => setCartOpen(false)} />
          <div className={classes.modalSheet}>
            <div className={classes.modalHeader}>
              <span className={classes.modalTitle}>Cart</span>
              <button onClick={() => setCartOpen(false)} className={classes.modalCloseBtn}>✕</button>
            </div>

            {cart.length === 0 && <p className={classes.modalEmpty}>Nothing added yet.</p>}

            {cart.map(item => (
              <div key={item.id} className={classes.cartItem}>
                <span className={classes.cartItemName}>{item.name}</span>
                <button onClick={() => changeQty(item.id, -1)} className={classes.cartQtyBtn}>−</button>
                <span className={classes.cartQtyDisplay}>{item.qty}</span>
                <button onClick={() => changeQty(item.id, 1)} className={classes.cartQtyBtn}>+</button>
                <button onClick={() => toggle(item)} className={classes.cartDeleteBtn}>✕</button>
              </div>
            ))}

            {cart.length > 0 && (
              <div className={classes.cartActions}>
                <button className={classes.cartPrintBtn}>Print List</button>
                <button onClick={() => { setCart([]); setCartOpen(false) }} className={classes.cartClearBtn}>Clear</button>
              </div>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  )
}
