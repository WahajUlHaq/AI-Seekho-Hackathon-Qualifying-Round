import { cosineSimilarity } from "./in-memory-vector.store";

let passed = 0;
let total = 0;

function assert(name: string, condition: boolean): void {
    total++;
    if (condition) {
        console.log(`✅ ${name}: PASS`);
        passed++;
    } else {
        console.log(`❌ ${name}: FAIL`);
    }
}

// Test 1: identical vectors → ~1.0
const identical = [1, 0, 0];
const t1 = cosineSimilarity(identical, identical);
assert("Identical vectors → score ~1.0", Math.abs(t1 - 1.0) < 0.001);

// Test 2: orthogonal vectors → ~0.0
const orthoA = [1, 0, 0];
const orthoB = [0, 1, 0];
const t2 = cosineSimilarity(orthoA, orthoB);
assert("Orthogonal vectors → score ~0.0", Math.abs(t2 - 0.0) < 0.001);

// Test 3: similar vectors → > 0.85
const simA = [1, 1, 0];
const simB = [1, 0.9, 0.1];
const t3 = cosineSimilarity(simA, simB);
assert("Similar vectors → score > 0.85", t3 > 0.85);

// Test 4: zero vector → 0 (no divide-by-zero crash)
const zeroVec = [0, 0, 0];
const t4 = cosineSimilarity(zeroVec, [1, 0, 0]);
assert("Zero vector → 0 (no crash)", t4 === 0);

// Test 5: reversed sign → negative (anti-correlated)
const posVec = [1,  1,  1];
const negVec = [-1, -1, -1];
const t5 = cosineSimilarity(posVec, negVec);
assert("Anti-correlated vectors → score < 0", t5 < 0);

console.log(`\n${passed}/${total} tests passed`);
if (passed < total) process.exit(1);
