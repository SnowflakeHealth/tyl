import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to extract metadata from markdown file
function extractMetadata(content) {
  const metadataMatch = content.match(/```json\n([\s\S]*?)\n```/);
  if (!metadataMatch) {
    throw new Error('No metadata found in file');
  }
  return JSON.parse(metadataMatch[1]);
}

// Function to extract hero description
function extractHeroDescription(content) {
  const heroMatch = content.match(/## Hero Section\n([\s\S]*?)(?=\n---|\n##|$)/);
  if (heroMatch) {
    const lines = heroMatch[1].trim().split('\n');
    const desc = lines[0]?.replace(/^_/, '').replace(/_$/, '') || '';
    return desc;
  }
  return '';
}

// Category display names
const categoryNames = {
  'heart-health': 'Heart Health',
  'diabetes': 'Diabetes',
  'general-health': 'General Health',
  'metabolic-health': 'Metabolic Health',
  'hormone-health': 'Hormone Health',
  'thyroid-health': 'Thyroid Health',
  'liver-health': 'Liver Health',
  'kidney-health': 'Kidney Health',
  'blood-disorders': 'Blood Disorders',
  'infectious-diseases': 'Infectious Diseases',
  'allergy': 'Allergy'
};

// Main function to generate index page
async function generateTestsIndex() {
  const docsTestsDir = path.join(__dirname, '..', 'docs', 'tests');
  const outputFile = path.join(__dirname, '..', 'src', 'pages', 'tests', 'index.astro');
  
  // Get all markdown files
  const files = fs.readdirSync(docsTestsDir).filter(f => f.endsWith('.md') && f !== 'hierarchy.md');
  
  // Process all tests and group by category
  const testsByCategory = {};
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(docsTestsDir, file), 'utf-8');
      const metadata = extractMetadata(content);
      const description = extractHeroDescription(content);
      const testName = file.replace('.md', '');
      
      // Handle Adiponectin special case
      if (testName === 'Adiponectin') {
        metadata.test_id = 'b0c5e772-7507-4703-91da-13b913f35f53';
        metadata.quest_test_name = 'Adiponectin (Fat Metabolism) Test';
        metadata.url_path = '/tests/metabolic-health/adipokines/adiponectin-fat-metabolism/';
      }
      
      const category = metadata.category;
      if (!testsByCategory[category]) {
        testsByCategory[category] = [];
      }
      
      testsByCategory[category].push({
        id: metadata.test_id,
        name: metadata.quest_test_name,
        price: Math.floor(metadata.price_usd),
        url: metadata.url_path,
        description: description || metadata.quest_description,
        category: metadata.category,
        subcategory: metadata.subcategory
      });
    } catch (error) {
      console.error(`Error processing ${file}: ${error.message}`);
    }
  }
  
  // Sort categories in a logical order
  const categoryOrder = [
    'heart-health',
    'diabetes', 
    'general-health',
    'metabolic-health',
    'hormone-health',
    'thyroid-health',
    'liver-health',
    'blood-disorders',
    'infectious-diseases',
    'allergy'
  ];
  
  // Generate categories HTML
  let categoriesHTML = '';
  
  for (const category of categoryOrder) {
    const tests = testsByCategory[category];
    if (!tests || tests.length === 0) continue;
    
    let categoryHTML = `    <!-- ${categoryNames[category]} -->
    <div class="mb-12">
      <h2 class="text-2xl font-bold mb-6">${categoryNames[category]}</h2>
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
`;
    
    const sortedTests = tests.sort((a, b) => a.name.localeCompare(b.name));
    for (const test of sortedTests) {
      const escapedName = test.name.replace(/'/g, "\\'");
      const truncatedDesc = test.description.substring(0, 120) + (test.description.length > 120 ? '...' : '');
      
      categoryHTML += `        <a href="${test.url}" class="block group">
          <div class="card bg-base-100 border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all cursor-pointer h-full">
            <div class="card-body flex flex-col justify-between">
              <div>
                <h3 class="card-title text-lg mb-2">${test.name}</h3>
                <p class="text-gray-600 text-sm">${truncatedDesc}</p>
              </div>
              <div class="flex items-end justify-between mt-4">
                <span class="text-2xl font-bold">$${test.price}</span>
                <button class="btn btn-primary btn-sm" onclick="event.preventDefault(); event.stopPropagation(); addToCart('${test.id}', '${escapedName}', ${test.price});">
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </a>
`;
    }
    
    categoryHTML += `      </div>
    </div>
`;
    
    categoriesHTML += categoryHTML;
  }
  
  // Generate the Astro component
  const astroContent = `---
import ShoppingLayout from '../../layouts/ShoppingLayout.astro';
import Footer from '../../components/Footer.astro';

export const prerender = false;
---

<ShoppingLayout 
  title="Order Lab Tests Online - Track Your Labs"
  description="Browse and order lab tests online. CLIA-certified Quest Diagnostics processing. Fast, accurate results delivered securely."
>
  <div class="max-w-7xl mx-auto px-4 lg:px-8 py-12">
    <h1 class="text-4xl font-bold mb-8">Order Lab Tests Online</h1>
    
    <div class="alert alert-info mb-8">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
      <div>
        <p class="font-semibold">Shopping functionality coming soon!</p>
        <p>Browse our comprehensive test catalog below. Full checkout will be available shortly.</p>
      </div>
    </div>
    
${categoriesHTML}  </div>
  
  <Footer />
</ShoppingLayout>

<script>
  interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    category?: string;
    subcategory?: string;
    url?: string;
  }

  function addToCart(id: string, name: string, price: number) {
    // Get existing cart
    let cart: CartItem[] = [];
    try {
      cart = JSON.parse(localStorage.getItem('cart') || '[]');
    } catch {
      cart = [];
    }

    // Check if item already in cart
    const existingItem = cart.find(item => item.id === id);
    
    if (!existingItem) {
      // Add new item
      cart.push({
        id,
        name,
        price,
        quantity: 1
      });
      
      // Save cart
      localStorage.setItem('cart', JSON.stringify(cart));
      
      // Dispatch event for cart update
      window.dispatchEvent(new Event('cartUpdated'));
    }
    
    // Open cart drawer
    const cartDrawer = document.getElementById('cart-drawer') as HTMLInputElement;
    if (cartDrawer) {
      cartDrawer.checked = true;
    }
  }

  // Make function available globally
  (window as any).addToCart = addToCart;
</script>`;
  
  // Write the index file
  fs.writeFileSync(outputFile, astroContent);
  console.log(`✓ Generated tests index page with ${Object.values(testsByCategory).flat().length} tests`);
}

// Run the script
generateTestsIndex().catch(console.error);