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
    const lines = heroMatch[1].trim().split('\n');
    sections.hero = lines[0]?.replace(/^_/, '').replace(/_$/, '') || '';
    sections.highlights = lines
      .filter(line => line.startsWith('-'))
      .map(line => line.substring(1).trim());
  }
  
  // Extract Quick Facts table
  const quickFactsMatch = content.match(/## Quick Facts\n([\s\S]*?)(?=\n---|\n##|$)/);
  if (quickFactsMatch) {
    sections.quickFacts = parseQuickFacts(quickFactsMatch[1].trim());
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
    sections.whoShouldTake = whoShouldTakeMatch[1].trim()
      .split('\n')
      .filter(line => line.startsWith('-'))
      .map(line => line.substring(1).trim());
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

// Function to parse Quick Facts table
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

// Helper to convert markdown bold to strong tags and escape HTML
function convertBold(text) {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

// Helper to clean text
function cleanText(text) {
  return text
    .replace(/\[Order Now\]/g, '')
    .replace(/\[Find a Lab\]/g, '')
    .replace(/💲 /g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1');
}

// Category display names
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

// Function to determine import path depth
function getImportDepth(urlPath) {
  const depth = urlPath.split('/').filter(p => p && p !== 'tests').length;
  return '../'.repeat(depth + 1);
}

// Generate the Astro component matching the Adiponectin template exactly
function generateAstroComponent(testName, metadata, sections) {
  const price = Math.floor(metadata.price_usd);
  const importPath = getImportDepth(metadata.url_path);
  const categoryName = categoryDisplayNames[metadata.category] || metadata.category;
  
  // Extract fasting info
  const fastingRequired = sections.quickFacts['Fasting Required'] || 'No';
  const isFastingRequired = fastingRequired.toLowerCase().includes('yes');
  const fastingDuration = isFastingRequired ? (fastingRequired.match(/\((.*?)\)/)?.[1] || '8–12 hours') : '';
  
  // Build the testData object
  const testData = `{
  id: "${metadata.test_id}",
  name: "${testName}",
  price: ${price}.00,
  category: "${metadata.category}",
  subcategory: "${metadata.subcategory}",
  questName: "${metadata.quest_test_name}",
  description: "${sections.hero || metadata.quest_description}",
  turnaround: "${sections.quickFacts['Turnaround Time'] || '1–3 business days'}",
  sampleType: "${sections.quickFacts['Sample Type'] || 'Blood draw'}",
  fastingRequired: ${isFastingRequired},
  fastingDuration: "${fastingDuration}",
  alsoKnownAs: ${sections.quickFacts['Also Known As'] ? 
    JSON.stringify(sections.quickFacts['Also Known As'].split(',').map(s => s.trim())) : 
    '[]'}
}`;

  return `---
import ShoppingLayout from '${importPath}layouts/ShoppingLayout.astro';
import Footer from '${importPath}components/Footer.astro';

export const prerender = false;

const testData = ${testData};
---

<ShoppingLayout 
  title={\`\${testData.name} – Order Online | Track Your Labs\`}
  description={\`Order the \${testData.name} online for $\${testData.price.toFixed(2)}. ${cleanText(sections.hero || metadata.quest_description)}\`}
>
  <main class="flex-1">
    <!-- Hero Section -->
    <div class="min-h-screen bg-base-100">
      <div>
        <div class="max-w-2xl mx-auto px-4">
          <!-- Breadcrumb -->
          <nav class="text-sm breadcrumbs py-4">
            <ul>
              <li><a href="/" class="text-gray-600 hover:text-gray-900">Home</a></li>
              <li><a href="/tests" class="text-gray-600 hover:text-gray-900">Tests</a></li>
              <li><a href="/tests#${metadata.category}" class="text-gray-600 hover:text-gray-900">${categoryName}</a></li>
              <li class="text-gray-900">${testName}</li>
            </ul>
          </nav>

          <h1 class="text-4xl font-bold mb-4">{testData.name}</h1>
          <p class="text-lg text-gray-600 leading-relaxed mb-8">
            {testData.description}
          </p>
          
          <!-- Price and Add to Cart -->
          <div class="mb-12">
            <div class="flex items-baseline gap-2 mb-6">
              <span class="text-4xl font-bold">\${testData.price.toFixed(0)}</span>
            </div>
            
            <button id="add-to-cart" class="btn btn-primary btn-lg px-16">
              Add to Cart
            </button>
          </div>

          <!-- Marketing Copy Section -->
          <div class="marketing-section">
            <div class="vertical-separator"></div>
            
            <div class="marketing-content">
              <!-- Quick Facts -->
              <div class="quick-facts-section">
                <h2 class="section-title">Quick Facts</h2>
                <table class="facts-table">
                  <tbody>
                    <tr>
                      <td class="fact-label">Test Type</td>
                      <td class="fact-value">${sections.quickFacts['Test Type'] || 'Blood test'}</td>
                    </tr>
                    <tr>
                      <td class="fact-label">Fasting Required</td>
                      <td class="fact-value">${fastingRequired}</td>
                    </tr>
                    <tr>
                      <td class="fact-label">Sample Type</td>
                      <td class="fact-value">{testData.sampleType}</td>
                    </tr>
                    <tr>
                      <td class="fact-label">Turnaround Time</td>
                      <td class="fact-value">{testData.turnaround}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              ${sections.whatItMeasures ? `<!-- What This Test Measures -->
              <div class="content-section">
                <h2 class="section-title">What This Test Measures</h2>
                <p class="section-text">
                  ${convertBold(sections.whatItMeasures.replace(/\n\n/g, '</p>\n                <p class="section-text">\n                  '))}
                </p>
              </div>` : ''}

              ${sections.whoShouldTake && sections.whoShouldTake.length > 0 ? `<!-- Who Should Take This Test -->
              <div class="content-section">
                <h2 class="section-title">Who Should Take This Test</h2>
                <ul class="benefits-list">
                  ${sections.whoShouldTake.map(item => `<li class="benefit-item">
                    <svg class="benefit-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <span>${convertBold(item)}</span>
                  </li>`).join('\n                  ')}
                </ul>
              </div>` : ''}

              <!-- How It Works -->
              <div class="content-section">
                <h2 class="section-title">How It Works</h2>
                <div class="steps-container">
                  <div class="step-item">
                    <div class="step-number">1</div>
                    <div class="step-content">
                      <h3 class="step-title">Order Online</h3>
                      <p class="step-text">Select your test and pay securely</p>
                    </div>
                  </div>
                  <div class="step-item">
                    <div class="step-number">2</div>
                    <div class="step-content">
                      <h3 class="step-title">Visit a Lab</h3>
                      <p class="step-text">Provide your sample at a Quest Diagnostics location</p>
                    </div>
                  </div>
                  <div class="step-item">
                    <div class="step-number">3</div>
                    <div class="step-content">
                      <h3 class="step-title">Get Results</h3>
                      <p class="step-text">Access your secure, doctor-reviewed results within {testData.turnaround}</p>
                    </div>
                  </div>
                </div>
              </div>

              ${isFastingRequired ? `<!-- How to Prepare -->
              <div class="content-section">
                <h2 class="section-title">How to Prepare</h2>
                <ul class="benefits-list">
                  <li class="benefit-item">
                    <svg class="benefit-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <span>Fast for ${fastingDuration} before your appointment; only water is permitted</span>
                  </li>
                  <li class="benefit-item">
                    <svg class="benefit-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 16a9.065 9.065 0 0 0-6.23-.307L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                    </svg>
                    <span>Stay well-hydrated (drink water)</span>
                  </li>
                  <li class="benefit-item">
                    <svg class="benefit-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a1.5 1.5 0 0 0-1.006-1.006L15.75 7.5l1.035-.259a1.5 1.5 0 0 0 1.006-1.006L18 5.25l.259 1.035a1.5 1.5 0 0 0 1.006 1.006L20.25 7.5l-1.035.259a1.5 1.5 0 0 0-1.006 1.006ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                    </svg>
                    <span>Follow any medication guidance from your healthcare provider</span>
                  </li>
                </ul>
              </div>` : ''}

              ${sections.understandingResults ? `<!-- Understanding Your Results -->
              <div class="content-section">
                <h2 class="section-title">Understanding Your Results</h2>
                <div class="section-text">
                  ${convertBold(sections.understandingResults)}
                </div>
                <p class="text-sm text-gray-600 italic mt-4">
                  Note: Reference ranges vary; results should be interpreted by a healthcare provider in context of overall health.
                </p>
              </div>` : ''}

              <!-- Compliance & Trust -->
              <div class="cta-section">
                <p class="cta-text">
                  <strong>CLIA-Certified & HIPAA-Compliant.</strong> This test is processed by Quest Diagnostics, 
                  a trusted lab network. Your information is protected and results are reviewed by qualified medical professionals.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <Footer />
</ShoppingLayout>

<style>
  .marketing-section {
    margin-top: 4rem;
  }

  .vertical-separator {
    width: 1px;
    height: 100px;
    background: linear-gradient(to bottom, #e5e7eb, #e5e7eb 50%, transparent);
    margin: 0 auto 3rem;
  }

  .marketing-content {
    color: #374151;
  }

  .section-title {
    font-size: 1.875rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 1.5rem;
    line-height: 1.3;
  }

  .content-section {
    margin-bottom: 3.5rem;
  }

  .section-text {
    font-size: 1.125rem;
    line-height: 1.75;
    color: #4b5563;
    margin: 0;
  }

  /* Quick Facts Table */
  .quick-facts-section {
    margin-bottom: 3.5rem;
  }

  .facts-table {
    width: 100%;
    border-collapse: collapse;
  }

  .facts-table tbody tr {
    border-bottom: 1px solid #e5e7eb;
  }

  .facts-table tbody tr:last-child {
    border-bottom: none;
  }

  .fact-label {
    padding: 0.75rem 0;
    font-size: 0.875rem;
    color: #6b7280;
    font-weight: 600;
    width: 40%;
  }

  .fact-value {
    padding: 0.75rem 0;
    font-size: 1rem;
    color: #111827;
  }

  /* Benefits List */
  .benefits-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .benefit-item {
    margin-bottom: 1.25rem;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    font-size: 1rem;
    line-height: 1.6;
    color: #4b5563;
  }

  .benefit-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    margin-top: 2px;
    color: #10b981;
  }

  /* Steps */
  .steps-container {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .step-item {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
  }

  .step-number {
    width: 40px;
    height: 40px;
    background: #3b82f6;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    flex-shrink: 0;
  }

  .step-content {
    flex: 1;
  }

  .step-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin-bottom: 0.25rem;
  }

  .step-text {
    color: #6b7280;
    font-size: 0.875rem;
  }

  /* CTA Section */
  .cta-section {
    background: #f9fafb;
    padding: 1.5rem;
    border-radius: 8px;
    margin-bottom: 3.5rem;
  }

  .cta-text {
    font-size: 1rem;
    line-height: 1.6;
    color: #4b5563;
    margin: 0;
  }

  .cta-text strong {
    color: #111827;
  }

  @media (max-width: 640px) {
    .section-title {
      font-size: 1.5rem;
    }

    .section-text {
      font-size: 1rem;
    }
  }
</style>

<script>
  interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    category: string;
    subcategory: string;
    url: string;
  }

  const testData = ${testData.replace(/\n/g, '\n  ')};

  document.getElementById('add-to-cart')?.addEventListener('click', () => {
    // Get existing cart
    let cart: CartItem[] = [];
    try {
      cart = JSON.parse(localStorage.getItem('cart') || '[]');
    } catch {
      cart = [];
    }

    // Check if item already in cart
    const existingItem = cart.find(item => item.id === testData.id);
    
    if (existingItem) {
      // Item already in cart, just open drawer
      const cartDrawer = document.getElementById('cart-drawer') as HTMLInputElement;
      if (cartDrawer) {
        cartDrawer.checked = true;
      }
    } else {
      // Add new item
      cart.push({
        ...testData,
        quantity: 1,
        url: "${metadata.url_path}"
      });
      
      // Save cart
      localStorage.setItem('cart', JSON.stringify(cart));
      
      // Dispatch event for cart update
      window.dispatchEvent(new Event('cartUpdated'));
      
      // Open cart drawer
      const cartDrawer = document.getElementById('cart-drawer') as HTMLInputElement;
      if (cartDrawer) {
        cartDrawer.checked = true;
      }
      
      // Show success feedback
      const addButton = document.getElementById('add-to-cart') as HTMLButtonElement;
      const originalText = addButton.textContent;
      addButton.textContent = '✓ Added to Cart';
      addButton.classList.add('btn-success');
      
      setTimeout(() => {
        addButton.textContent = originalText;
        addButton.classList.remove('btn-success');
      }, 2000);
    }
  });
</script>

<!-- Structured Data for SEO -->
<script type="application/ld+json" is:inline>
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "${testName}",
  "description": "${cleanText(sections.hero || metadata.quest_description)}",
  "sku": "${metadata.test_id}",
  "brand": {
    "@type": "Brand",
    "name": "Quest Diagnostics"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://www.trackyourlabs.com${metadata.url_path}",
    "priceCurrency": "USD",
    "price": "${price}.00",
    "priceValidUntil": "2025-12-31",
    "availability": "https://schema.org/InStock"
  }
}
</script>

<script type="application/ld+json" is:inline>
{
  "@context": "https://schema.org",
  "@type": "MedicalTest",
  "name": "${testName}",
  "description": "${cleanText(sections.hero || metadata.quest_description)}",
  "usedToDiagnose": "${metadata.category.replace(/-/g, ' ')}, health assessment",
  "howPerformed": "Blood draw at Quest Diagnostics location"
}
</script>

<script type="application/ld+json" is:inline>
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://www.trackyourlabs.com/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Tests",
      "item": "https://www.trackyourlabs.com/tests/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "${testName}",
      "item": "https://www.trackyourlabs.com${metadata.url_path}"
    }
  ]
}
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
    
    // Skip Adiponectin since we're using it as the template
    if (testName === 'Adiponectin') {
      console.log(`Skipping ${testName} (template file)`);
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
      const astroContent = generateAstroComponent(metadata.quest_test_name, metadata, sections);
      
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