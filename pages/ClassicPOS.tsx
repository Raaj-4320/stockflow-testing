import React, { useMemo, useState } from "react";

type Mode = "sale" | "return";

export type Customer = {
  id: number;
  name: string;
  phone: string;
  gstNumber?: string;
  gstName?: string;
  totalDue: number;
  totalPurchase: number;
};

export type Variant = {
  id: string;
  name: string;
  price: number;
  buyPrice: number;
  stock: number;
};

export type Product = {
  id: number;
  name: string;
  code: string;
  stock: number;
  category: string;
  image: string;
  variants: Variant[];
};

export type CartItem = {
  productId: number;
  name: string;
  image: string;
  price: number;
  qty: number;
  maxStock: number;
  variantName?: string;
};

type ClassicPOSProps = {
  products: Product[];
  customers: Customer[];
  cart: CartItem[];
  selectedCustomer: Customer | null;
  onAddToCart: (product: Product) => void;
  onUpdateQuantity: (productId: number, qty: number) => void;
  onRemoveFromCart: (productId: number) => void;
  onSelectCustomer: (customer: Customer | null) => void;
  onCheckout: () => void;
};

const baseTheme = {
  bg: "#f5f5f7",
  border: "#e5e7eb",
  borderStrong: "#d1d5db",
  text: "#111827",
  sub: "#6b7280",
  soft: "#fafafa",
  soft2: "#f3f4f6",
  accent: "#111111",
  accentBorder: "#d1d5db",
  danger: "#dc2626",
  disabledBg: "#ededed",
};

const returnTheme = {
  ...baseTheme,
  accent: "#d97706",
  accentBorder: "#fdba74",
};

const appleFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif';

function TrashIcon({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7H20M9 7V5C9 4.44772 9.44772 4 10 4H14C14.5523 4 15 4.44772 15 5V7M7 7L8 19C8.08963 20.0748 8.98878 20.9 10.0673 20.9H13.9327C15.0112 20.9 15.9104 20.0748 16 19L17 7M10 11V17M14 11V17"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ClassicPOS({
  products,
  customers,
  cart,
  selectedCustomer,
  onAddToCart,
  onUpdateQuantity,
  onRemoveFromCart,
  onSelectCustomer,
  onCheckout,
}: ClassicPOSProps) {
  const [mode, setMode] = useState<Mode>("sale");
  const [barcodeQuery, setBarcodeQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [customerQuery, setCustomerQuery] = useState("");
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);

  const theme = mode === "return" ? returnTheme : baseTheme;

  const inputStyle: React.CSSProperties = {
    height: 36,
    padding: "0 10px",
    border: `1px solid ${theme.borderStrong}`,
    borderRadius: 10,
    fontSize: 13.5,
    outline: "none",
    background: "#fff",
    color: theme.text,
    boxSizing: "border-box",
    fontFamily: appleFont,
  };

  const primaryBtn: React.CSSProperties = {
    height: 36,
    padding: "0 14px",
    background: theme.accent,
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
    fontFamily: appleFont,
  };

  const secondaryBtn: React.CSSProperties = {
    ...primaryBtn,
    background: "#fff",
    color: theme.text,
    border: `1px solid ${theme.borderStrong}`,
  };

  const iconBtnStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    minWidth: 28,
    border: `1px solid ${theme.borderStrong}`,
    borderRadius: 9,
    background: "#fff",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    color: theme.text,
  };

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );

  const filteredProducts = useMemo(() => {
    const q = barcodeQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [barcodeQuery, products, selectedCategory]);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers.slice(0, 6);
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.gstName || "").toLowerCase().includes(q)
    );
  }, [customerQuery, customers]);

  const cartQtyByProduct = useMemo(() => {
    const map = new Map<number, number>();
    cart.forEach((item) => {
      map.set(item.productId, (map.get(item.productId) || 0) + item.qty);
    });
    return map;
  }, [cart]);

  const cartSubtotal = useMemo(() => cart.reduce((sum, item) => sum + item.qty * item.price, 0), [cart]);

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, fontFamily: appleFont, color: theme.text, padding: 11 }}>
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          minHeight: "calc(100vh - 22px)",
          background: "#fff",
          border: `1px solid ${theme.border}`,
          borderRadius: 14,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 400px",
        }}
      >
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ border: `1px solid ${theme.border}`, borderRadius: 12, padding: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10, alignItems: "center" }}>
              <input
                value={barcodeQuery}
                onChange={(e) => setBarcodeQuery(e.target.value)}
                placeholder="Search product, barcode, category"
                style={{ ...inputStyle, width: "100%" }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, minWidth: 180 }}>
                <button onClick={() => setMode("sale")} style={{ ...(mode === "sale" ? primaryBtn : secondaryBtn) }}>Sale</button>
                <button onClick={() => setMode("return")} style={{ ...(mode === "return" ? primaryBtn : secondaryBtn) }}>Return</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingTop: 10, marginTop: 10 }}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{ ...(selectedCategory === cat ? primaryBtn : secondaryBtn), height: 32, padding: "0 14px", fontSize: 12.5 }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
              {filteredProducts.map((product) => {
                const qty = cartQtyByProduct.get(product.id) || 0;
                const stockLeft = Math.max(0, product.stock - qty);
                const shownPrice = product.variants.length > 0 ? Math.min(...product.variants.map((v) => v.price)) : 0;
                const isDisabled = stockLeft <= 0;

                return (
                  <div key={product.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 12, padding: 10, background: isDisabled ? theme.disabledBg : "#fff" }}>
                    <div style={{ height: 118, border: `1px solid ${theme.border}`, borderRadius: 10, overflow: "hidden", position: "relative" }}>
                      <img src={product.image} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      <div style={{ position: "absolute", right: 8, bottom: 4, background: "rgba(17,24,39,0.30)", color: "#fff", borderRadius: 999, padding: "2px 7px", fontSize: 11.25 }}>
                        ₹ {shownPrice}
                      </div>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 8 }}>{product.name}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "auto 28px 1fr 28px", gap: 8, alignItems: "center", marginTop: 8 }}>
                      <div style={{ fontSize: 11.75, color: theme.sub }}>Stock: {stockLeft}</div>
                      <button onClick={() => onUpdateQuantity(product.id, qty - 1)} style={iconBtnStyle} disabled={qty <= 0}>−</button>
                      <div style={{ height: 30, borderRadius: 8, background: theme.soft2, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>{qty}</div>
                      <button onClick={() => onAddToCart(product)} style={iconBtnStyle} disabled={isDisabled}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ background: "#fcfcfd", padding: 11, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 12, padding: 10, display: "grid", gap: 8 }}>
            <input
              value={selectedCustomer ? selectedCustomer.name : customerQuery}
              onChange={(e) => {
                setCustomerQuery(e.target.value);
                onSelectCustomer(null);
              }}
              onFocus={() => setShowCustomerDrop(true)}
              placeholder="Select customer"
              style={{ ...inputStyle, width: "100%" }}
            />
            {showCustomerDrop && (
              <div style={{ border: `1px solid ${theme.border}`, borderRadius: 10, maxHeight: 180, overflowY: "auto", background: "#fff" }}>
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => {
                      onSelectCustomer(customer);
                      setCustomerQuery(customer.name);
                      setShowCustomerDrop(false);
                    }}
                    style={{ width: "100%", textAlign: "left", border: "none", padding: "10px 12px", background: "#fff", cursor: "pointer" }}
                  >
                    {customer.name} • {customer.phone}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>{mode === "return" ? "Return Cart" : "Cart"}</div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {cart.length === 0 ? (
                <div style={{ border: `1px dashed ${theme.border}`, borderRadius: 12, padding: 20, textAlign: "center", color: theme.sub, fontSize: 12.5, background: theme.soft }}>
                  {mode === "return" ? "Return cart is empty" : "Cart is empty"}
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.productId} style={{ border: `1px solid ${theme.border}`, borderRadius: 11, padding: 8, display: "grid", gridTemplateColumns: "44px minmax(0, 1fr) 26px", gap: 8 }}>
                    <img src={item.image} alt={item.name} style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 10, border: `1px solid ${theme.border}` }} />
                    <div>
                      <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.name}{item.variantName ? ` - ${item.variantName}` : ""}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 28px", gap: 8, alignItems: "center", marginTop: 6 }}>
                        <button onClick={() => onUpdateQuantity(item.productId, item.qty - 1)} style={iconBtnStyle}>−</button>
                        <div style={{ height: 30, borderRadius: 8, background: theme.soft2, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>{item.qty}</div>
                        <button onClick={() => onUpdateQuantity(item.productId, item.qty + 1)} style={iconBtnStyle} disabled={item.qty >= item.maxStock}>+</button>
                      </div>
                    </div>
                    <button onClick={() => onRemoveFromCart(item.productId)} style={{ ...iconBtnStyle, width: 24, height: 24, borderColor: "#fecaca" }}>
                      <TrashIcon color={theme.danger} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 10, marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontWeight: 600 }}>
                <span>Subtotal</span>
                <span>₹ {cartSubtotal.toFixed(2)}</span>
              </div>
              <button onClick={onCheckout} disabled={cart.length === 0} style={{ ...primaryBtn, width: "100%", opacity: cart.length === 0 ? 0.5 : 1 }}>
                {mode === "return" ? "Create Return Invoice" : "Create Invoice"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
