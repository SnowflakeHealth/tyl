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

// Function to extract sections from markdown
function extractSections(content) {
  const sections = {};
  
  // Extract hero section
  const heroMatch = content.match(/## Hero Section\n([\s\S]*?)(?=\n---|\n##|$)/);
  if (heroMatch) {
    sections.hero = heroMatch[1].trim();
  }
  
  // Extract Quick Facts table
  const quickFactsMatch = content.match(/## Quick Facts\n([\s\S]*?)(?=\n---|\n##|$)/);
  if (quickFactsMatch) {
    sections.quickFacts = quickFactsMatch[1].trim();
  }
  
  // Extract What This Test Measures
  const whatItMeasuresMatch = content.match(/## What This Test Measures\n([\s\S]*?)(?=\n---|\n##|$)/);
  if (whatItMeasuresMatch) {
    sections.whatItMeasures = whatItMeasuresMatch[1].trim();
  }
  
  // Extract Why Take This Test
  const whyTakeMatch = content.match(/## Why Take This Test\n([\s\S]*?)(?=\n---|\n##|$)/);
  if (whyTakeMatch) {
    sections.whyTake = whyTakeMatch[1].trim();
  }
  
  // Extract Who Should Take This Test
  const whoShouldTakeMatch = content.match(/## Who Should Take This Test\n([\s\S]*?)(?=\n---|\n##|$)/);
  if (whoShouldTakeMatch) {
    sections.whoShouldTake = whoShouldTakeMatch[1].trim();
  }
  
  // Extract What to Expect
  const whatToExpectMatch = content.match(/## What to Expect\n([\s\S]*?)(?=\n---|\n##|$)/);
  if (whatToExpectMatch) {
    sections.whatToExpect = whatToExpectMatch[1].trim();
  }
  
  // Extract Understanding Your Results
  const understandingResultsMatch = content.match(/## Understanding Your Results\n([\s\S]*?)(?=\n---|\n##|$)/);
  if (understandingResultsMatch) {
    sections.understandingResults = understandingResultsMatch[1].trim();
  }
  
  // Extract How It Works
  const howItWorksMatch = content.match(/## How It Works\n([\s\S]*?)(?=\n---|\n##|$)/);
  if (howItWorksMatch) {
    sections.howItWorks = howItWorksMatch[1].trim();
  }
  
  return sections;
}

// Function to parse Quick Facts table into structured data
function parseQuickFacts(quickFactsText) {
  const facts = {};
  const lines = quickFactsText.split('\n');
  
  for (const line of lines) {
    if (line.includes('|') && !line.includes('---')) {
      const parts = line.split('|').map(p => p.trim()).filter(p => p);
      if (parts.length >= 2) {
        const key = parts[0].replace(/\*\*/g, '').trim();
        const value = parts[1].replace(/\*\*/g, '').trim();
        facts[key] = value;
      }
    }
  }
  
  return facts;
}

// Function to convert markdown bold to HTML
function convertMarkdownToHTML(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- /gm, '• ')
    .replace(/\[Order Now\]/g, '')
    .replace(/\[Find a Lab\]/g, '')
    .replace(/💲 /g, '');
}

// Function to generate Astro component
function generateAstroComponent(testName, metadata, sections) {
  const quickFacts = parseQuickFacts(sections.quickFacts || '');
  const price = Math.floor(metadata.price_usd); // Remove decimals
  
  // Parse hero section to extract highlights
  const heroLines = (sections.hero || '').split('\n');
  const description = heroLines[0]?.replace(/^_/, '').replace(/_$/, '') || '';
  const highlights = heroLines
    .filter(line => line.startsWith('-'))
    .map(line => line.substring(1).trim());
  
  // Generate simplified breadcrumb path
  const categoryDisplayNames = {
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
  
  const breadcrumbs = [
    { name: 'Tests', path: '/tests' },
    { name: categoryDisplayNames[metadata.category] || metadata.category, path: `/tests#${metadata.category}` },
    { name: testName, path: metadata.url_path }
  ];

  return `---
import ShoppingLayout from '../../../../layouts/ShoppingLayout.astro';
import Footer from '../../../../components/Footer.astro';

export const prerender = false;
---

<ShoppingLayout 
  title="${testName} - Track Your Labs"
  description="${description}"
>
  <div class="max-w-[640px] mx-auto px-4 lg:px-8 py-12">
    <!-- Breadcrumbs -->
    <div class="text-sm breadcrumbs mb-8">
      <ul>
        <li><a href="/">Home</a></li>
        ${breadcrumbs.map((crumb, index) => 
          index < breadcrumbs.length - 1 
            ? `<li><a href="${crumb.path}">${crumb.name}</a></li>`
            : `<li>${crumb.name}</li>`
        ).join('\n        ')}
      </ul>
    </div>
    
    <!-- Test Name -->
    <h1 class="text-3xl font-bold mb-6">${testName}</h1>
    
    <!-- Hero Description -->
    <p class="text-lg mb-8">${description}</p>
    
    <!-- Price and Add to Cart -->
    <div class="mb-8">
      <div class="flex items-end gap-4 mb-4">
        <span class="text-4xl font-bold">$${price}</span>
      </div>
      <button 
        class="btn btn-primary btn-lg w-full sm:w-auto"
        onclick="addToCart('${metadata.test_id}', '${testName.replace(/'/g, "\\'")}', ${price})"
      >
        Add to Cart
      </button>
    </div>
    
    ${highlights.length > 0 ? `<!-- Highlights -->
    <div class="bg-base-200 rounded-lg p-6 mb-8">
      <ul class="space-y-2">
        ${highlights.map(h => `<li class="flex items-start">
          <svg class="w-5 h-5 text-primary mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
          <span>${convertMarkdownToHTML(h)}</span>
        </li>`).join('\n        ')}
      </ul>
    </div>` : ''}
    
    <!-- Quick Facts -->
    <div class="mb-8">
      <h2 class="text-2xl font-bold mb-4">Quick Facts</h2>
      <div class="overflow-x-auto">
        <table class="table w-full">
          <tbody>
            ${Object.entries(quickFacts).map(([key, value]) => `<tr>
              <td class="font-semibold">${key}</td>
              <td>${value}</td>
            </tr>`).join('\n            ')}
          </tbody>
        </table>
      </div>
    </div>
    
    ${sections.whatItMeasures ? `<!-- What This Test Measures -->
    <div class="mb-8">
      <h2 class="text-2xl font-bold mb-4">What This Test Measures</h2>
      <div class="prose max-w-none">
        ${sections.whatItMeasures.split('\n').map(p => 
          p.trim() ? `<p>${convertMarkdownToHTML(p)}</p>` : ''
        ).join('\n        ')}
      </div>
    </div>` : ''}
    
    ${sections.whyTake ? `<!-- Why Take This Test -->
    <div class="mb-8">
      <h2 class="text-2xl font-bold mb-4">Why Take This Test</h2>
      <div class="prose max-w-none">
        ${sections.whyTake.split('\n').map(p => 
          p.trim() ? (p.startsWith('-') ? 
            `<li>${convertMarkdownToHTML(p.substring(1).trim())}</li>` : 
            `<p>${convertMarkdownToHTML(p)}</p>`)
          : ''
        ).join('\n        ')}
      </div>
    </div>` : ''}
    
    ${sections.whoShouldTake ? `<!-- Who Should Take This Test -->
    <div class="mb-8">
      <h2 class="text-2xl font-bold mb-4">Who Should Take This Test</h2>
      <div class="prose max-w-none">
        ${sections.whoShouldTake.split('\n').map(p => 
          p.trim() ? (p.startsWith('-') ? 
            `<li>${convertMarkdownToHTML(p.substring(1).trim())}</li>` : 
            `<p>${convertMarkdownToHTML(p)}</p>`)
          : ''
        ).join('\n        ')}
      </div>
    </div>` : ''}
    
    ${sections.whatToExpect ? `<!-- What to Expect -->
    <div class="mb-8">
      <h2 class="text-2xl font-bold mb-4">What to Expect</h2>
      <div class="prose max-w-none">
        ${sections.whatToExpect.split('\n').map(p => 
          p.trim() ? `<p>${convertMarkdownToHTML(p)}</p>` : ''
        ).join('\n        ')}
      </div>
    </div>` : ''}
    
    ${sections.understandingResults ? `<!-- Understanding Your Results -->
    <div class="mb-8">
      <h2 class="text-2xl font-bold mb-4">Understanding Your Results</h2>
      <div class="prose max-w-none">
        ${sections.understandingResults.split('\n').map(p => 
          p.trim() ? `<p>${convertMarkdownToHTML(p)}</p>` : ''
        ).join('\n        ')}
      </div>
    </div>` : ''}
    
    ${sections.howItWorks ? `<!-- How It Works -->
    <div class="mb-8">
      <h2 class="text-2xl font-bold mb-4">How It Works</h2>
      <div class="prose max-w-none">
        ${sections.howItWorks.split('\n\n').map(p => 
          p.trim() ? `<p>${convertMarkdownToHTML(p)}</p>` : ''
        ).join('\n        ')}
      </div>
    </div>` : ''}
  </div>
  
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
        quantity: 1,
        category: '${metadata.category}',
        subcategory: '${metadata.subcategory}',
        url: '${metadata.url_path}'
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
}

// Main function to process all test files
async function generateAllProductPages() {
  const docsTestsDir = path.join(__dirname, '..', 'docs', 'tests');
  const srcPagesDir = path.join(__dirname, '..', 'src', 'pages', 'tests');
  
  // Get all markdown files in docs/tests
  const files = fs.readdirSync(docsTestsDir).filter(f => f.endsWith('.md') && f !== 'hierarchy.md');
  
  console.log(`Found ${files.length} test data files to process`);
  
  let successCount = 0;
  let skipCount = 0;
  const errors = [];
  
  for (const file of files) {
    const testName = file.replace('.md', '');
    
    // Skip Adiponectin since we already created it manually
    if (testName === 'Adiponectin') {
      console.log(`Skipping ${testName} (already exists)`);
      skipCount++;
      continue;
    }
    
    try {
      // Read the markdown file
      const content = fs.readFileSync(path.join(docsTestsDir, file), 'utf-8');
      
      // Extract metadata and sections
      const metadata = extractMetadata(content);
      const sections = extractSections(content);
      
      // Generate the Astro component
      const astroContent = generateAstroComponent(testName, metadata, sections);
      
      // Create the directory structure
      const urlPath = metadata.url_path.replace(/^\/tests\//, '').replace(/\/$/, '');
      const outputDir = path.join(srcPagesDir, path.dirname(urlPath));
      const outputFile = path.join(outputDir, path.basename(urlPath) + '.astro');
      
      // Create directories if they don't exist
      fs.mkdirSync(outputDir, { recursive: true });
      
      // Write the Astro file
      fs.writeFileSync(outputFile, astroContent);
      
      console.log(`✓ Generated ${urlPath}`);
      successCount++;
    } catch (error) {
      console.error(`✗ Error processing ${testName}: ${error.message}`);
      errors.push({ test: testName, error: error.message });
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(`Successfully generated: ${successCount} pages`);
  console.log(`Skipped: ${skipCount} pages`);
  console.log(`Errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e.test}: ${e.error}`));
  }
}

// Run the script
generateAllProductPages().catch(console.error);