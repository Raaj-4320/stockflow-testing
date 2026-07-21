import React, { useMemo, useRef, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from './ui';
import { Product } from '../types';
import { useEscapeLayer } from '../src/hooks/useEscapeLayer';

export type CustomerCatalogOptions = {
  catalogMode?: 'category' | 'new_arrival';
  selectedCategories: string[];
  selectedProductIds?: string[];
  groupByCategory: boolean;
  includeOutOfStock: boolean;
  showInStockPrices: boolean;
  showOutOfStockPrices: boolean;
  catalogTitle?: string;
  catalogSubtitle?: string;
  coverImage?: string;
};

const DEFAULT_NEW_ARRIVAL_COUNT = 40;

const safeLower = (value: unknown) => String(value || '').toLowerCase();

const getProductPickerImage = (product: Product) => {
  const firstGalleryImage = Array.isArray((product as any).galleryImages) ? (product as any).galleryImages[0] : '';
  const firstImageObj = Array.isArray((product as any).images) ? (product as any).images[0] : null;
  const firstImageObjSrc = typeof firstImageObj === 'string'
    ? firstImageObj
    : (firstImageObj?.src || firstImageObj?.url || '');
  return (product as any).thumbnailImage || product.image || (product as any).imageSrc || firstGalleryImage || firstImageObjSrc || '';
};

const getProductCode = (product: Product) => String((product as any).sku || product.barcode || '').trim() || 'No code';

const getProductSearchText = (product: Product) => [
  product.name,
  product.barcode,
  product.category,
  product.description,
  (product as any).sku,
].filter(Boolean).join(' ');

const getProductCreatedTimestamp = (product: Product) => {
  const createdAt = String(product.createdAt || '').trim();
  const createdAtMs = createdAt ? new Date(createdAt).getTime() : Number.NaN;
  if (Number.isFinite(createdAtMs)) return createdAtMs;

  const id = String(product.id || '').trim();
  const numericIdMatch = id.match(/\d{10,14}/);
  if (numericIdMatch) {
    const numericValue = Number(numericIdMatch[0]);
    if (Number.isFinite(numericValue)) {
      const normalized = numericIdMatch[0].length >= 13 ? numericValue : numericValue * 1000;
      const idDateMs = new Date(normalized).getTime();
      if (Number.isFinite(idDateMs) && idDateMs > new Date('2000-01-01T00:00:00.000Z').getTime()) {
        return idDateMs;
      }
    }
  }

  return Number.NaN;
};

const sortProductsForNewArrival = (products: Product[]) => (
  [...products]
    .map((product, index) => ({ product, index, stamp: getProductCreatedTimestamp(product) }))
    .sort((a, b) => {
      const aHasDate = Number.isFinite(a.stamp);
      const bHasDate = Number.isFinite(b.stamp);
      if (aHasDate && bHasDate && a.stamp !== b.stamp) return b.stamp - a.stamp;
      if (aHasDate !== bHasDate) return aHasDate ? -1 : 1;
      return a.index - b.index;
    })
    .map((entry) => entry.product)
);

type PickerSort = 'newest' | 'oldest' | 'name_asc' | 'name_desc';

export function CustomerCatalogOptionsModal({ isOpen, onClose, products, onGenerate, enableNewArrival = false }: { isOpen: boolean; onClose: () => void; products: Product[]; onGenerate: (opts: CustomerCatalogOptions) => void; enableNewArrival?: boolean; }) {
  useEscapeLayer(isOpen, onClose, { priority: 90 });

  const categories = useMemo(() => Array.from(new Set(products.map((p) => (p.category || 'Uncategorized').trim() || 'Uncategorized'))).sort(), [products]);
  const sortedNewestProducts = useMemo(() => sortProductsForNewArrival(products), [products]);
  const defaultNewArrivalIds = useMemo(() => sortedNewestProducts.slice(0, DEFAULT_NEW_ARRIVAL_COUNT).map((product) => product.id), [sortedNewestProducts]);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedCategories, setSelectedCategories] = useState<string[]>(categories);
  const [catalogMode, setCatalogMode] = useState<'category' | 'new_arrival'>('category');
  const [catalogProductIds, setCatalogProductIds] = useState<string[]>([]);
  const [selectedCatalogProductIds, setSelectedCatalogProductIds] = useState<string[]>([]);
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [includeOutOfStock, setIncludeOutOfStock] = useState(false);
  const [showInStockPrices, setShowInStockPrices] = useState(true);
  const [showOutOfStockPrices, setShowOutOfStockPrices] = useState(false);
  const [catalogTitle, setCatalogTitle] = useState('New Arrival');
  const [catalogSubtitle, setCatalogSubtitle] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [productPickerSearch, setProductPickerSearch] = useState('');
  const [pickerCategory, setPickerCategory] = useState('all');
  const [pickerSort, setPickerSort] = useState<PickerSort>('newest');
  const [pickerSelectedIds, setPickerSelectedIds] = useState<string[]>([]);
  const [draggingProductId, setDraggingProductId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wasOpenRef = useRef(false);

  React.useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;
    setCatalogMode('category');
    setSelectedCategories(categories);
    setCatalogProductIds(defaultNewArrivalIds);
    setSelectedCatalogProductIds(defaultNewArrivalIds);
    setGroupByCategory(true);
    setIncludeOutOfStock(false);
    setShowInStockPrices(true);
    setShowOutOfStockPrices(false);
    setCatalogTitle('New Arrival');
    setCatalogSubtitle('');
    setCoverImage('');
    setIsProductPickerOpen(false);
    setProductPickerSearch('');
    setPickerCategory('all');
    setPickerSort('newest');
    setPickerSelectedIds([]);
    setDraggingProductId(null);
    setError(null);
  }, [isOpen, categories, defaultNewArrivalIds]);

  const selectedCatalogProducts = useMemo(() => (
    catalogProductIds.map((id) => productMap.get(id)).filter(Boolean) as Product[]
  ), [catalogProductIds, productMap]);

  const filteredProductsForPicker = useMemo(() => {
    const term = safeLower(productPickerSearch.trim());
    const filtered = products.filter((product) => {
      const matchesSearch = !term || safeLower(getProductSearchText(product)).includes(term);
      const normalizedCategory = (product.category || 'Uncategorized').trim() || 'Uncategorized';
      const matchesCategory = pickerCategory === 'all' || normalizedCategory === pickerCategory;
      return matchesSearch && matchesCategory;
    });

    const sorted = [...filtered];
    if (pickerSort === 'newest' || pickerSort === 'oldest') {
      const newestOrdered = sortProductsForNewArrival(sorted);
      return pickerSort === 'newest' ? newestOrdered : newestOrdered.reverse();
    }
    return sorted.sort((a, b) => {
      const compare = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      return pickerSort === 'name_desc' ? compare * -1 : compare;
    });
  }, [pickerCategory, pickerSort, productPickerSearch, products]);

  const previewCount = useMemo(() => {
    if (catalogMode === 'new_arrival') return catalogProductIds.length;
    return products
      .filter((p) => selectedCategories.includes((p.category || 'Uncategorized').trim() || 'Uncategorized'))
      .filter((p) => includeOutOfStock || Number(p.stock || 0) > 0)
      .length;
  }, [catalogMode, catalogProductIds.length, includeOutOfStock, products, selectedCategories]);

  const addProductsToCatalog = (productIds: string[]) => {
    if (!productIds.length) return;
    setCatalogProductIds((prev) => {
      const seen = new Set(prev);
      const next = [...prev];
      for (const id of productIds) {
        if (seen.has(id)) continue;
        seen.add(id);
        next.push(id);
      }
      return next;
    });
    setSelectedCatalogProductIds((prev) => {
      const seen = new Set(prev);
      const next = [...prev];
      for (const id of productIds) {
        if (seen.has(id)) continue;
        seen.add(id);
        next.push(id);
      }
      return next;
    });
  };

  const handleAddSelectedProducts = () => {
    addProductsToCatalog(pickerSelectedIds);
    setPickerSelectedIds([]);
    setIsProductPickerOpen(false);
  };

  const handleSelectAllCatalogProducts = () => {
    setSelectedCatalogProductIds([...catalogProductIds]);
  };

  const handleClearAllCatalogSelection = () => {
    setSelectedCatalogProductIds([]);
  };

  const handleRemoveSelectedCatalogProducts = () => {
    if (!selectedCatalogProductIds.length) return;
    const selectedSet = new Set(selectedCatalogProductIds);
    setCatalogProductIds((prev) => prev.filter((id) => !selectedSet.has(id)));
    setSelectedCatalogProductIds([]);
  };

  const handleResetToLatest40 = () => {
    setCatalogProductIds(defaultNewArrivalIds);
    setSelectedCatalogProductIds(defaultNewArrivalIds);
  };

  const removeProductFromCatalog = (productId: string) => {
    setCatalogProductIds((prev) => prev.filter((id) => id !== productId));
    setSelectedCatalogProductIds((prev) => prev.filter((id) => id !== productId));
  };

  const handleCoverImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image.'));
      reader.readAsDataURL(file);
    }).catch(() => '');
    if (dataUrl) setCoverImage(dataUrl);
    event.currentTarget.value = '';
  };

  const handleDragStart = (productId: string) => setDraggingProductId(productId);
  const handleDropOnProduct = (targetProductId: string) => {
    if (!draggingProductId || draggingProductId === targetProductId) return;
    setCatalogProductIds((prev) => {
      const fromIndex = prev.indexOf(draggingProductId);
      const toIndex = prev.indexOf(targetProductId);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setSelectedCatalogProductIds((prev) => {
      const fromIndex = prev.indexOf(draggingProductId);
      const toIndex = prev.indexOf(targetProductId);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setDraggingProductId(null);
  };

  if (!isOpen) return null;

  return <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4">
    <Card className="w-full max-w-5xl">
      <CardHeader><CardTitle>Customer Catalog Options</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="text-xs text-destructive">{error}</div>}
        {enableNewArrival ? <div className="grid grid-cols-2 gap-2">
          <label className="text-sm flex items-center gap-2 rounded border p-2"><input type="radio" checked={catalogMode === 'category'} onChange={() => setCatalogMode('category')} /> Category Catalog</label>
          <label className="text-sm flex items-center gap-2 rounded border p-2"><input type="radio" checked={catalogMode === 'new_arrival'} onChange={() => setCatalogMode('new_arrival')} /> New Arrival</label>
        </div> : null}

        {!enableNewArrival || catalogMode === 'category' ? (
          <>
            <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setSelectedCategories(categories)}>Select All</Button><Button size="sm" variant="outline" onClick={() => setSelectedCategories([])}>Clear All</Button></div>
            <div className="max-h-32 overflow-auto border rounded p-2 grid grid-cols-2 gap-2">{categories.map((c) => <label key={c} className="text-sm flex items-center gap-2"><input type="checkbox" checked={selectedCategories.includes(c)} onChange={() => setSelectedCategories((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])} />{c}</label>)}</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm"><input type="radio" checked={groupByCategory} onChange={() => setGroupByCategory(true)} /> Group by category</label>
              <label className="text-sm"><input type="radio" checked={!groupByCategory} onChange={() => setGroupByCategory(false)} /> All products A-Z</label>
            </div>
            <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={includeOutOfStock} onChange={(e) => setIncludeOutOfStock(e.target.checked)} /> Include out-of-stock products</label>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Catalog Title</label>
                <Input value={catalogTitle} onChange={(e) => setCatalogTitle(e.target.value)} placeholder="New Arrival" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subtitle</label>
                <Input value={catalogSubtitle} onChange={(e) => setCatalogSubtitle(e.target.value)} placeholder="Optional subtitle" />
              </div>
            </div>

            <div className="space-y-2 rounded border p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">Cover Image</div>
                  <div className="text-xs text-muted-foreground">Optional. If empty, the existing default customer catalog cover remains in use.</div>
                </div>
                <div className="flex gap-2">
                  <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleCoverImageChange(e)} />
                  <Button type="button" size="sm" variant="outline" onClick={() => coverInputRef.current?.click()}>{coverImage ? 'Replace Cover' : 'Upload Cover'}</Button>
                  {coverImage ? <Button type="button" size="sm" variant="outline" onClick={() => setCoverImage('')}>Remove Cover</Button> : null}
                </div>
              </div>
              {coverImage ? <div className="h-28 w-40 overflow-hidden rounded border bg-muted/20"><img src={coverImage} alt="Catalog cover" className="h-full w-full object-cover" /></div> : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">Selected Products</div>
                  <div className="text-xs text-muted-foreground">The order and contents of this list are used exactly as-is for the PDF.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={handleSelectAllCatalogProducts}>Select All</Button>
                  <Button size="sm" variant="outline" onClick={handleClearAllCatalogSelection}>Clear All</Button>
                  <Button size="sm" variant="outline" onClick={handleRemoveSelectedCatalogProducts} disabled={!selectedCatalogProductIds.length}>Remove Selected</Button>
                  <Button size="sm" variant="outline" onClick={handleResetToLatest40}>Reset to Latest 40</Button>
                  <Button size="sm" onClick={() => setIsProductPickerOpen(true)}>Add Products</Button>
                </div>
              </div>
              <div className="max-h-80 overflow-auto rounded border">
                <div className="grid gap-2 p-2">
                  {selectedCatalogProducts.length === 0 ? <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">No products selected. Use Add Products or Reset to Latest 40.</div> : null}
                  {selectedCatalogProducts.map((product) => {
                    const productImage = getProductPickerImage(product);
                    const isSelected = selectedCatalogProductIds.includes(product.id);
                    return (
                      <div
                        key={product.id}
                        className={`flex items-center gap-3 rounded border p-2 text-sm ${draggingProductId === product.id || isSelected ? 'border-primary/50 bg-primary/5' : 'border-border'}`}
                        draggable
                        onDragStart={() => handleDragStart(product.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDropOnProduct(product.id)}
                        onDragEnd={() => setDraggingProductId(null)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => setSelectedCatalogProductIds((prev) => e.target.checked ? [...prev, product.id].filter((id, index, arr) => arr.indexOf(id) === index) : prev.filter((id) => id !== product.id))}
                        />
                        <div className="cursor-grab select-none text-lg text-muted-foreground" title="Drag to reorder">≡</div>
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded border bg-muted/20">
                          {productImage ? <img src={productImage} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">No Image</div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{product.name || 'Unnamed product'}</div>
                          <div className="text-xs text-muted-foreground truncate">{getProductCode(product)}</div>
                          <div className="text-xs text-muted-foreground">{(product.category || 'Uncategorized').trim() || 'Uncategorized'}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-semibold">Rs.{Number(product.sellPrice || 0).toFixed(0)}</div>
                          <Button type="button" size="sm" variant="ghost" className="mt-1 h-7 px-2 text-xs" onClick={() => removeProductFromCatalog(product.id)}>Remove</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={showInStockPrices} onChange={(e) => setShowInStockPrices(e.target.checked)} /> Show prices for in-stock products</label>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={showOutOfStockPrices} onChange={(e) => setShowOutOfStockPrices(e.target.checked)} /> Show prices for out-of-stock products</label>
        <div className="text-xs text-muted-foreground">Preview products: {previewCount}</div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => {
            if (enableNewArrival && catalogMode === 'new_arrival') {
              if (!catalogProductIds.length) return setError('Select at least one product.');
              onGenerate({
                catalogMode,
                selectedCategories: [],
                selectedProductIds: [...catalogProductIds],
                groupByCategory: false,
                includeOutOfStock: true,
                showInStockPrices,
                showOutOfStockPrices,
                catalogTitle: catalogTitle.trim() || 'New Arrival',
                catalogSubtitle: catalogSubtitle.trim(),
                coverImage,
              });
              return;
            }
            if (!selectedCategories.length) return setError('Select at least one category.');
            onGenerate({ catalogMode, selectedCategories, groupByCategory, includeOutOfStock, showInStockPrices, showOutOfStockPrices });
          }}>Generate PDF</Button>
        </div>

        {catalogMode === 'new_arrival' && isProductPickerOpen && (
          <div className="fixed inset-0 bg-black/70 z-[95] flex items-center justify-center p-4">
            <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
              <CardHeader className="border-b py-3 flex flex-row items-center justify-between gap-2">
                <CardTitle>Add Products</CardTitle>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsProductPickerOpen(false)}>Close</Button>
              </CardHeader>
              <CardContent className="p-3 space-y-3 overflow-y-auto max-h-[calc(90vh-136px)]">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sticky top-0 z-10 bg-background pb-2">
                  <Input value={productPickerSearch} onChange={(e) => setProductPickerSearch(e.target.value)} placeholder="Search name, code, SKU..." />
                  <Select value={pickerCategory} onChange={(e) => setPickerCategory(e.target.value)}>
                    <option value="all">All Categories</option>
                    {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </Select>
                  <Select value={pickerSort} onChange={(e) => setPickerSort(e.target.value as PickerSort)}>
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="name_asc">Name A-Z</option>
                    <option value="name_desc">Name Z-A</option>
                  </Select>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setPickerSelectedIds(filteredProductsForPicker.map((product) => product.id))}>Select All Visible</Button>
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setPickerSelectedIds([])}>Clear Visible Selection</Button>
                  </div>
                </div>

                {filteredProductsForPicker.length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No products found</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredProductsForPicker.map((product) => {
                      const imageSrc = getProductPickerImage(product);
                      const isSelected = pickerSelectedIds.includes(product.id);
                      const alreadyAdded = catalogProductIds.includes(product.id);
                      return (
                        <button
                          type="button"
                          key={product.id}
                          className={`rounded-md border p-2.5 space-y-2 text-left ${isSelected ? 'border-primary bg-primary/5' : 'border-border'} ${alreadyAdded ? 'opacity-80' : ''}`}
                          onClick={() => setPickerSelectedIds((prev) => prev.includes(product.id) ? prev.filter((id) => id !== product.id) : [...prev, product.id])}
                        >
                          <div className="flex gap-2">
                            <div className="h-14 w-14 rounded border bg-muted overflow-hidden shrink-0">
                              {imageSrc ? <img src={imageSrc} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">No Image</div>}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm truncate">{product.name || 'Unnamed product'}</div>
                              <div className="text-xs text-muted-foreground truncate">{getProductCode(product)}</div>
                              <div className="text-xs text-muted-foreground truncate">{(product.category || 'Uncategorized').trim() || 'Uncategorized'}</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold">Rs.{Number(product.sellPrice || 0).toFixed(0)}</span>
                            <span className="text-xs text-muted-foreground">{alreadyAdded ? 'Already in catalog' : isSelected ? 'Selected' : 'Click to select'}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="border-t pt-2 flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">Selected to add: {pickerSelectedIds.length}</div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsProductPickerOpen(false)}>Cancel</Button>
                    <Button type="button" onClick={handleAddSelectedProducts} disabled={!pickerSelectedIds.length}>Add Selected Products</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  </div>;
}
