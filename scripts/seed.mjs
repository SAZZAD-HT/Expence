import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import CryptoJS from 'crypto-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MASTER_KEY = process.env.MASTER_ENCRYPTION_KEY

const SEED_EMAIL = 'sazzadaiub1@gmail.com'
const SEED_PASSWORD = 'Sazzad@Secure123'
const SEED_SESSION_KEY = 'sazzad-secret-2026'

if (!SUPABASE_URL || !SERVICE_KEY || !MASTER_KEY) {
  console.error('Missing env vars. Run with: node --env-file=.env.local scripts/seed.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const prisma = new PrismaClient()

const enc = (plain) => {
  const layer2 = CryptoJS.AES.encrypt(String(plain), SEED_SESSION_KEY).toString()
  return CryptoJS.AES.encrypt(layer2, MASTER_KEY).toString()
}

async function findOrCreateUser() {
  const { data: list } = await supabase.auth.admin.listUsers()
  const existing = list?.users?.find((u) => u.email === SEED_EMAIL)
  if (existing) {
    console.log(`✓ User exists: ${SEED_EMAIL} (id=${existing.id})`)
    return existing.id
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email: SEED_EMAIL,
    password: SEED_PASSWORD,
    email_confirm: true,
  })
  if (error) throw error
  console.log(`✓ Created user: ${SEED_EMAIL} (id=${data.user.id})`)
  return data.user.id
}

async function ensureProfile(userId) {
  await prisma.profile.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, email: SEED_EMAIL },
  })
  console.log('✓ Profile ensured')
}

async function wipeUserData(userId) {
  await prisma.expense.deleteMany({ where: { user_id: userId } })
  await prisma.loan.deleteMany({ where: { user_id: userId } })
  await prisma.creditCard.deleteMany({ where: { user_id: userId } })
  await prisma.categoryMapping.deleteMany({ where: { user_id: userId } })
  await prisma.budgetSegment.deleteMany({ where: { user_id: userId } })
  await prisma.monthlySalary.deleteMany({ where: { user_id: userId } })
  console.log('✓ Cleared prior seed data')
}

async function seed(userId) {
  const essentials = await prisma.budgetSegment.create({
    data: { user_id: userId, name: 'Essentials', monthly_limit_encrypted: enc(2000000), color_tag: '#34d399' },
  })
  const lifestyle = await prisma.budgetSegment.create({
    data: { user_id: userId, name: 'Lifestyle', monthly_limit_encrypted: enc(1000000), color_tag: '#60a5fa' },
  })
  const savings = await prisma.budgetSegment.create({
    data: { user_id: userId, name: 'Savings', monthly_limit_encrypted: enc(1500000), color_tag: '#a78bfa' },
  })
  const emis = await prisma.budgetSegment.create({
    data: { user_id: userId, name: 'EMIs', monthly_limit_encrypted: enc(1000000), color_tag: '#fbbf24', is_fixed_cost: true },
  })
  console.log('✓ Budget segments')

  const groceries = await prisma.categoryMapping.create({
    data: { user_id: userId, category_name_encrypted: enc('Groceries'), segment_id: essentials.id },
  })
  const rent = await prisma.categoryMapping.create({
    data: { user_id: userId, category_name_encrypted: enc('Rent'), segment_id: essentials.id },
  })
  const dining = await prisma.categoryMapping.create({
    data: { user_id: userId, category_name_encrypted: enc('Dining'), segment_id: lifestyle.id },
  })
  const entertainment = await prisma.categoryMapping.create({
    data: { user_id: userId, category_name_encrypted: enc('Entertainment'), segment_id: lifestyle.id },
  })
  const investments = await prisma.categoryMapping.create({
    data: { user_id: userId, category_name_encrypted: enc('Investments'), segment_id: savings.id },
  })
  console.log('✓ Categories')

  const card = await prisma.creditCard.create({
    data: {
      user_id: userId,
      card_name_encrypted: enc('HDFC Millennia'),
      credit_limit_encrypted: enc(20000000),
      billing_cycle_day: 15,
      interest_free_days: 45,
      current_balance_encrypted: enc(2500000),
      minimum_due_encrypted: enc(250000),
      existing_emi_count: 0,
    },
  })
  console.log('✓ Credit card')

  await prisma.loan.create({
    data: {
      user_id: userId,
      loan_name_encrypted: enc('Home Loan'),
      principal_encrypted: enc(5000000_00),
      interest_rate_encrypted: enc('8.5'),
      start_date: '2024-06-01',
      tenure_months: 240,
      emi_amount_encrypted: enc(4339100),
      segment_id: emis.id,
    },
  })
  console.log('✓ Loan')

  await prisma.monthlySalary.create({
    data: { user_id: userId, month: '2026-04', salary_encrypted: enc(8000000) },
  })
  console.log('✓ Monthly salary')

  const expenses = [
    { date: '2026-04-01', amount: 1500000, cat: rent.id, pm: 'debit_card', desc: 'April rent' },
    { date: '2026-04-03', amount: 345000, cat: groceries.id, pm: 'credit_card', desc: 'Big Basket weekly' },
    { date: '2026-04-07', amount: 128000, cat: dining.id, pm: 'credit_card', desc: 'Dinner with family' },
    { date: '2026-04-10', amount: 49900, cat: entertainment.id, pm: 'credit_card', desc: 'Netflix + Spotify' },
    { date: '2026-04-15', amount: 500000, cat: investments.id, pm: 'debit_card', desc: 'SIP — index fund' },
    { date: '2026-04-18', amount: 212000, cat: groceries.id, pm: 'cash', desc: 'Local market' },
    { date: '2026-04-21', amount: 89000, cat: dining.id, pm: 'credit_card', desc: 'Cafe brunch' },
    { date: '2026-04-23', amount: 175000, cat: entertainment.id, pm: 'debit_card', desc: 'Concert tickets' },
  ]
  for (const e of expenses) {
    await prisma.expense.create({
      data: {
        user_id: userId,
        amount_encrypted: enc(e.amount),
        category_id: e.cat,
        payment_method: e.pm,
        credit_card_id: e.pm === 'credit_card' ? card.id : null,
        description_encrypted: enc(e.desc),
        expense_date: e.date,
      },
    })
  }
  console.log(`✓ ${expenses.length} expenses`)
}

async function main() {
  const userId = await findOrCreateUser()
  await ensureProfile(userId)
  await wipeUserData(userId)
  await seed(userId)
  console.log('\nDone. Login credentials:')
  console.log(`  Email:       ${SEED_EMAIL}`)
  console.log(`  Password:    ${SEED_PASSWORD}`)
  console.log(`  Session key: ${SEED_SESSION_KEY}`)
  console.log(`  Access code: earlyaccess2026`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
