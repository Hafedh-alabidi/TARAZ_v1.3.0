import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  productId: number
  name: string
  price: number
  image: string
  sku: string
  quantity: number
  maxQuantity: number
}

interface CartState {
  items: CartItem[]
  isOpen: boolean
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => { ok: boolean; message: string }
  removeItem: (productId: number) => void
  updateQuantity: (productId: number, quantity: number) => { ok: boolean; message: string }
  clearCart: () => void
  setOpen: (open: boolean) => void
  totalItems: () => number
  subtotal: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (item, quantity = 1) => {
        const existing = get().items.find(i => i.productId === item.productId)
        if (existing) {
          const newQty = existing.quantity + quantity
          if (newQty > item.maxQuantity) {
            return { ok: false, message: `الكمية المتوفرة ${item.maxQuantity} فقط` }
          }
          set({
            items: get().items.map(i =>
              i.productId === item.productId ? { ...i, quantity: newQty } : i,
            ),
          })
        } else {
          if (quantity > item.maxQuantity) {
            return { ok: false, message: `الكمية المتوفرة ${item.maxQuantity} فقط` }
          }
          set({ items: [...get().items, { ...item, quantity }] })
        }
        return { ok: true, message: 'تمت الإضافة إلى السلة' }
      },

      removeItem: (productId) =>
        set({ items: get().items.filter(i => i.productId !== productId) }),

      updateQuantity: (productId, quantity) => {
        const item = get().items.find(i => i.productId === productId)
        if (!item) return { ok: false, message: 'المنتج غير موجود' }
        if (quantity <= 0) {
          get().removeItem(productId)
          return { ok: true, message: 'تم حذف المنتج' }
        }
        if (quantity > item.maxQuantity) {
          return { ok: false, message: `الكمية المتوفرة ${item.maxQuantity} فقط` }
        }
        set({
          items: get().items.map(i =>
            i.productId === productId ? { ...i, quantity } : i,
          ),
        })
        return { ok: true, message: 'تم تحديث الكمية' }
      },

      clearCart: () => set({ items: [] }),
      setOpen: (open) => set({ isOpen: open }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    { name: 'taraz_cart' },
  ),
)
