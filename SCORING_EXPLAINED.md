# Trust-Me-Bro Scoring System Explained

## Overview

The system uses **BM25 (Best Matching 25)** algorithm to score how well KB articles match a ticket query. BM25 is a probabilistic ranking function used in information retrieval (think: how Google ranks search results).

---

## How BM25 Works

### 1. **Tokenization**
When you search for: `"unable advance property date"`

The system:
- Converts to lowercase: `"unable advance property date"`
- Splits into tokens: `["unable", "advance", "property", "date"]`
- Removes punctuation and short words

### 2. **Document Indexing**
Each KB article is tokenized the same way:
- **Title**: "PropertySuite: Advance Property Date"
- **Body**: "To advance a property date, go to..."
- **Product**: "PropertySuite"

All combined and tokenized into: `["propertysuite", "advance", "property", "date", "go", "to", ...]`

### 3. **Scoring Formula**

BM25 calculates a score based on:

```
Score = Σ IDF(term) × (f(term, doc) × (k1 + 1)) / (f(term, doc) + k1 × (1 - b + b × |doc|/avg_doc_length))
```

**Simplified explanation:**
- **Term frequency (TF)**: How many times query words appear in the document
- **Inverse document frequency (IDF)**: How rare/common the word is across all documents
- **Document length normalization**: Longer documents don't automatically rank higher

**Key factors:**
- ✅ **More matching words** → Higher score
- ✅ **Rare words match** → Higher score (e.g., "PropertySuite" is more valuable than "the")
- ✅ **Relevant document length** → Better score (not too short, not too long)

---

## What the Scores Mean

### Score Ranges in Your System

| Score Range | Meaning | Example |
|-------------|---------|---------|
| **0 - 5** | Very weak match | Few/no keywords match |
| **5 - 15** | Weak match | Some keywords, but not highly relevant |
| **15 - 30** | Good match | Multiple keywords, decent relevance |
| **30 - 50** | Strong match | Many keywords, high relevance |
| **50+** | Excellent match | Very specific, highly relevant |

### Your Example

```
Ticket: CS-38908386
Query: "unable advance property date data fails because backend voucher..."
Top-1 Score: 34.56
```

**What this means:**
- The KB article contains **many matching keywords** from your query
- Words like "advance", "property", "date" appear frequently in the KB
- The document length is appropriate (not too long/short)
- **Result**: This is a **strong match** — the KB likely answers the ticket

---

## Gap Detection Thresholds

The system uses these thresholds to decide if there's a **knowledge gap**:

```python
GAP_THRESHOLD_TOP1 = 8.0   # Top-1 result must score ≥ 8.0
GAP_THRESHOLD_AVG = 5.0    # Average of top-5 must be ≥ 5.0
```

### Gap Detection Logic

A **GAP is detected** if:
1. ❌ **No results** returned, OR
2. ❌ **Top-1 score < 8.0**, OR  
3. ❌ **Average score < 5.0**

### Why Your Scores Are High

Your tickets are getting scores like **26-35**, which means:

✅ **No gaps detected** — The seed KB (3,046 articles) already covers these tickets well!

**Why scores are high:**
- The dataset has **domain-specific KB articles** (PropertySuite, ExampleCo, etc.)
- Tickets use **similar terminology** to the KB articles
- The KB articles are **well-written** and contain relevant keywords

---

## Score Interpretation Examples

### Example 1: Strong Match (No Gap)
```
Query: "unable advance property date"
Top-1 Score: 34.56
Avg Score: 29.57
```
**Interpretation:**
- ✅ Top-1 score (34.56) >> threshold (8.0) → **Strong match**
- ✅ Avg score (29.57) >> threshold (5.0) → **Consistent relevance**
- ✅ **No gap** — KB covers this ticket

### Example 2: Weak Match (Gap Detected)
```
Query: "how to reset password for new user"
Top-1 Score: 3.2
Avg Score: 2.1
```
**Interpretation:**
- ❌ Top-1 score (3.2) < threshold (8.0) → **Weak match**
- ❌ Avg score (2.1) < threshold (5.0) → **Poor relevance**
- ❌ **GAP DETECTED** → System needs to learn this

### Example 3: Borderline Case
```
Query: "property date sync issue"
Top-1 Score: 7.5
Avg Score: 6.2
```
**Interpretation:**
- ⚠️ Top-1 score (7.5) < threshold (8.0) → **Gap detected**
- ✅ Avg score (6.2) > threshold (5.0) → But some results are relevant
- ⚠️ **GAP** — Could be improved with better KB article

---

## Why BM25 Scores Can Be High

BM25 scores are **not normalized to 0-1** like some other metrics. They can range from:
- **0** (no match) to **100+** (perfect match with many rare terms)

**Factors that increase scores:**
1. **More matching terms** → Each term adds to the score
2. **Rare terms match** → "PropertySuite" scores higher than "the"
3. **Term frequency** → If "advance" appears 5x in KB, it contributes more
4. **Document length** → Optimally-sized documents score better

**In your dataset:**
- KB articles are **detailed** (long bodies with many keywords)
- Domain-specific terms (**PropertySuite**, **ExampleCo**, etc.) are rare and valuable
- Tickets use **similar terminology** → High overlap

---

## Adjusting Thresholds

If you want to detect more gaps (stricter), increase thresholds:

```python
# Current (lenient)
GAP_THRESHOLD_TOP1 = 8.0
GAP_THRESHOLD_AVG = 5.0

# Stricter (detect more gaps)
GAP_THRESHOLD_TOP1 = 30.0  # Only very strong matches pass
GAP_THRESHOLD_AVG = 20.0
```

If you want fewer gaps (more lenient), decrease thresholds:

```python
# More lenient (detect fewer gaps)
GAP_THRESHOLD_TOP1 = 3.0
GAP_THRESHOLD_AVG = 2.0
```

---

## Summary

| Concept | Value | Meaning |
|---------|-------|---------|
| **Algorithm** | BM25 | Probabilistic ranking (like Google) |
| **Score Range** | 0 - 100+ | Not normalized, can be high |
| **Your Scores** | 26-35 | Strong matches (good KB coverage) |
| **Gap Threshold** | 8.0 (top-1) | Below this = knowledge gap |
| **Your Result** | No gaps | Seed KB already covers tickets well |

**Key Takeaway:** High scores (30+) mean the KB article is **highly relevant** to the ticket. The system is working correctly — your seed KB is just very comprehensive! 🎯
