# Lab Extraction Debug Status

## Date: 2025-08-08

## Summary
The lab extraction system is functional but currently in debug mode. Gemini 2.0 Flash successfully extracts lab test data from PDFs but returns it in a simple flat array format that needs processing for production use.

## Current Issues Discovered

### 1. API Gateway Timeout (RESOLVED)
- **Issue**: Default 15-second timeout was killing requests
- **Solution**: Added `deadline: 540` to API Gateway OpenAPI spec
- **Status**: ✅ Fixed

### 2. JSON Parsing Errors
- **Issue**: Structured output schema was too complex for Gemini
- **Cause**: Asking AI to determine `in_range` values and flag abnormal results
- **Solution**: Simplified to pure data extraction without analysis
- **Status**: ⚠️ Temporarily bypassed by disabling responseSchema

### 3. Response Format Inconsistency
- **Issue**: Gemini returns different field names across requests
- **Examples**: 
  - Sometimes `"Test"`, sometimes `"Analyte Name"`
  - Sometimes `"Value"`, sometimes `"Result"`
- **Status**: 🔴 Needs standardization

### 4. No Panel Grouping
- **Issue**: Results come as flat array, not grouped by panel
- **Example**: All tests mixed together instead of grouped as CBC, Metabolic Panel, etc.
- **Status**: 🔴 Needs implementation

## Current Debug Implementation

### Backend (`tyl-lab`)
```typescript
// Simplified prompt
"Extract all lab test results (and only results, no personal information) and return results in JSON."

// Response handling
return {
  success: true,
  panels: [], // Empty for now
  rawResponse: text, // Pass through raw JSON from Gemini
  errors: [],
};
```

### Frontend (`tyl`)
- `LabResultsDebug.astro`: Displays raw JSON response
- Pretty-prints JSON with proper indentation
- Shows processing time

### Sample Gemini Response Format
```json
[
  {
    "Test": "IRON, TOTAL",
    "Result": "98",
    "Reference Range": "50-180 mcg/dL",
    "Lab": "IG"
  },
  {
    "Test": "TRIGLYCERIDES",
    "Result": "54",
    "Reference Range": "<150 mg/dL",
    "Lab": "Z4M"
  }
]
```

## Performance Metrics
- Small PDF (1 page): ~5-6 seconds
- Large PDF (12 pages): ~30-35 seconds
- Both complete successfully with 540-second timeout

## Production Plan

### Phase 1: Standardize Response Format ⏱️ 2-3 days
1. **Define Standard Schema**
   ```typescript
   interface StandardTest {
     test_name: string;
     value: string;
     unit?: string;
     reference_range?: string;
     flag?: string;
     panel?: string;
   }
   ```

2. **Implement Response Normalizer**
   - Map various field names to standard format
   - Handle "Test" / "Analyte Name" → `test_name`
   - Handle "Value" / "Result" → `value`
   - Extract units from value string if combined

3. **Re-enable ResponseSchema**
   - Use simpler schema without complex logic
   - Focus on structure, not analysis

### Phase 2: Panel Grouping ⏱️ 2-3 days
1. **Identify Panel Names**
   - Look for section headers in original response
   - Use test name patterns (e.g., "WBC", "RBC" → CBC panel)
   - Consider using Gemini for intelligent grouping

2. **Implement Grouping Logic**
   - Create panel detection algorithm
   - Group related tests together
   - Handle ungrouped tests in "Other" category

### Phase 3: Data Quality ⏱️ 3-4 days
1. **Validation Rules**
   - Numeric values within reasonable ranges
   - Units match expected formats
   - Reference ranges properly formatted

2. **Error Handling**
   - Flag suspicious extractions
   - Provide confidence scores
   - Allow manual corrections

3. **Accuracy Testing**
   - Test with diverse PDF formats
   - Compare with manual extraction
   - Calculate accuracy metrics

### Phase 4: Frontend UI ⏱️ 3-4 days
1. **Results Table Component**
   - Display grouped by panels
   - Highlight out-of-range values
   - Show trends if multiple dates

2. **Export Functionality**
   - CSV export
   - JSON export
   - Copy to clipboard

3. **Edit Capability**
   - Allow corrections
   - Add missing values
   - Save edited results

### Phase 5: Optimization ⏱️ 2-3 days
1. **Performance**
   - Implement caching
   - Optimize Gemini prompts
   - Consider batch processing

2. **Accuracy Improvements**
   - Fine-tune prompts for specific lab formats
   - Handle edge cases
   - Add lab-specific parsers

## Technical Decisions

### Why Gemini 2.0 Flash?
- Fast processing (5-35 seconds)
- Good accuracy for structured data
- Cost-effective for high volume

### Why Structured Output Failed Initially
- Too complex asking for analysis (`in_range` determination)
- Should focus on extraction, not interpretation
- Simpler schema = more reliable results

### Architecture Benefits
- **Worker Proxy**: Secure API key management
- **API Gateway**: Authentication and rate limiting
- **Cloud Functions**: Scalable processing

## Next Steps

1. **Immediate** (This Week)
   - Test with more diverse PDFs
   - Document all response format variations
   - Create test suite with expected outputs

2. **Short Term** (Next 2 Weeks)
   - Implement Phase 1: Response standardization
   - Begin Phase 2: Panel grouping
   - Set up accuracy metrics

3. **Medium Term** (Next Month)
   - Complete all phases
   - User testing with real lab reports
   - Performance optimization

## Known Limitations

1. **OCR Quality**: Scanned PDFs may have lower accuracy
2. **Format Variety**: Each lab formats reports differently
3. **Complex Tables**: Multi-column layouts may confuse extraction
4. **Handwritten Notes**: Cannot extract handwritten annotations

## Success Metrics

- **Accuracy**: >95% of values correctly extracted
- **Speed**: <10 seconds for typical 5-page report
- **Reliability**: <1% failure rate
- **Coverage**: Support top 10 US lab formats

## Resources

- [Gemini API Documentation](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)
- [Structured Output Guide](https://cloud.google.com/vertex-ai/docs/generative-ai/json-mode)
- [API Gateway Configuration](https://cloud.google.com/api-gateway/docs/openapi-overview)

---

*Last Updated: 2025-08-08*
*Status: Debug Mode - Functional but needs production refinement*