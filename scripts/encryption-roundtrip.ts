/**
 * Full two-layer encryption round-trip verification.
 *
 * Simulates the complete data flow:
 *   plaintext
 *     → Layer 2 encrypt (session key, client-side in memory)
 *     → Layer 1 encrypt (master key, server-side)
 *     → [persisted shape that would go to Supabase]
 *     → Layer 1 decrypt (master key, server)
 *     → Layer 2 decrypt (session key, client)
 *     → plaintext
 *
 * Also verifies negative cases:
 *   - wrong session key fails to decrypt Layer 2
 *   - wrong master key fails to decrypt Layer 1
 *
 * Usage: `npx tsx scripts/encryption-roundtrip.ts`
 * Exits 0 on success, 1 on any failure.
 */

import { encrypt, decrypt } from '../lib/encryption'

type Case = { label: string; plaintext: string }

const cases: Case[] = [
  { label: 'ASCII amount', plaintext: '125000' },
  { label: 'Expense note with spaces', plaintext: 'Groceries at Shwapno — 2026-04-20' },
  { label: 'Bengali unicode', plaintext: 'মাসিক বাজেট ৳১২,৫০০' },
  { label: 'Long payload', plaintext: 'x'.repeat(4096) },
  { label: 'JSON blob', plaintext: JSON.stringify({ principal: 500000, rate: 0.12, months: 24 }) },
  { label: 'Empty-ish', plaintext: ' ' },
]

const MASTER = 'test-master-key-32chars-aaaaaaaa'
const SESSION = 'test-session-key-user-entered-01'
const WRONG_MASTER = 'test-master-key-32chars-bbbbbbbb'
const WRONG_SESSION = 'test-session-key-user-entered-99'

let failures = 0
const fail = (msg: string) => {
  failures++
  console.error(`  ✗ ${msg}`)
}
const pass = (msg: string) => console.log(`  ✓ ${msg}`)

console.log('Two-layer encryption round-trip\n')

for (const c of cases) {
  console.log(`Case: ${c.label}`)

  const layer2 = encrypt(c.plaintext, SESSION)
  const layer1 = encrypt(layer2, MASTER)

  if (layer1 === c.plaintext) fail('ciphertext equals plaintext')
  if (layer1 === layer2) fail('Layer 1 and Layer 2 ciphertext match (no second pass)')

  const afterL1 = decrypt(layer1, MASTER)
  if (afterL1 !== layer2) fail('Layer 1 decrypt did not return Layer 2 ciphertext')

  const afterL2 = decrypt(afterL1, SESSION)
  if (afterL2 !== c.plaintext) {
    fail(`round-trip mismatch: got ${JSON.stringify(afterL2.slice(0, 40))}…`)
  } else {
    pass('round-trip matches plaintext')
  }

  try {
    const bad = decrypt(layer1, WRONG_MASTER)
    if (bad === layer2) fail('wrong master key still decrypted Layer 1')
    else pass('wrong master key does not recover Layer 2 ciphertext')
  } catch {
    pass('wrong master key throws (expected)')
  }

  try {
    const bad = decrypt(afterL1, WRONG_SESSION)
    if (bad === c.plaintext) fail('wrong session key still decrypted Layer 2')
    else pass('wrong session key does not recover plaintext')
  } catch {
    pass('wrong session key throws (expected)')
  }

  console.log('')
}

if (failures > 0) {
  console.error(`\nFAILED — ${failures} assertion(s) failed.`)
  process.exit(1)
}
console.log('All round-trips passed.')
