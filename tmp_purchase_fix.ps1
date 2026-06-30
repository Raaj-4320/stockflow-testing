$path = 'pages/PurchasePanel.tsx'
$text = [System.IO.File]::ReadAllText((Resolve-Path $path), [System.Text.Encoding]::UTF8)

$text = $text.Replace("import { formatContactText, formatCurrency, formatGstText, formatLocationText, formatOptionalText, joinDisplayParts } from '../services/numberFormat';", "import { formatContactText, formatCurrency, formatGstText, formatLocationText, formatOptionalText, joinDisplayParts, sanitizeDisplayText } from '../services/numberFormat';")
$text = $text.Replace("const formatNumber = (value: number, digits = 2) => value.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });`r`nconst todayLabel = () => new Date().toLocaleDateString('en-GB');", "const formatNumber = (value: number, digits = 2) => value.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });`r`nconst EMPTY_DASH = '—';`r`nconst DISPLAY_SEPARATOR = '•';`r`nconst formatDisplayText = (value: unknown, fallback = EMPTY_DASH) => sanitizeDisplayText(value, fallback);`r`nconst todayLabel = () => new Date().toLocaleDateString('en-GB');")

foreach ($pair in @(
  @('Inventory Ã¢â€ â€™ Add Purchase','Inventory ? Add Purchase'),
  @('Ã¢â€ â€™','?'),
  @('Ã¢â‚¬â€','—'),
  @('â€”','—'),
  @('Ã‚Â·','•'),
  @('Â·','•'),
  @('Ã¢â‚¬Â¢','•'),
  @('â€¢','•'),
  @('Product Details • ','Product Details • '),
  @('Step 1 • Select Product','Step 1 • Select Product'),
  @('Step 2 • Select Variants','Step 2 • Select Variants'),
  @('Step 3 • Pricing & Party','Step 3 • Pricing & Party'),
  @('Step 4 • Review & Save','Step 4 • Review & Save')
)) { $text = $text.Replace($pair[0], $pair[1]) }

$text = $text.Replace("const formatVariantValue = (value?: string | null, fallback = '—') => {", "const formatVariantValue = (value?: string | null, fallback = EMPTY_DASH) => {")
$text = [regex]::Replace($text, 'value=\{`\?\$\{formatNumber\(([^{}]+?)\)\}`\}', 'value={formatCurrency($1)}')
$text = [regex]::Replace($text, '`\?\$\{formatNumber\(([^{}]+?)\)\}`', '`${formatCurrency($1)}`')
$text = [regex]::Replace($text, '\?\{formatNumber\(([^{}]+?)\)\}', '{formatCurrency($1)}')

$text = $text.Replace("Variant: <span className=\"font-medium text-slate-900\">{formatVariantValue(row.variant, NO_VARIANT)}</span> • Color: <span className=\"font-medium text-slate-900\">{formatVariantValue(row.color, NO_COLOR)}</span>", "Variant: <span className=\"font-medium text-slate-900\">{formatVariantValue(row.variant, NO_VARIANT)}</span> {DISPLAY_SEPARATOR} Color: <span className=\"font-medium text-slate-900\">{formatVariantValue(row.color, NO_COLOR)}</span>")
$text = $text.Replace("Legacy-only history row — not part of canonical purchase ledger.", "Legacy-only history row {EMPTY_DASH} not part of canonical purchase ledger.")
$text = $text.Replace("{row.partyName || '—'}", "{formatDisplayText(row.partyName)}")
$text = $text.Replace("{row.purchaseOrderLabel || row.purchaseOrderId || '—'}", "{formatDisplayText(row.purchaseOrderLabel || row.purchaseOrderId)}")
$text = $text.Replace("{row.reference || '—'}", "{formatDisplayText(row.reference)}")
$text = $text.Replace("{row.notes || '—'}", "{formatDisplayText(row.notes)}")
$text = $text.Replace("{party.phone || '—'}", "{formatDisplayText(party.phone)}")
$text = $text.Replace("{order.orderDate || order.createdAt || '—'}", "{formatDisplayText(order.orderDate || order.createdAt)}")
$text = $text.Replace("{row.date ? new Date(row.date).toLocaleDateString('en-GB') : '—'}", "{row.date ? new Date(row.date).toLocaleDateString('en-GB') : EMPTY_DASH}")
$text = $text.Replace("{row.type] || row.type || '—'}", "{row.type] || row.type || EMPTY_DASH}")
$text = $text.Replace("{row.description || '—'}", "{formatDisplayText(row.description)}")
$text = $text.Replace("{new Date(payment.effectiveAt || payment.paidAt || payment.createdAt).toLocaleString()} • {formatCurrency(payment.amount)} • {payment.method}", "{joinDisplayParts(new Date(payment.effectiveAt || payment.paidAt || payment.createdAt).toLocaleString(), formatCurrency(payment.amount), formatDisplayText(payment.method))}")
$text = $text.Replace("{new Date(entry.createdAt).toLocaleString()} • {entry.adminEmail || 'Unknown'} • {entry.reason}", "{joinDisplayParts(new Date(entry.createdAt).toLocaleString(), entry.adminEmail || 'Unknown', entry.reason)}")
$text = $text.Replace("{row.orderDate ? new Date(row.orderDate).toLocaleString() : '—'}", "{row.orderDate ? new Date(row.orderDate).toLocaleString() : EMPTY_DASH}")
$text = $text.Replace("{row.orderPartyId || '—'}", "{formatDisplayText(row.orderPartyId)}")
$text = $text.Replace("{row.qtyPerCtn ? formatNumber(row.qtyPerCtn, 0) : '—'}", "{row.qtyPerCtn ? formatNumber(row.qtyPerCtn, 0) : EMPTY_DASH}")
$text = $text.Replace("{row.totalCtn ? formatNumber(row.totalCtn, 0) : '—'}", "{row.totalCtn ? formatNumber(row.totalCtn, 0) : EMPTY_DASH}")
$text = $text.Replace("{row.paymentMethodLabel || '—'}", "{formatDisplayText(row.paymentMethodLabel)}")
$text = $text.Replace("{row.productId || '—'}", "{formatDisplayText(row.productId)}")
$text = $text.Replace("{row.createdBy || '—'}", "{formatDisplayText(row.createdBy)}")
$text = $text.Replace("{row.source || '—'}", "{formatDisplayText(row.source)}")
$text = $text.Replace("{patch.date ? new Date(patch.date).toLocaleString() : '—'}", "{patch.date ? new Date(patch.date).toLocaleString() : EMPTY_DASH}")
$text = $text.Replace("{patch.productId || '—'}", "{formatDisplayText(patch.productId)}")
$text = $text.Replace("{patch.partyId || '—'}", "{formatDisplayText(patch.partyId)}")
$text = $text.Replace("{purchaseRuntimeSearchResult.criteria.productName || '—'}", "{formatDisplayText(purchaseRuntimeSearchResult.criteria.productName)}")
$text = $text.Replace("{purchaseRuntimeSearchResult.criteria.supplierName || '—'}", "{formatDisplayText(purchaseRuntimeSearchResult.criteria.supplierName)}")
$text = $text.Replace("{purchaseRuntimeSearchResult.criteria.productId || '—'}", "{formatDisplayText(purchaseRuntimeSearchResult.criteria.productId)}")
$text = $text.Replace("{purchaseRuntimeSearchResult.criteria.partyId || '—'}", "{formatDisplayText(purchaseRuntimeSearchResult.criteria.partyId)}")
$text = $text.Replace("{purchaseRuntimeSearchResult.criteria.dateFrom || '—'}", "{formatDisplayText(purchaseRuntimeSearchResult.criteria.dateFrom)}")
$text = $text.Replace("{purchaseRuntimeSearchResult.criteria.dateTo || '—'}", "{formatDisplayText(purchaseRuntimeSearchResult.criteria.dateTo)}")
$text = $text.Replace("{candidate.purchaseOrderId || '—'}", "{formatDisplayText(candidate.purchaseOrderId)}")
$text = $text.Replace("{candidate.date ? new Date(candidate.date).toLocaleString() : '—'}", "{candidate.date ? new Date(candidate.date).toLocaleString() : EMPTY_DASH}")
$text = $text.Replace("{candidate.orderDate || '—'}", "{formatDisplayText(candidate.orderDate)}")
$text = $text.Replace("{candidate.createdAt || '—'}", "{formatDisplayText(candidate.createdAt)}")
$text = $text.Replace("{candidate.updatedAt || '—'}", "{formatDisplayText(candidate.updatedAt)}")
$text = $text.Replace("{candidate.partyName || '—'}", "{formatDisplayText(candidate.partyName)}")
$text = $text.Replace("{candidate.partyId || '—'}", "{formatDisplayText(candidate.partyId)}")
$text = $text.Replace("{candidate.productName || '—'}", "{formatDisplayText(candidate.productName)}")
$text = $text.Replace("{candidate.productId || '—'}", "{formatDisplayText(candidate.productId)}")
$text = $text.Replace("{candidate.status || '—'}", "{formatDisplayText(candidate.status)}")
$text = $text.Replace("{getProductBarcode(purchaseViewProduct) || '—'}", "{formatDisplayText(getProductBarcode(purchaseViewProduct))}")
$text = $text.Replace("{getProductCategory(purchaseViewProduct) || '—'}", "{formatDisplayText(getProductCategory(purchaseViewProduct))}")
$text = $text.Replace("{purchaseViewProduct.description || '—'}", "{formatDisplayText(purchaseViewProduct.description)}")
$text = $text.Replace('?{product.buyPrice}', '{formatCurrency(product.buyPrice)}')
$text = $text.Replace('?{product.sellPrice}', '{formatCurrency(product.sellPrice)}')
$text = $text.Replace("{paymentTargetParty?.name || '—'}", "{formatDisplayText(paymentTargetParty?.name)}")

[System.IO.File]::WriteAllText((Resolve-Path $path), $text, [System.Text.UTF8Encoding]::new($false))
