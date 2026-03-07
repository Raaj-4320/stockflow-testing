import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '../components/ui';
import { FreightBroker, FreightInquiry, InquiryPricingMode, Product, ProcurementLineSnapshot, VariantSelectionMode } from '../types';
import { addCategory, createFreightBroker, createFreightInquiry, getFreightBrokers, getFreightInquiries, loadData, updateFreightInquiry } from '../services/storage';
import { getProductStockRows, NO_COLOR, NO_VARIANT, productHasCombinationStock } from '../services/productVariants';
import { Plus, Upload } from 'lucide-react';

type FreightTab = 'orders' | 'inquiries' | 'brokers';
type CreateMode = 'inventory' | 'new';

type InquiryLineForm = {
  id: string;
  selected: boolean;
  variant: string;
  color: string;
  currentStock?: number;
  piecesPerCartoon: number;
  numberOfCartoons: number;
  totalPieces: number;
  rmbPricePerPiece: number;
  totalRmb: number;
  inrPricePerPiece: number;
  totalInr: number;
  exchangeRate: number;
  cbmPerCartoon: number;
  totalCbm: number;
  cbmRate: number;
  cbmCost: number;
  cbmPerPiece: number;
  productCostPerPiece: number;
  productCostTotalAmount: number;
  sellingPrice: number;
  profitPerPiece: number;
  profitPercent: number;
};

type InquiryFormState = {
  source: 'inventory' | 'new';
  inventoryProductId?: string;
  sourceProductId?: string;
  productPhoto?: string;
  productName: string;
  variant: string;
  color: string;
  category: string;
  additionalProductDetails: string;
  orderType: 'in_house' | 'customer_trade';
  brokerId?: string;
  brokerName: string;
  brokerType: 'broker' | 'owner';
  variantSelectionMode: VariantSelectionMode;
  pricingMode: InquiryPricingMode;
  piecesPerCartoon: number;
  numberOfCartoons: number;
  totalPieces: number;
  rmbPricePerPiece: number;
  totalRmb: number;
  inrPricePerPiece: number;
  totalInr: number;
  exchangeRate: number;
  cbmPerCartoon: number;
  totalCbm: number;
  cbmRate: number;
  cbmCost: number;
  cbmPerPiece: number;
  productCostPerPiece: number;
  productCostTotalAmount: number;
  sellingPrice: number;
  profitPerPiece: number;
  profitPercent: number;
};

const to2 = (n: number) => Number.isFinite(n) ? Number(n.toFixed(2)) : 0;

const calcFields = (f: Pick<InquiryLineForm, 'piecesPerCartoon' | 'numberOfCartoons' | 'rmbPricePerPiece' | 'inrPricePerPiece' | 'exchangeRate' | 'cbmPerCartoon' | 'cbmRate' | 'sellingPrice'>) => {
  const totalPieces = Math.max(0, f.piecesPerCartoon) * Math.max(0, f.numberOfCartoons);
  const totalRmb = Math.max(0, f.rmbPricePerPiece) * totalPieces;
  const totalInr = Math.max(0, f.inrPricePerPiece) * totalPieces;
  const totalCbm = Math.max(0, f.cbmPerCartoon) * Math.max(0, f.numberOfCartoons);
  const cbmCost = totalCbm * Math.max(0, f.cbmRate);
  const cbmPerPiece = totalPieces > 0 ? cbmCost / totalPieces : 0;
  const productCostPerPiece = Math.max(0, f.inrPricePerPiece) + cbmPerPiece;
  const productCostTotalAmount = productCostPerPiece * totalPieces;
  const profitPerPiece = Math.max(0, f.sellingPrice) - productCostPerPiece;
  const profitPercent = productCostPerPiece > 0 ? (profitPerPiece / productCostPerPiece) * 100 : 0;
  return {
    totalPieces: to2(totalPieces),
    totalRmb: to2(totalRmb),
    totalInr: to2(totalInr),
    totalCbm: to2(totalCbm),
    cbmCost: to2(cbmCost),
    cbmPerPiece: to2(cbmPerPiece),
    productCostPerPiece: to2(productCostPerPiece),
    productCostTotalAmount: to2(productCostTotalAmount),
    profitPerPiece: to2(profitPerPiece),
    profitPercent: to2(profitPercent),
  };
};

const emptyLine = (): InquiryLineForm => ({
  id: `line-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
  selected: true,
  variant: '',
  color: '',
  currentStock: undefined,
  piecesPerCartoon: 0,
  numberOfCartoons: 0,
  totalPieces: 0,
  rmbPricePerPiece: 0,
  totalRmb: 0,
  inrPricePerPiece: 0,
  totalInr: 0,
  exchangeRate: 1,
  cbmPerCartoon: 0,
  totalCbm: 0,
  cbmRate: 0,
  cbmCost: 0,
  cbmPerPiece: 0,
  productCostPerPiece: 0,
  productCostTotalAmount: 0,
  sellingPrice: 0,
  profitPerPiece: 0,
  profitPercent: 0,
});

const emptyForm = (): InquiryFormState => ({
  source: 'new',
  productName: '',
  variant: '',
  color: '',
  category: '',
  additionalProductDetails: '',
  orderType: 'in_house',
  brokerName: '',
  brokerType: 'broker',
  variantSelectionMode: 'none',
  pricingMode: 'common',
  piecesPerCartoon: 0,
  numberOfCartoons: 0,
  totalPieces: 0,
  rmbPricePerPiece: 0,
  totalRmb: 0,
  inrPricePerPiece: 0,
  totalInr: 0,
  exchangeRate: 1,
  cbmPerCartoon: 0,
  totalCbm: 0,
  cbmRate: 0,
  cbmCost: 0,
  cbmPerPiece: 0,
  productCostPerPiece: 0,
  productCostTotalAmount: 0,
  sellingPrice: 0,
  profitPerPiece: 0,
  profitPercent: 0,
});

const calcForm = (f: InquiryFormState) => {
  const computed = calcFields(f);
  return {
    ...f,
    brokerType: f.orderType === 'customer_trade' ? 'owner' : 'broker',
    brokerName: f.orderType === 'customer_trade' ? 'Owner' : f.brokerName,
    ...computed,
  };
};

const calcLine = (line: InquiryLineForm) => ({ ...line, ...calcFields(line) });

const lineFromStockRow = (variant: string, color: string, stock: number): InquiryLineForm => ({
  ...emptyLine(),
  variant,
  color,
  currentStock: stock,
  selected: false,
});

const toInquiryLineSnapshot = (line: InquiryLineForm, form: InquiryFormState): ProcurementLineSnapshot => ({
  id: line.id,
  sourceType: form.source,
  sourceProductId: form.sourceProductId || form.inventoryProductId,
  productPhoto: form.productPhoto,
  productName: form.productName.trim(),
  variant: line.variant || undefined,
  color: line.color || undefined,
  category: form.category.trim() || undefined,
  baseProductDetails: form.additionalProductDetails.trim() || undefined,
  quantity: line.totalPieces,
  piecesPerCartoon: line.piecesPerCartoon,
  numberOfCartoons: line.numberOfCartoons,
  rmbPricePerPiece: line.rmbPricePerPiece,
  inrPricePerPiece: line.inrPricePerPiece,
  exchangeRate: line.exchangeRate,
  cbmPerCartoon: line.cbmPerCartoon,
  cbmRate: line.cbmRate,
  cbmCost: line.cbmCost,
  cbmPerPiece: line.cbmPerPiece,
  productCostPerPiece: line.productCostPerPiece,
  sellingPrice: line.sellingPrice,
  profitPerPiece: line.profitPerPiece,
  profitPercent: line.profitPercent,
});

export default function FreightBooking() {
  const [activeTab, setActiveTab] = useState<FreightTab>('inquiries');
  const [products, setProducts] = useState<Product[]>([]);
  const [brokers, setBrokers] = useState<FreightBroker[]>([]);
  const [inquiries, setInquiries] = useState<FreightInquiry[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const [search, setSearch] = useState('');
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [choiceMode, setChoiceMode] = useState<CreateMode | null>(null);
  const [productSearch, setProductSearch] = useState('');

  const [showFormModal, setShowFormModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  const [selectedInquiry, setSelectedInquiry] = useState<FreightInquiry | null>(null);
  const [summaryInquiry, setSummaryInquiry] = useState<FreightInquiry | null>(null);
  const [editingInquiry, setEditingInquiry] = useState<FreightInquiry | null>(null);

  const [form, setForm] = useState<InquiryFormState>(emptyForm());
  const [lineItems, setLineItems] = useState<InquiryLineForm[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categorySearch, setCategorySearch] = useState('');
  const [newBrokerName, setNewBrokerName] = useState('');
  const [manualInrOverride, setManualInrOverride] = useState(false);
  const [draggingImage, setDraggingImage] = useState(false);
  const [selectedInventoryProduct, setSelectedInventoryProduct] = useState<Product | null>(null);

  const refresh = () => {
    const data = loadData();
    setProducts(data.products || []);
    setCategories(data.categories || []);
    setInquiries(getFreightInquiries());
    setBrokers(getFreightBrokers());
  };

  useEffect(() => {
    refresh();
    window.addEventListener('local-storage-update', refresh);
    return () => window.removeEventListener('local-storage-update', refresh);
  }, []);

  const hasInventoryCombinationStock = !!(selectedInventoryProduct && productHasCombinationStock(selectedInventoryProduct));

  const filteredInquiries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inquiries;
    return inquiries.filter(item =>
      item.id.toLowerCase().includes(q)
      || item.productName.toLowerCase().includes(q)
      || (item.variant || '').toLowerCase().includes(q)
      || (item.color || '').toLowerCase().includes(q)
    );
  }, [inquiries, search]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q));
  }, [products, productSearch]);

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(c => c.toLowerCase().includes(q));
  }, [categories, categorySearch]);

  const selectedLines = lineItems.filter(line => line.selected);
  const aggregatedFromLines = useMemo(() => {
    return selectedLines.reduce((acc, line) => {
      acc.totalPieces += line.totalPieces;
      acc.totalRmb += line.totalRmb;
      acc.totalInr += line.totalInr;
      acc.totalCbm += line.totalCbm;
      acc.cbmCost += line.cbmCost;
      acc.productCostTotalAmount += line.productCostTotalAmount;
      return acc;
    }, { totalPieces: 0, totalRmb: 0, totalInr: 0, totalCbm: 0, cbmCost: 0, productCostTotalAmount: 0 });
  }, [selectedLines]);

  const patchForm = (patch: Partial<InquiryFormState>) => {
    setForm(prev => calcForm({ ...prev, ...patch }));
  };

  const patchRmbOrRate = (patch: Partial<InquiryFormState>) => {
    setForm(prev => {
      const next = { ...prev, ...patch };
      if (!manualInrOverride) next.inrPricePerPiece = to2(next.rmbPricePerPiece * next.exchangeRate);
      return calcForm(next);
    });
  };

  const setInrManual = (value: number) => {
    setManualInrOverride(true);
    patchForm({ inrPricePerPiece: value });
  };

  useEffect(() => {
    if (form.variantSelectionMode !== 'exact') return;
    if (form.pricingMode !== 'common') return;
    setLineItems(prev => prev.map(line => line.selected ? calcLine({
      ...line,
      rmbPricePerPiece: form.rmbPricePerPiece,
      inrPricePerPiece: form.inrPricePerPiece,
      exchangeRate: form.exchangeRate,
      cbmPerCartoon: form.cbmPerCartoon,
      cbmRate: form.cbmRate,
      sellingPrice: form.sellingPrice,
    }) : line));
  }, [form.pricingMode, form.variantSelectionMode, form.rmbPricePerPiece, form.inrPricePerPiece, form.exchangeRate, form.cbmPerCartoon, form.cbmRate, form.sellingPrice]);

  const uploadFileToDataUrl = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => patchForm({ productPhoto: typeof reader.result === 'string' ? reader.result : '' });
    reader.readAsDataURL(file);
  };

  const onDropImage: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setDraggingImage(false);
    const file = event.dataTransfer.files?.[0];
    if (file) uploadFileToDataUrl(file);
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.productName.trim()) next.productName = 'Product name is required';
    if (!form.orderType) next.orderType = 'Order type is required';

    if (hasInventoryCombinationStock && form.variantSelectionMode === 'none') {
      next.variantSelectionMode = 'Select exact variants or choose unknown distribution.';
    }

    if (form.variantSelectionMode === 'exact') {
      if (!selectedLines.length) next.exactLines = 'Select at least one variant/color combination.';
      if (selectedLines.some(line => line.totalPieces <= 0)) next.exactLineQty = 'Each selected line must have quantity greater than 0.';
      if (selectedLines.some(line => line.rmbPricePerPiece <= 0 && line.inrPricePerPiece <= 0)) next.exactLinePricing = 'Each selected line needs RMB or INR price.';
    } else {
      if (form.piecesPerCartoon <= 0) next.piecesPerCartoon = 'Pieces per cartoon is required';
      if (form.numberOfCartoons <= 0) next.numberOfCartoons = 'Number of cartoons is required';
      if (form.rmbPricePerPiece <= 0 && form.inrPricePerPiece <= 0) next.pricing = 'Enter RMB or INR price per piece';
    }

    if (form.sellingPrice <= 0 && form.variantSelectionMode !== 'exact') next.sellingPrice = 'Selling price is required';

    const nonNegativeFields = [
      form.piecesPerCartoon,
      form.numberOfCartoons,
      form.rmbPricePerPiece,
      form.inrPricePerPiece,
      form.exchangeRate,
      form.cbmPerCartoon,
      form.cbmRate,
      form.sellingPrice,
      ...lineItems.flatMap(line => [line.piecesPerCartoon, line.numberOfCartoons, line.rmbPricePerPiece, line.inrPricePerPiece, line.exchangeRate, line.cbmPerCartoon, line.cbmRate, line.sellingPrice])
    ];
    if (nonNegativeFields.some(v => v < 0)) next.negative = 'Negative values are not allowed';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const openCreate = () => {
    setChoiceMode(null);
    setProductSearch('');
    setShowChoiceModal(true);
  };

  const chooseCreateMode = (mode: CreateMode) => {
    setChoiceMode(mode);
    if (mode === 'new') {
      setShowChoiceModal(false);
      setSelectedInventoryProduct(null);
      setLineItems([]);
      setForm(calcForm(emptyForm()));
      setManualInrOverride(false);
      setShowFormModal(true);
      setEditingInquiry(null);
    }
  };

  const useInventoryProduct = (product: Product) => {
    const hasCombos = productHasCombinationStock(product);
    const rows = getProductStockRows(product);
    setShowChoiceModal(false);
    setEditingInquiry(null);
    setManualInrOverride(false);
    setSelectedInventoryProduct(product);
    setLineItems(rows.map(row => lineFromStockRow(row.variant, row.color, row.stock)));
    setForm(calcForm({
      ...emptyForm(),
      source: 'inventory',
      sourceProductId: product.id,
      inventoryProductId: product.id,
      productPhoto: product.image,
      productName: product.name,
      variant: '',
      color: '',
      category: product.category || '',
      additionalProductDetails: product.description || '',
      variantSelectionMode: hasCombos ? 'exact' : 'none',
      pricingMode: 'common',
    }));
    setShowFormModal(true);
  };

  const hasUnsavedChange = () => JSON.stringify(calcForm(form)) !== JSON.stringify(calcForm(emptyForm())) || lineItems.length > 0;

  const requestExitForm = () => {
    if (hasUnsavedChange()) {
      setShowExitModal(true);
      return;
    }
    setShowFormModal(false);
  };

  const createBroker = async () => {
    if (!newBrokerName.trim()) return;
    const broker = await createFreightBroker({ name: newBrokerName.trim() });
    refresh();
    patchForm({ brokerId: broker.id, brokerName: broker.name });
    setNewBrokerName('');
  };

  const createCategoryFromSearch = () => {
    const value = categorySearch.trim();
    if (!value) return;
    addCategory(value);
    refresh();
    patchForm({ category: value });
    setCategorySearch('');
  };

  const toggleLineSelection = (id: string, checked: boolean) => {
    setLineItems(prev => prev.map(line => line.id === id ? { ...line, selected: checked } : line));
  };

  const updateLine = (id: string, patch: Partial<InquiryLineForm>, autoInr = false) => {
    setLineItems(prev => prev.map(line => {
      if (line.id !== id) return line;
      const next = { ...line, ...patch };
      if (autoInr) next.inrPricePerPiece = to2((next.rmbPricePerPiece || 0) * (next.exchangeRate || 0));
      return calcLine(next);
    }));
  };

  const addNewVariantLine = () => {
    setLineItems(prev => [...prev, { ...emptyLine(), selected: true }]);
    setForm(prev => ({ ...prev, variantSelectionMode: 'exact' }));
  };

  const removeLine = (id: string) => {
    setLineItems(prev => prev.filter(line => line.id !== id));
  };

  const saveInquiry = async (status: 'draft' | 'saved') => {
    if (!validate()) return;
    const now = new Date().toISOString();
    const normalizedMode: VariantSelectionMode = hasInventoryCombinationStock
      ? (form.variantSelectionMode === 'exact' ? 'exact' : 'unknown')
      : form.variantSelectionMode;

    const exactLines = normalizedMode === 'exact' ? selectedLines.map(line => toInquiryLineSnapshot(line, form)) : [];

    const primaryVariant = normalizedMode === 'exact'
      ? (selectedLines.length === 1 ? (selectedLines[0].variant === NO_VARIANT ? undefined : selectedLines[0].variant) : undefined)
      : (form.variant.trim() || undefined);
    const primaryColor = normalizedMode === 'exact'
      ? (selectedLines.length === 1 ? (selectedLines[0].color === NO_COLOR ? undefined : selectedLines[0].color) : undefined)
      : (form.color.trim() || undefined);

    const payload: FreightInquiry = {
      id: editingInquiry?.id || `inquiry-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      status,
      source: form.source,
      sourceProductId: form.sourceProductId || form.inventoryProductId,
      inventoryProductId: form.inventoryProductId,
      productPhoto: form.productPhoto,
      productName: form.productName.trim(),
      variant: primaryVariant,
      color: primaryColor,
      category: form.category.trim() || undefined,
      baseProductDetails: form.additionalProductDetails.trim() || undefined,
      orderType: form.orderType,
      brokerId: form.orderType === 'customer_trade' ? undefined : form.brokerId,
      brokerName: form.orderType === 'customer_trade' ? 'Owner' : (form.brokerName.trim() || undefined),
      brokerType: form.orderType === 'customer_trade' ? 'owner' : 'broker',
      totalPieces: normalizedMode === 'exact' ? to2(aggregatedFromLines.totalPieces) : form.totalPieces,
      piecesPerCartoon: normalizedMode === 'exact' ? 0 : form.piecesPerCartoon,
      numberOfCartoons: normalizedMode === 'exact' ? 0 : form.numberOfCartoons,
      rmbPricePerPiece: normalizedMode === 'exact' ? 0 : form.rmbPricePerPiece,
      totalRmb: normalizedMode === 'exact' ? to2(aggregatedFromLines.totalRmb) : form.totalRmb,
      inrPricePerPiece: normalizedMode === 'exact' ? 0 : form.inrPricePerPiece,
      totalInr: normalizedMode === 'exact' ? to2(aggregatedFromLines.totalInr) : form.totalInr,
      exchangeRate: normalizedMode === 'exact' ? 0 : form.exchangeRate,
      freightPerCbm: 0,
      cbmPerCartoon: normalizedMode === 'exact' ? 0 : form.cbmPerCartoon,
      totalCbm: normalizedMode === 'exact' ? to2(aggregatedFromLines.totalCbm) : form.totalCbm,
      cbmRate: normalizedMode === 'exact' ? 0 : form.cbmRate,
      cbmCost: normalizedMode === 'exact' ? to2(aggregatedFromLines.cbmCost) : form.cbmCost,
      cbmPerPiece: normalizedMode === 'exact' ? 0 : form.cbmPerPiece,
      productCostPerPiece: normalizedMode === 'exact' ? 0 : form.productCostPerPiece,
      sellingPrice: normalizedMode === 'exact' ? 0 : form.sellingPrice,
      profitPerPiece: normalizedMode === 'exact' ? 0 : form.profitPerPiece,
      profitPercent: normalizedMode === 'exact' ? 0 : form.profitPercent,
      variantSelectionMode: normalizedMode,
      pricingMode: normalizedMode === 'exact' ? form.pricingMode : undefined,
      lines: exactLines.length ? exactLines : undefined,
      futureOrderId: editingInquiry?.futureOrderId,
      convertedAt: editingInquiry?.convertedAt,
      convertedBy: editingInquiry?.convertedBy,
      createdAt: editingInquiry?.createdAt || now,
      updatedAt: now,
      updatedBy: undefined,
    };

    if (editingInquiry) await updateFreightInquiry(payload);
    else await createFreightInquiry(payload);

    refresh();
    setSummaryInquiry(payload);
    setShowSummaryModal(true);
    setShowFormModal(false);
    setSelectedInventoryProduct(null);
    setLineItems([]);
    setForm(calcForm(emptyForm()));
    setManualInrOverride(false);
    setErrors({});
  };

  const openDetails = (inquiry: FreightInquiry) => {
    setSelectedInquiry(inquiry);
    setShowDetailsModal(true);
  };

  const statusClass = (status: FreightInquiry['status']) => ({
    draft: 'bg-slate-100 text-slate-700',
    saved: 'bg-emerald-100 text-emerald-700',
    confirmed: 'bg-amber-100 text-amber-700',
    converted: 'bg-indigo-100 text-indigo-700',
  }[status]);

  const getInquiryModeLabel = (inquiry: FreightInquiry) => {
    const mode = inquiry.variantSelectionMode || 'none';
    if (mode === 'exact') return 'Exact variants';
    if (mode === 'unknown') return 'Variant distribution pending';
    return 'No variant split';
  };

  const inquiryLinesForDisplay = (inquiry: FreightInquiry) => {
    if (inquiry.lines?.length) return inquiry.lines;
    return [{
      id: `legacy-${inquiry.id}`,
      sourceType: inquiry.source,
      sourceProductId: inquiry.sourceProductId || inquiry.inventoryProductId,
      productName: inquiry.productName,
      variant: inquiry.variant,
      color: inquiry.color,
      category: inquiry.category,
      quantity: inquiry.totalPieces,
      piecesPerCartoon: inquiry.piecesPerCartoon,
      numberOfCartoons: inquiry.numberOfCartoons,
      rmbPricePerPiece: inquiry.rmbPricePerPiece,
      inrPricePerPiece: inquiry.inrPricePerPiece,
      exchangeRate: inquiry.exchangeRate,
      cbmPerCartoon: inquiry.cbmPerCartoon,
      cbmRate: inquiry.cbmRate,
      cbmCost: inquiry.cbmCost,
      cbmPerPiece: inquiry.cbmPerPiece,
      productCostPerPiece: inquiry.productCostPerPiece,
      sellingPrice: inquiry.sellingPrice,
      profitPerPiece: inquiry.profitPerPiece,
      profitPercent: inquiry.profitPercent,
    } as ProcurementLineSnapshot];
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Freight Booking</h1>
        <p className="text-sm text-muted-foreground">Create and manage freight inquiries.</p>
      </div>

      <div className="flex gap-2 border-b pb-2">
        {([
          ['orders', 'Orders'],
          ['inquiries', 'Inquiries'],
          ['brokers', 'Brokers'],
        ] as Array<[FreightTab, string]>).map(([key, label]) => (
          <Button key={key} variant={activeTab === key ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab(key)}>{label}</Button>
        ))}
      </div>

      {activeTab !== 'inquiries' ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {activeTab === 'orders' ? 'Orders tab is reserved for future confirmed order flow.' : 'Brokers tab will be expanded next.'}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Inquiries</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto_auto]">
              <Input placeholder="Search by order ID, product name, invoice number" value={search} onChange={e => setSearch(e.target.value)} />
              <Button variant="outline">Filter</Button>
              <Button variant="outline">Sort</Button>
              <Button onClick={openCreate}>Create Inquiry</Button>
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="p-3 text-left font-medium">Inquiry ID</th>
                    <th className="p-3 text-left font-medium">Product</th>
                    <th className="p-3 text-left font-medium">Variant handling</th>
                    <th className="p-3 text-left font-medium">Total pieces</th>
                    <th className="p-3 text-left font-medium">Status</th>
                    <th className="p-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!filteredInquiries.length && (
                    <tr><td className="p-4 text-center text-muted-foreground" colSpan={6}>No inquiries yet</td></tr>
                  )}
                  {filteredInquiries.map(item => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3 font-medium">{item.id}</td>
                      <td className="p-3">{item.productName}</td>
                      <td className="p-3">{getInquiryModeLabel(item)}{item.lines?.length ? ` • ${item.lines.length} line(s)` : ''}</td>
                      <td className="p-3">{item.totalPieces}</td>
                      <td className="p-3"><span className={`px-2 py-1 rounded text-xs ${statusClass(item.status)}`}>{item.status}</span></td>
                      <td className="p-3 text-right"><Button variant="outline" size="sm" onClick={() => openDetails(item)}>View Details</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {showChoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4" onClick={() => setShowChoiceModal(false)}>
          <Card className="w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            <CardHeader><CardTitle>Create Inquiry</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {!choiceMode && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="outline" onClick={() => chooseCreateMode('inventory')}>Use Existing Inventory Product</Button>
                  <Button variant="outline" onClick={() => chooseCreateMode('new')}>Create New Product Inquiry</Button>
                </div>
              )}

              {choiceMode === 'inventory' && (
                <div className="space-y-3">
                  <Input placeholder="Search product by name or barcode" value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                  <div className="max-h-64 overflow-auto border rounded">
                    {!filteredProducts.length && <p className="p-3 text-sm text-muted-foreground">No product found.</p>}
                    {filteredProducts.map(p => (
                      <button key={p.id} className="w-full text-left p-2 border-b hover:bg-muted/50 flex items-center gap-3" onClick={() => useInventoryProduct(p)}>
                        <div className="h-10 w-10 rounded border bg-muted overflow-hidden">{p.image ? <img src={p.image} className="h-full w-full object-cover" /> : null}</div>
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.barcode} • {p.category || '—'}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {showFormModal && (
        <div className="fixed inset-0 z-[60] bg-black/45 flex items-center justify-center p-4" onClick={requestExitForm}>
          <Card className="w-full max-w-6xl max-h-[92vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <CardHeader><CardTitle>Create Inquiry</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="border rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold">Product details</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label>Product photo</Label>
                      <div
                        className={`mt-1 rounded-lg border-2 border-dashed p-4 text-sm ${draggingImage ? 'border-primary bg-primary/5' : 'border-border'}`}
                        onDragOver={e => { e.preventDefault(); setDraggingImage(true); }}
                        onDragLeave={() => setDraggingImage(false)}
                        onDrop={onDropImage}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 hover:bg-muted/50">
                            <Upload className="w-4 h-4" /> Add Photo
                            <input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) uploadFileToDataUrl(file); }} />
                          </label>
                          <span className="text-muted-foreground">or drag & drop image here</span>
                          {form.productPhoto && <Button type="button" variant="outline" size="sm" onClick={() => patchForm({ productPhoto: undefined })}>Remove</Button>}
                        </div>
                        {form.productPhoto && <img src={form.productPhoto} className="mt-3 h-20 w-20 rounded border object-cover" />}
                      </div>
                    </div>

                    <div><Label>Product name</Label><Input value={form.productName} onChange={e => patchForm({ productName: e.target.value })} />{errors.productName && <p className="text-xs text-red-600">{errors.productName}</p>}</div>
                    <div>
                      <Label>Category</Label>
                      {form.source === 'inventory' ? (
                        <Input value={form.category} readOnly className="bg-muted/40" />
                      ) : (
                        <>
                          <Input placeholder="Search category" value={categorySearch} onChange={e => setCategorySearch(e.target.value)} />
                          {!!categorySearch.trim() && !filteredCategories.some(c => c.toLowerCase() === categorySearch.trim().toLowerCase()) && (
                            <button type="button" className="mt-1 text-xs text-primary" onClick={createCategoryFromSearch}>Create "{categorySearch.trim()}"</button>
                          )}
                          {!!filteredCategories.length && (
                            <div className="mt-1 max-h-24 overflow-auto border rounded">
                              {filteredCategories.map(c => <button type="button" key={c} className="block w-full text-left px-2 py-1 text-sm hover:bg-muted/50" onClick={() => { patchForm({ category: c }); setCategorySearch(''); }}>{c}</button>)}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">Selected: {form.category || '—'}</p>
                        </>
                      )}
                    </div>
                    <div className="sm:col-span-2"><Label>Additional product details</Label><Input value={form.additionalProductDetails} onChange={e => patchForm({ additionalProductDetails: e.target.value })} /></div>
                  </div>
                </section>

                <section className="border rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold">Order details</h3>
                  <div>
                    <Label>Order type</Label>
                    <div className="mt-2 grid sm:grid-cols-2 gap-2 text-sm">
                      <label className={`border rounded p-2 cursor-pointer ${form.orderType === 'in_house' ? 'border-primary bg-primary/5' : ''}`}><input type="radio" className="mr-2" checked={form.orderType === 'in_house'} onChange={() => patchForm({ orderType: 'in_house' })} />In House Order (Own)</label>
                      <label className={`border rounded p-2 cursor-pointer ${form.orderType === 'customer_trade' ? 'border-primary bg-primary/5' : ''}`}><input type="radio" className="mr-2" checked={form.orderType === 'customer_trade'} onChange={() => patchForm({ orderType: 'customer_trade' })} />Customer Order (Trade)</label>
                    </div>
                    {errors.orderType && <p className="text-xs text-red-600">{errors.orderType}</p>}
                  </div>

                  {form.orderType === 'customer_trade' ? (
                    <div><Label>Broker</Label><Input value="Owner" readOnly /></div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>Broker</Label>
                        <select className="h-10 w-full border rounded px-3 text-sm" value={form.brokerId || ''} onChange={e => {
                          const broker = brokers.find(b => b.id === e.target.value);
                          patchForm({ brokerId: broker?.id, brokerName: broker?.name || '' });
                        }}>
                          <option value="">Select broker</option>
                          {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label>Create new broker</Label>
                        <div className="flex gap-2"><Input value={newBrokerName} onChange={e => setNewBrokerName(e.target.value)} placeholder="Broker name" /><Button type="button" variant="outline" onClick={createBroker}><Plus className="w-4 h-4" /></Button></div>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              <section className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">Variant handling</h3>
                {hasInventoryCombinationStock && (
                  <div className="rounded border bg-muted/20 p-3 text-xs text-muted-foreground">
                    This product already has variant/color stock combinations. Choose exact selection or mark distribution as pending to avoid ambiguous stock updates later.
                  </div>
                )}
                <div className="grid gap-2 md:grid-cols-3 text-sm">
                  {(!hasInventoryCombinationStock) && (
                    <label className={`border rounded p-2 cursor-pointer ${form.variantSelectionMode === 'none' ? 'border-primary bg-primary/5' : ''}`}>
                      <input type="radio" className="mr-2" checked={form.variantSelectionMode === 'none'} onChange={() => patchForm({ variantSelectionMode: 'none' })} />
                      No variant split
                    </label>
                  )}
                  <label className={`border rounded p-2 cursor-pointer ${form.variantSelectionMode === 'exact' ? 'border-primary bg-primary/5' : ''}`}>
                    <input type="radio" className="mr-2" checked={form.variantSelectionMode === 'exact'} onChange={() => patchForm({ variantSelectionMode: 'exact' })} />
                    Select exact variants
                  </label>
                  <label className={`border rounded p-2 cursor-pointer ${form.variantSelectionMode === 'unknown' ? 'border-primary bg-primary/5' : ''}`}>
                    <input type="radio" className="mr-2" checked={form.variantSelectionMode === 'unknown'} onChange={() => patchForm({ variantSelectionMode: 'unknown' })} />
                    Variant distribution not decided yet
                  </label>
                </div>
                {errors.variantSelectionMode && <p className="text-xs text-red-600">{errors.variantSelectionMode}</p>}

                {form.variantSelectionMode !== 'exact' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>Variant</Label><Input value={form.variant} onChange={e => patchForm({ variant: e.target.value })} /></div>
                    <div><Label>Color</Label><Input value={form.color} onChange={e => patchForm({ color: e.target.value })} /></div>
                  </div>
                )}

                {form.variantSelectionMode === 'unknown' && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">Exact variant distribution is pending. Inventory cannot be updated by variant until mapping is completed later.</p>
                )}

                {form.variantSelectionMode === 'exact' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Pricing mode</Label>
                      <div className="flex gap-3 text-sm">
                        <label><input type="radio" className="mr-1" checked={form.pricingMode === 'common'} onChange={() => patchForm({ pricingMode: 'common' })} />Common</label>
                        <label><input type="radio" className="mr-1" checked={form.pricingMode === 'line_wise'} onChange={() => patchForm({ pricingMode: 'line_wise' })} />Line-wise</label>
                      </div>
                    </div>

                    <div className="overflow-x-auto border rounded">
                      <table className="min-w-full text-xs">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="p-2">Use</th>
                            <th className="p-2 text-left">Variant</th>
                            <th className="p-2 text-left">Color</th>
                            <th className="p-2 text-right">Current stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!lineItems.length && (
                            <tr><td className="p-2 text-muted-foreground" colSpan={4}>No combinations yet. Add a line below.</td></tr>
                          )}
                          {lineItems.map(line => (
                            <tr key={line.id} className="border-t">
                              <td className="p-2 text-center"><input type="checkbox" checked={line.selected} onChange={e => toggleLineSelection(line.id, e.target.checked)} /></td>
                              <td className="p-2">{line.variant || NO_VARIANT}</td>
                              <td className="p-2">{line.color || NO_COLOR}</td>
                              <td className="p-2 text-right">{line.currentStock ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {(form.source === 'new' || !lineItems.length) && <Button type="button" variant="outline" size="sm" onClick={addNewVariantLine}>Add variant/color line</Button>}
                    {errors.exactLines && <p className="text-xs text-red-600">{errors.exactLines}</p>}
                    {errors.exactLineQty && <p className="text-xs text-red-600">{errors.exactLineQty}</p>}
                    {errors.exactLinePricing && <p className="text-xs text-red-600">{errors.exactLinePricing}</p>}

                    {!!selectedLines.length && (
                      <div className="overflow-x-auto border rounded">
                        <table className="min-w-[1100px] w-full text-xs">
                          <thead className="bg-muted/30">
                            <tr>
                              <th className="p-2 text-left">Variant</th><th className="p-2 text-left">Color</th>
                              <th className="p-2">Pieces/carton</th><th className="p-2">Cartons</th><th className="p-2">Total pcs</th>
                              <th className="p-2">RMB/pc</th><th className="p-2">INR/pc</th><th className="p-2">Total INR</th>
                              <th className="p-2">CBM/carton</th><th className="p-2">Total CBM</th><th className="p-2">CBM cost</th>
                              <th className="p-2">Cost/pc</th><th className="p-2">Total Cost</th>
                              <th className="p-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedLines.map(line => (
                              <tr key={line.id} className="border-t align-top">
                                <td className="p-2">{line.variant || NO_VARIANT}</td>
                                <td className="p-2">{line.color || NO_COLOR}</td>
                                <td className="p-1"><Input type="number" min="0" value={line.piecesPerCartoon} onChange={e => updateLine(line.id, { piecesPerCartoon: Number(e.target.value) || 0 })} /></td>
                                <td className="p-1"><Input type="number" min="0" value={line.numberOfCartoons} onChange={e => updateLine(line.id, { numberOfCartoons: Number(e.target.value) || 0 })} /></td>
                                <td className="p-2 text-right">{line.totalPieces}</td>
                                <td className="p-1"><Input type="number" min="0" disabled={form.pricingMode === 'common'} value={line.rmbPricePerPiece} onChange={e => updateLine(line.id, { rmbPricePerPiece: Number(e.target.value) || 0 }, true)} /></td>
                                <td className="p-1"><Input type="number" min="0" disabled={form.pricingMode === 'common'} value={line.inrPricePerPiece} onChange={e => updateLine(line.id, { inrPricePerPiece: Number(e.target.value) || 0 })} /></td>
                                <td className="p-2 text-right">₹{line.totalInr}</td>
                                <td className="p-1"><Input type="number" min="0" disabled={form.pricingMode === 'common'} value={line.cbmPerCartoon} onChange={e => updateLine(line.id, { cbmPerCartoon: Number(e.target.value) || 0 })} /></td>
                                <td className="p-2 text-right">{line.totalCbm}</td>
                                <td className="p-2 text-right">₹{line.cbmCost}</td>
                                <td className="p-2 text-right">₹{line.productCostPerPiece}</td>
                                <td className="p-2 text-right">₹{line.productCostTotalAmount}</td>
                                <td className="p-1">
                                  {form.source === 'new' && <Button type="button" size="sm" variant="outline" onClick={() => removeLine(line.id)}>Remove</Button>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {form.variantSelectionMode !== 'exact' && (
                <>
                  <section className="border rounded-lg p-4 space-y-3">
                    <h3 className="font-semibold">Quantity</h3>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div><Label>Pieces per cartoon</Label><Input type="number" min="0" value={form.piecesPerCartoon} onChange={e => patchForm({ piecesPerCartoon: Number(e.target.value) || 0 })} />{errors.piecesPerCartoon && <p className="text-xs text-red-600">{errors.piecesPerCartoon}</p>}</div>
                      <div><Label>Number of cartoons</Label><Input type="number" min="0" value={form.numberOfCartoons} onChange={e => patchForm({ numberOfCartoons: Number(e.target.value) || 0 })} />{errors.numberOfCartoons && <p className="text-xs text-red-600">{errors.numberOfCartoons}</p>}</div>
                      <div><Label>Total pieces</Label><Input value={form.totalPieces} readOnly /></div>
                    </div>
                  </section>

                  <section className="border rounded-lg p-4 space-y-3">
                    <h3 className="font-semibold">Pricing</h3>
                    <div className="grid gap-4 lg:grid-cols-3">
                      <div className="border rounded p-3 space-y-2">
                        <h4 className="font-medium text-sm">RMB Price</h4>
                        <div><Label>RMB per piece</Label><Input type="number" min="0" value={form.rmbPricePerPiece} onChange={e => patchRmbOrRate({ rmbPricePerPiece: Number(e.target.value) || 0 })} /></div>
                        <div><Label>Total RMB</Label><Input value={form.totalRmb} readOnly /></div>
                        <div className="text-xs text-muted-foreground">{form.rmbPricePerPiece} × {form.totalPieces} = {form.totalRmb} RMB</div>
                        <div><Label>Exchange rate (RMB → INR)</Label><Input type="number" min="0" value={form.exchangeRate} onChange={e => patchRmbOrRate({ exchangeRate: Number(e.target.value) || 0 })} /></div>
                      </div>

                      <div className="border rounded p-3 space-y-2">
                        <h4 className="font-medium text-sm">INR Price</h4>
                        <div><Label>INR per piece</Label><Input type="number" min="0" value={form.inrPricePerPiece} onChange={e => setInrManual(Number(e.target.value) || 0)} /></div>
                        <div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => { setManualInrOverride(false); patchRmbOrRate({}); }}>Use Auto</Button><span className="text-xs text-muted-foreground self-center">{manualInrOverride ? 'Manual override' : 'Auto from RMB × rate'}</span></div>
                        <div><Label>Total INR</Label><Input value={form.totalInr} readOnly /></div>
                        <div className="text-xs text-muted-foreground">{form.inrPricePerPiece} × {form.totalPieces} = ₹{form.totalInr}</div>
                      </div>

                      <div className="border rounded p-3 space-y-2">
                        <h4 className="font-medium text-sm">CBM</h4>
                        <div><Label>CBM per cartoon</Label><Input type="number" min="0" value={form.cbmPerCartoon} onChange={e => patchForm({ cbmPerCartoon: Number(e.target.value) || 0 })} /></div>
                        <div><Label>Total CBM</Label><Input value={form.totalCbm} readOnly /></div>
                        <div><Label>CBM rate (₹ per CBM)</Label><Input type="number" min="0" value={form.cbmRate} onChange={e => patchForm({ cbmRate: Number(e.target.value) || 0 })} /></div>
                        <div><Label>CBM cost</Label><Input value={form.cbmCost} readOnly /></div>
                        <div><Label>CBM cost per piece</Label><Input value={form.cbmPerPiece} readOnly /></div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><Label>Product cost per piece</Label><Input value={form.productCostPerPiece} readOnly /></div>
                      <div><Label>Product cost total order amount</Label><Input value={form.productCostTotalAmount} readOnly /></div>
                    </div>
                    {(errors.pricing || errors.negative) && <p className="text-xs text-red-600">{errors.pricing || errors.negative}</p>}
                  </section>
                </>
              )}

              {form.variantSelectionMode === 'exact' && (
                <section className="border rounded-lg p-4 space-y-2">
                  <h3 className="font-semibold">Line totals</h3>
                  <div className="grid gap-3 sm:grid-cols-5 text-sm">
                    <div><span className="text-muted-foreground">Total pieces:</span> {to2(aggregatedFromLines.totalPieces)}</div>
                    <div><span className="text-muted-foreground">Total RMB:</span> {to2(aggregatedFromLines.totalRmb)}</div>
                    <div><span className="text-muted-foreground">Total INR:</span> ₹{to2(aggregatedFromLines.totalInr)}</div>
                    <div><span className="text-muted-foreground">Total CBM:</span> {to2(aggregatedFromLines.totalCbm)}</div>
                    <div><span className="text-muted-foreground">Total Cost:</span> ₹{to2(aggregatedFromLines.productCostTotalAmount)}</div>
                  </div>
                  {errors.negative && <p className="text-xs text-red-600">{errors.negative}</p>}
                </section>
              )}

              <section className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">Profit</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><Label>Selling price per piece</Label><Input type="number" min="0" value={form.sellingPrice} onChange={e => patchForm({ sellingPrice: Number(e.target.value) || 0 })} />{errors.sellingPrice && <p className="text-xs text-red-600">{errors.sellingPrice}</p>}</div>
                  <div><Label>Profit per piece</Label><Input value={form.profitPerPiece} readOnly /></div>
                  <div><Label>Profit %</Label><Input value={form.profitPercent} readOnly /></div>
                </div>
              </section>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => saveInquiry('draft')}>Save Draft</Button>
                <Button onClick={() => saveInquiry('saved')}>Save</Button>
                <Button variant="outline" onClick={requestExitForm}>Exit</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showExitModal && (
        <div className="fixed inset-0 z-[70] bg-black/45 flex items-center justify-center p-4" onClick={() => setShowExitModal(false)}>
          <Card className="w-full max-w-md" onClick={e => e.stopPropagation()}>
            <CardHeader><CardTitle>Discard changes?</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">You have unsaved changes. Are you sure you want to exit?</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowExitModal(false)}>Continue Editing</Button>
                <Button variant="destructive" onClick={() => { setShowExitModal(false); setShowFormModal(false); setSelectedInventoryProduct(null); setLineItems([]); setForm(calcForm(emptyForm())); setErrors({}); }}>Discard</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showSummaryModal && summaryInquiry && (
        <div className="fixed inset-0 z-[65] bg-black/45 flex items-center justify-center p-4" onClick={() => setShowSummaryModal(false)}>
          <Card className="w-full max-w-4xl" onClick={e => e.stopPropagation()}>
            <CardHeader><CardTitle>Inquiry Saved</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-[100px_1fr]">
                <div>{summaryInquiry.productPhoto ? <img src={summaryInquiry.productPhoto} className="h-24 w-24 rounded border object-cover" /> : <div className="h-24 w-24 rounded border bg-muted" />}</div>
                <div className="grid gap-1">
                  <div><span className="text-muted-foreground">Product:</span> {summaryInquiry.productName}</div>
                  <div><span className="text-muted-foreground">Inquiry ID:</span> {summaryInquiry.id}</div>
                  <div><span className="text-muted-foreground">Variant handling:</span> {getInquiryModeLabel(summaryInquiry)}</div>
                  <div><span className="text-muted-foreground">Order type:</span> {summaryInquiry.orderType === 'in_house' ? 'In House Order' : 'Customer Order'}</div>
                  <div><span className="text-muted-foreground">Broker:</span> {summaryInquiry.brokerName || 'Owner'}</div>
                  <div><span className="text-muted-foreground">Status:</span> {summaryInquiry.status}</div>
                </div>
              </div>

              {summaryInquiry.lines?.length ? (
                <div className="rounded border p-2">
                  <div className="font-medium mb-2">Selected lines ({summaryInquiry.lines.length})</div>
                  <div className="text-xs space-y-1 max-h-32 overflow-auto">
                    {summaryInquiry.lines.map(line => (
                      <div key={line.id} className="flex justify-between border-b pb-1">
                        <span>{line.variant || NO_VARIANT} / {line.color || NO_COLOR}</span>
                        <span>{line.quantity} pcs</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-4">
                <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Total pieces</div><div className="font-semibold">{summaryInquiry.totalPieces}</div></div>
                <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Total RMB</div><div className="font-semibold">{summaryInquiry.totalRmb}</div></div>
                <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Total INR</div><div className="font-semibold">₹{summaryInquiry.totalInr}</div></div>
                <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Total CBM</div><div className="font-semibold">{summaryInquiry.totalCbm}</div></div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setShowSummaryModal(false); openDetails(summaryInquiry); }}>View Details</Button>
                <Button onClick={() => { setShowSummaryModal(false); openCreate(); }}>Create Another Inquiry</Button>
                <Button variant="outline" onClick={() => setShowSummaryModal(false)}>Close</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showDetailsModal && selectedInquiry && (
        <div className="fixed inset-0 z-[70] bg-black/45 flex items-center justify-center p-4" onClick={() => setShowDetailsModal(false)}>
          <Card className="w-full max-w-5xl max-h-[92vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <CardHeader><CardTitle>Inquiry Details</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <section className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Product Information</h3>
                <div className="grid gap-3 sm:grid-cols-[100px_1fr_1fr]">
                  <div>{selectedInquiry.productPhoto ? <img src={selectedInquiry.productPhoto} className="h-20 w-20 rounded border object-cover" /> : <div className="h-20 w-20 rounded border bg-muted" />}</div>
                  <div><div className="text-muted-foreground">Product name</div><div>{selectedInquiry.productName}</div></div>
                  <div><div className="text-muted-foreground">Variant handling</div><div>{getInquiryModeLabel(selectedInquiry)}</div></div>
                </div>
              </section>

              <section className="border rounded-lg p-4 grid sm:grid-cols-3 gap-3">
                <div><div className="text-muted-foreground">Order Information</div><div>{selectedInquiry.orderType === 'in_house' ? 'In House Order (Own)' : 'Customer Order (Trade)'}</div></div>
                <div><div className="text-muted-foreground">Broker</div><div>{selectedInquiry.brokerName || 'Owner'}</div></div>
                <div><div className="text-muted-foreground">Status</div><div>{selectedInquiry.status}</div></div>
              </section>

              {selectedInquiry.variantSelectionMode === 'unknown' && (
                <section className="border rounded-lg p-4 text-amber-700 bg-amber-50 border-amber-200">
                  Variant distribution: Pending / Unknown. Inventory variant stock mapping must be completed later.
                </section>
              )}

              {!!inquiryLinesForDisplay(selectedInquiry).length && (
                <section className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Inquiry lines</h3>
                  <div className="overflow-x-auto border rounded">
                    <table className="min-w-full text-xs">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="p-2 text-left">Variant</th>
                          <th className="p-2 text-left">Color</th>
                          <th className="p-2 text-right">Qty (pcs)</th>
                          <th className="p-2 text-right">RMB/pc</th>
                          <th className="p-2 text-right">INR/pc</th>
                          <th className="p-2 text-right">Total INR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inquiryLinesForDisplay(selectedInquiry).map(line => (
                          <tr key={line.id} className="border-t">
                            <td className="p-2">{line.variant || '—'}</td>
                            <td className="p-2">{line.color || '—'}</td>
                            <td className="p-2 text-right">{line.quantity || 0}</td>
                            <td className="p-2 text-right">{line.rmbPricePerPiece || 0}</td>
                            <td className="p-2 text-right">{line.inrPricePerPiece || 0}</td>
                            <td className="p-2 text-right">₹{to2((line.inrPricePerPiece || 0) * (line.quantity || 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              <section className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Totals</h3>
                <div className="grid sm:grid-cols-4 gap-3">
                  <div><div className="text-muted-foreground">Total pieces</div><div>{selectedInquiry.totalPieces}</div></div>
                  <div><div className="text-muted-foreground">Total RMB</div><div>{selectedInquiry.totalRmb}</div></div>
                  <div><div className="text-muted-foreground">Total INR</div><div>₹{selectedInquiry.totalInr}</div></div>
                  <div><div className="text-muted-foreground">Total CBM</div><div>{selectedInquiry.totalCbm}</div></div>
                </div>
              </section>

              <div className="rounded border border-dashed p-3 text-muted-foreground">Future action placeholder: Convert to Confirmed Order.</div>
              <div className="flex justify-end"><Button variant="outline" onClick={() => setShowDetailsModal(false)}>Close</Button></div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
