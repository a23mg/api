#!/usr/bin/env node

import blessed from 'neo-blessed';
import axios from 'axios';

const BASE_URL = 'https://dummyjson.com/products';
const PAGE_SIZE = 15;

// State
let products = [];
let totalProducts = 0;
let currentPage = 1;
let currentMode = 'all'; // 'all' | 'search' | 'category'
let currentSearchQuery = '';
let currentCategory = '';
let categoriesList = [];

// Initialize Blessed Screen
const screen = blessed.screen({
  smartCSR: true,
  title: 'DummyJSON Products TUI',
  fullUnicode: true,
});

// Top Header
const headerBox = blessed.box({
  parent: screen,
  top: 0,
  left: 0,
  width: '100%',
  height: 3,
  tags: true,
  content: '{center}{bold}📦 DummyJSON Products Explorer TUI{/bold}{/center}\n{center}Loading catalog...{/center}',
  style: {
    bg: 'blue',
    fg: 'white',
    bold: true,
  },
});

// Left Panel: Product List
const listPanel = blessed.list({
  parent: screen,
  top: 3,
  left: 0,
  width: '45%',
  height: '100%-6',
  keys: true,
  vi: true,
  mouse: true,
  tags: true,
  border: {
    type: 'line',
  },
  label: ' 📋 Products List (↑/↓ to Navigate) ',
  style: {
    border: {
      fg: 'cyan',
    },
    selected: {
      bg: 'cyan',
      fg: 'black',
      bold: true,
    },
    item: {
      hover: {
        bg: 'grey',
      },
    },
  },
});

// Right Panel: Product Detail
const detailPanel = blessed.box({
  parent: screen,
  top: 3,
  left: '45%',
  width: '55%',
  height: '100%-6',
  tags: true,
  scrollable: true,
  alwaysScroll: true,
  keys: true,
  vi: true,
  mouse: true,
  border: {
    type: 'line',
  },
  label: ' 🔍 Product Details (PageUp/PageDown to scroll) ',
  style: {
    border: {
      fg: 'green',
    },
  },
  content: '{center}Select a product to view details{/center}',
});

// Bottom Footer (Keybindings)
const footerBox = blessed.box({
  parent: screen,
  top: '100%-3',
  left: 0,
  width: '100%',
  height: 3,
  tags: true,
  style: {
    bg: 'black',
    fg: 'white',
  },
  content:
    '{yellow-fg}[↑/↓]{/yellow-fg} Navigate  ' +
    '{yellow-fg}[/]{/yellow-fg} Search  ' +
    '{yellow-fg}[C]{/yellow-fg} Category  ' +
    '{yellow-fg}[N/P]{/yellow-fg} Next/Prev Page  ' +
    '{yellow-fg}[R]{/yellow-fg} Reset  ' +
    '{yellow-fg}[Q]{/yellow-fg} Quit',
});

// Loading Box Modal
const loadingBox = blessed.box({
  parent: screen,
  top: 'center',
  left: 'center',
  width: 40,
  height: 7,
  border: { type: 'line' },
  tags: true,
  hidden: true,
  style: {
    border: { fg: 'yellow' },
    bg: 'black',
    fg: 'yellow',
    bold: true,
  },
});

// Search Dialog Input
const searchForm = blessed.form({
  parent: screen,
  top: 'center',
  left: 'center',
  width: 50,
  height: 8,
  keys: true,
  tags: true,
  border: { type: 'line' },
  label: ' 🔍 Search Products ',
  hidden: true,
  style: {
    border: { fg: 'yellow' },
    bg: 'black',
  },
});

const searchLabel = blessed.text({
  parent: searchForm,
  top: 1,
  left: 2,
  content: 'Enter keyword (Press [Enter] to Search, [Esc] to Cancel):',
  style: { fg: 'cyan' },
});

const searchInput = blessed.textbox({
  parent: searchForm,
  top: 3,
  left: 2,
  width: 44,
  height: 3,
  inputOnFocus: true,
  border: { type: 'line' },
  style: {
    border: { fg: 'white' },
    focus: { border: { fg: 'yellow' } },
  },
});

// Category Picker Dialog
const categoryPicker = blessed.list({
  parent: screen,
  top: 'center',
  left: 'center',
  width: 50,
  height: 18,
  keys: true,
  vi: true,
  mouse: true,
  tags: true,
  border: { type: 'line' },
  label: ' 📂 Select Category ([Esc] to Cancel) ',
  hidden: true,
  style: {
    border: { fg: 'magenta' },
    bg: 'black',
    selected: {
      bg: 'magenta',
      fg: 'white',
      bold: true,
    },
  },
});

// Helper: Show/Hide Loading
function showLoading(msg = 'Fetching data...') {
  loadingBox.setContent(`\n{center}⏳ ${msg}{/center}`);
  loadingBox.show();
  screen.render();
}

function hideLoading() {
  loadingBox.hide();
  screen.render();
}

// Update Top Header
function updateHeader() {
  const totalPages = Math.ceil(totalProducts / PAGE_SIZE) || 1;
  let statusText = '';

  if (currentMode === 'all') {
    statusText = `Mode: All Products | Page: ${currentPage}/${totalPages} | Total: ${totalProducts}`;
  } else if (currentMode === 'search') {
    statusText = `Mode: Search ("${currentSearchQuery}") | Page: ${currentPage}/${totalPages} | Total: ${totalProducts}`;
  } else if (currentMode === 'category') {
    statusText = `Mode: Category (${currentCategory}) | Page: ${currentPage}/${totalPages} | Total: ${totalProducts}`;
  }

  headerBox.setContent(
    `{center}{bold}📦 DummyJSON Products Explorer TUI{/bold}{/center}\n{center}${statusText}{/center}`
  );
  screen.render();
}

// Format Stars
function formatRating(rating) {
  const fullStars = Math.round(rating);
  return '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars) + ` (${rating.toFixed(2)})`;
}

// Render Product Detail
function renderDetail(product) {
  if (!product) {
    detailPanel.setContent('{center}No product selected{/center}');
    screen.render();
    return;
  }

  let text = '';
  text += `{bold}{yellow-fg}[#${product.id}] ${product.title}{/yellow-fg}{/bold}\n`;
  text += `{cyan-fg}${'─'.repeat(50)}{/cyan-fg}\n\n`;

  text += `{bold}🏷️  Brand:{/bold}      ${product.brand || 'N/A'}\n`;
  text += `{bold}📂 Category:{/bold}   ${product.category}\n`;
  text += `{bold}💰 Price:{/bold}      {green-fg}$${product.price}{/green-fg} (Discount: {red-fg}-${product.discountPercentage}%{/red-fg})\n`;
  text += `{bold}⭐ Rating:{/bold}     {yellow-fg}${formatRating(product.rating)}{/yellow-fg}\n`;
  text += `{bold}📦 Stock:{/bold}      ${product.stock > 0 ? `{green-fg}${product.stock} units available{/green-fg}` : '{red-fg}Out of stock{/red-fg}'}\n`;
  text += `{bold}🚚 Shipping:{/bold}   ${product.shippingInformation || 'Standard shipping'}\n`;
  text += `{bold}🛡️  Warranty:{/bold}   ${product.warrantyInformation || 'No warranty'}\n`;
  text += `{bold}↩️  Return:{/bold}     ${product.returnPolicy || 'Standard return policy'}\n\n`;

  text += `{bold}📝 Description:{/bold}\n`;
  text += `${product.description}\n\n`;

  if (product.tags && product.tags.length > 0) {
    text += `{bold}🔖 Tags:{/bold} ${product.tags.map((t) => `[${t}]`).join(' ')}\n\n`;
  }

  if (product.reviews && product.reviews.length > 0) {
    text += `{bold}💬 Recent Customer Reviews ({bold}${product.reviews.length}{/bold}):{/bold}\n`;
    product.reviews.forEach((r) => {
      text += `  • {yellow-fg}${'★'.repeat(r.rating)}{/yellow-fg} "${r.comment}" - {grey-fg}${r.reviewerName}{/grey-fg}\n`;
    });
  }

  detailPanel.setContent(text);
  detailPanel.scrollTo(0);
  screen.render();
}

// Fetch Products from API
async function loadProducts() {
  showLoading('Loading products from DummyJSON...');

  const skip = (currentPage - 1) * PAGE_SIZE;
  let url = `${BASE_URL}?limit=${PAGE_SIZE}&skip=${skip}`;

  if (currentMode === 'search') {
    url = `${BASE_URL}/search?q=${encodeURIComponent(currentSearchQuery)}&limit=${PAGE_SIZE}&skip=${skip}`;
  } else if (currentMode === 'category') {
    url = `${BASE_URL}/category/${encodeURIComponent(currentCategory)}?limit=${PAGE_SIZE}&skip=${skip}`;
  }

  try {
    const res = await axios.get(url);
    products = res.data.products || [];
    totalProducts = res.data.total || 0;

    const listItems = products.map(
      (p) => `{bold}#${p.id.toString().padStart(3, ' ')}{/bold} │ ${p.title.padEnd(26).slice(0, 26)} │ {green-fg}$${p.price.toFixed(2)}{/green-fg}`
    );

    listPanel.setItems(listItems);
    updateHeader();

    if (products.length > 0) {
      listPanel.select(0);
      renderDetail(products[0]);
    } else {
      renderDetail(null);
    }
  } catch (error) {
    detailPanel.setContent(`{red-fg}Error fetching data:{/red-fg}\n${error.message}`);
  } finally {
    hideLoading();
    listPanel.focus();
  }
}

// Fetch Category List
async function loadCategories() {
  try {
    const res = await axios.get(`${BASE_URL}/category-list`);
    categoriesList = res.data || [];
  } catch (err) {
    categoriesList = [];
  }
}

// List selection change event
listPanel.on('select item', (_item, index) => {
  if (products[index]) {
    renderDetail(products[index]);
  }
});

// Key Handlers
screen.key(['q', 'Q', 'C-c'], () => {
  return process.exit(0);
});

// Next Page
screen.key(['n', 'N'], () => {
  const maxPages = Math.ceil(totalProducts / PAGE_SIZE) || 1;
  if (currentPage < maxPages) {
    currentPage++;
    loadProducts();
  }
});

// Prev Page
screen.key(['p', 'P'], () => {
  if (currentPage > 1) {
    currentPage--;
    loadProducts();
  }
});

// Reset Filter
screen.key(['r', 'R'], () => {
  currentMode = 'all';
  currentSearchQuery = '';
  currentCategory = '';
  currentPage = 1;
  loadProducts();
});

// Open Search Modal
screen.key(['/'], () => {
  searchForm.show();
  searchInput.setValue('');
  searchInput.focus();
  screen.render();
});

searchInput.key('enter', () => {
  const query = searchInput.getValue().trim();
  searchForm.hide();
  if (query) {
    currentMode = 'search';
    currentSearchQuery = query;
    currentPage = 1;
    loadProducts();
  } else {
    listPanel.focus();
    screen.render();
  }
});

searchInput.key('escape', () => {
  searchForm.hide();
  listPanel.focus();
  screen.render();
});

// Open Category Picker Modal
screen.key(['c', 'C'], () => {
  if (categoriesList.length === 0) return;

  categoryPicker.setItems(categoriesList.map((c, i) => `${(i + 1).toString().padStart(2, ' ')}. ${c}`));
  categoryPicker.show();
  categoryPicker.focus();
  screen.render();
});

categoryPicker.on('select', (_item, index) => {
  const selected = categoriesList[index];
  categoryPicker.hide();
  if (selected) {
    currentMode = 'category';
    currentCategory = selected;
    currentPage = 1;
    loadProducts();
  } else {
    listPanel.focus();
  }
});

categoryPicker.key('escape', () => {
  categoryPicker.hide();
  listPanel.focus();
  screen.render();
});

// Initial Startup
async function start() {
  await loadCategories();
  await loadProducts();
}

start();
