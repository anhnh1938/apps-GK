#!/usr/bin/env node
// Cài Firebase cho apps-GK một lệnh: publish Firestore rules + tạo gk_members + tạo tài khoản đăng nhập.
//
//   npm run setup:firebase -- --dry-run     # chỉ kiểm tra, không sửa gì
//   npm run setup:firebase                  # làm thật
//
// Tuỳ chọn:
//   --env <đường dẫn>   file .env chứa khoá service account (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
//                       FIREBASE_PRIVATE_KEY). Mặc định: D:/projects/my-apps/.env.local — đọc tại chỗ, không chép khoá.
//   --members <file>    danh sách người dùng. Mặc định: firebase/members.local.json (mẫu: firebase/members.example.json)
//   --force-rules       vẫn publish rules dù rules đang chạy khác cả bản my-apps lẫn bản GK (ai đó đã sửa tay)
//   --sample            thêm dữ liệu mẫu: 4 sản phẩm mặc định + 2 báo giá + 4 đơn áo (ID cố định, chạy lại thì ghi đè)
//   --remove-sample     xoá dữ liệu mẫu đã thêm
//
// Gọi thẳng REST API của Google bằng khoá service account (không cần cài firebase-admin).
// Service account bỏ qua Firestore rules, nên ghi được gk_members dù rules chặn ghi từ trình duyệt.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MY_APPS_RULES = 'D:/projects/my-apps/firestore.rules'
const GK_RULES = path.join(ROOT, 'firebase/firestore.rules')

// ---------- tham số ----------
const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const opt = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const DRY = flag('--dry-run')
const FORCE_RULES = flag('--force-rules')
const SAMPLE = flag('--sample')
const REMOVE_SAMPLE = flag('--remove-sample')
const ENV_FILE = opt('--env', process.env.GK_ADMIN_ENV || 'D:/projects/my-apps/.env.local')
const MEMBERS_FILE = path.resolve(ROOT, opt('--members', 'firebase/members.local.json'))

const log = (...a) => console.log(...a)
const ok = (m) => log(`  ✓ ${m}`)
const warn = (m) => log(`  ⚠ ${m}`)
const todo = (m) => log(`  → ${DRY ? '(chạy thử) sẽ ' : ''}${m}`)
const fail = (m) => {
  console.error(`\n✗ ${m}`)
  process.exit(1)
}

// ---------- đọc khoá service account ----------
function readEnv(file) {
  if (!fs.existsSync(file)) fail(`Không thấy file ${file}. Dùng --env <file> để chỉ file .env có khoá service account.`)
  const text = fs.readFileSync(file, 'utf8')
  const env = {}
  // Hỗ trợ cả KEY="...\n..." (1 dòng có \n) lẫn giá trị trong ngoặc kép kéo nhiều dòng
  const re = /^([A-Z0-9_]+)=("([\s\S]*?)"|'([\s\S]*?)'|.*)$/gm
  for (const m of text.matchAll(re)) env[m[1]] = m[3] ?? m[4] ?? m[2].trim()
  return env
}
const env = readEnv(ENV_FILE)
const PROJECT = env.FIREBASE_PROJECT_ID
const CLIENT_EMAIL = env.FIREBASE_CLIENT_EMAIL
const PRIVATE_KEY = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
if (!PROJECT || !CLIENT_EMAIL || !PRIVATE_KEY.includes('PRIVATE KEY'))
  fail(`${ENV_FILE} thiếu FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.`)

// ---------- access token (JWT ký bằng khoá service account) ----------
const b64url = (buf) => Buffer.from(buf).toString('base64url')
async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(
    JSON.stringify({
      iss: CLIENT_EMAIL,
      scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${claim}`), PRIVATE_KEY)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claim}.${b64url(sig)}`,
    }),
  })
  const body = await res.json()
  if (!res.ok) fail(`Không lấy được access token: ${JSON.stringify(body)}`)
  return body.access_token
}

let TOKEN
async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    // Không gửi x-goog-user-project: header đó đòi thêm quyền serviceusage.services.use; service account
    // thuộc chính project này nên quota tự tính vào project.
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text }
  }
  return { ok: res.ok, status: res.status, json }
}
const errMsg = (r) => r.json?.error?.message || r.json?.raw || `HTTP ${r.status}`

// ---------- 1. Rules ----------
const norm = (s) => s.replace(/\r/g, '').replace(/[ \t]+$/gm, '').trim()

async function setupRules() {
  log('\n[1] Firestore rules')
  const gkRules = fs.readFileSync(GK_RULES, 'utf8')

  // Biên dịch thử bản GK (không tạo gì trên Firebase)
  const test = await api('POST', `https://firebaserules.googleapis.com/v1/projects/${PROJECT}:test`, {
    source: { files: [{ name: 'firestore.rules', content: gkRules }] },
  })
  const issues = test.json?.issues ?? []
  if (test.status === 403) {
    warn(`Service account không có quyền quản lý rules (${errMsg(test)}).`)
    warn('→ Dán tay: Firebase Console → Firestore Database → Rules → dán toàn bộ firebase/firestore.rules → Publish.')
    return
  }
  if (!test.ok || issues.some((i) => i.severity === 'ERROR'))
    fail(`firebase/firestore.rules có lỗi: ${issues.length ? JSON.stringify(issues, null, 2) : errMsg(test)}`)
  ok('firebase/firestore.rules biên dịch được')

  // Rules đang chạy
  const rel = await api('GET', `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases/cloud.firestore`)
  let live = null
  if (rel.ok) {
    const rs = await api('GET', `https://firebaserules.googleapis.com/v1/${rel.json.rulesetName}`)
    if (!rs.ok) fail(`Không đọc được rules đang chạy: ${errMsg(rs)}`)
    live = rs.json.source.files.map((f) => f.content).join('\n')
  } else if (rel.status !== 404) fail(`Không đọc được rules đang chạy: ${errMsg(rel)}`)

  if (live != null && norm(live) === norm(gkRules)) return ok('Rules đang chạy đã là bản GK — không cần publish')

  const myApps = fs.existsSync(MY_APPS_RULES) ? fs.readFileSync(MY_APPS_RULES, 'utf8') : null
  if (live != null && (!myApps || norm(live) !== norm(myApps)) && !FORCE_RULES) {
    fail(
      'Rules đang chạy khác cả bản my-apps lẫn bản GK (có người đã sửa trên Console?). ' +
        'Xem bản sao lưu sau khi chạy với --dry-run, gộp phần thiếu vào firebase/firestore.rules, hoặc chạy lại với --force-rules.',
    )
  }
  if (live != null) ok('Rules đang chạy = bản của my-apps (chỉ chặn CV) — an toàn để thay bằng bản GK (giữ nguyên phần CV)')

  // Sao lưu rules đang chạy
  if (live != null) {
    const dir = path.join(ROOT, 'firebase/backup')
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, `firestore.rules.${new Date().toISOString().replace(/[:.]/g, '-')}.bak`)
    fs.writeFileSync(file, live)
    ok(`Đã sao lưu rules đang chạy: ${path.relative(ROOT, file)}`)
  }

  todo('publish firebase/firestore.rules')
  if (DRY) return
  const created = await api('POST', `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/rulesets`, {
    source: { files: [{ name: 'firestore.rules', content: gkRules }] },
  })
  if (!created.ok) fail(`Tạo ruleset lỗi: ${errMsg(created)}`)
  const release = { name: `projects/${PROJECT}/releases/cloud.firestore`, rulesetName: created.json.name }
  const r = rel.ok
    ? await api('PATCH', `https://firebaserules.googleapis.com/v1/${release.name}`, { release })
    : await api('POST', `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases`, release)
  if (!r.ok) fail(`Publish rules lỗi: ${errMsg(r)}`)
  ok('Đã publish rules')
  warn(`Nhớ chép firebase/firestore.rules sang ${MY_APPS_RULES}, nếu không lần deploy rules sau từ my-apps sẽ xoá quyền của GK`)
}

// ---------- 2. Danh sách người dùng ----------
function readMembers() {
  if (!fs.existsSync(MEMBERS_FILE)) {
    fail(
      `Không thấy ${path.relative(ROOT, MEMBERS_FILE)}. Copy firebase/members.example.json thành firebase/members.local.json ` +
        'và điền email / tên / mật khẩu.',
    )
  }
  const list = JSON.parse(fs.readFileSync(MEMBERS_FILE, 'utf8'))
  if (!Array.isArray(list) || !list.length) fail('File danh sách người dùng phải là mảng, có ít nhất 1 người.')
  return list.map((m, i) => {
    const email = String(m.email || '').trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(`Người thứ ${i + 1}: email không hợp lệ (${m.email})`)
    if (m.password != null && String(m.password).length < 6) fail(`${email}: mật khẩu phải từ 6 ký tự`)
    return { email, name: String(m.name || email), role: m.role === 'admin' ? 'admin' : 'staff', password: m.password }
  })
}

const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

async function setupMembers(members) {
  log('\n[2] Collection gk_members (quyền dùng app)')
  for (const m of members) {
    const url =
      `${FS}/gk_members/${encodeURIComponent(m.email)}` +
      '?updateMask.fieldPaths=name&updateMask.fieldPaths=role&updateMask.fieldPaths=updatedAt'
    const existing = await api('GET', `${FS}/gk_members/${encodeURIComponent(m.email)}`)
    if (!existing.ok && existing.status !== 404) fail(`Không đọc được gk_members/${m.email}: ${errMsg(existing)}`)
    const verb = existing.ok ? 'cập nhật' : 'tạo'
    todo(`${verb} gk_members/${m.email}  { name: "${m.name}", role: "${m.role}" }`)
    if (DRY) continue
    const r = await api('PATCH', url, {
      fields: {
        name: { stringValue: m.name },
        role: { stringValue: m.role },
        updatedAt: { timestampValue: new Date().toISOString() },
      },
    })
    if (!r.ok) fail(`Ghi gk_members/${m.email} lỗi: ${errMsg(r)}`)
    ok(`Đã ${verb} gk_members/${m.email}`)
  }
}

// ---------- 3. Tài khoản đăng nhập ----------
const IDT = 'https://identitytoolkit.googleapis.com'

async function setupAuth(members) {
  log('\n[3] Authentication (tài khoản đăng nhập)')
  const cfg = await api('GET', `${IDT}/admin/v2/projects/${PROJECT}/config`)
  if (!cfg.ok) {
    warn(
      `Authentication chưa được bật cho project (${errMsg(cfg)}). Mở Firebase Console → Build → Authentication → ` +
        'bấm "Get started" một lần, rồi chạy lại lệnh này để tạo tài khoản.',
    )
    return
  }
  if (cfg.json?.signIn?.email?.enabled && cfg.json.signIn.email.passwordRequired !== false) {
    ok('Đăng nhập Email/Mật khẩu đã bật')
  } else {
    todo('bật đăng nhập Email/Mật khẩu')
    if (!DRY) {
      const r = await api(
        'PATCH',
        `${IDT}/admin/v2/projects/${PROJECT}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired`,
        { signIn: { email: { enabled: true, passwordRequired: true } } },
      )
      if (!r.ok) fail(`Bật Email/Mật khẩu lỗi: ${errMsg(r)}`)
      ok('Đã bật đăng nhập Email/Mật khẩu')
    }
  }

  for (const m of members) {
    const found = await api('POST', `${IDT}/v1/projects/${PROJECT}/accounts:lookup`, { email: [m.email] })
    if (!found.ok) fail(`Tra tài khoản ${m.email} lỗi: ${errMsg(found)}`)
    if (found.json.users?.length) {
      ok(`${m.email}: đã có tài khoản (không đổi mật khẩu)`)
      continue
    }
    if (!m.password) {
      warn(`${m.email}: chưa có tài khoản và không có "password" trong file → bỏ qua (tạo tay trong Authentication → Users)`)
      continue
    }
    todo(`tạo tài khoản ${m.email}`)
    if (DRY) continue
    const r = await api('POST', `${IDT}/v1/projects/${PROJECT}/accounts`, {
      email: m.email,
      password: String(m.password),
      displayName: m.name,
    })
    if (!r.ok) fail(`Tạo tài khoản ${m.email} lỗi: ${errMsg(r)}`)
    ok(`Đã tạo tài khoản ${m.email}`)
  }
}

// ---------- 4. Dữ liệu mẫu ----------
// Chuyển object JS → kiểu giá trị của Firestore REST API
function fsValue(v) {
  if (v === null) return { nullValue: null }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (Array.isArray(v)) return { arrayValue: v.length ? { values: v.map(fsValue) } : {} }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  return { mapValue: { fields: fsFields(v) } }
}
const fsFields = (o) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, fsValue(v)]))

// Sản phẩm + cách tính phải giống src/features/products/catalog.ts và src/features/quote/calc.ts
const tierList = (prices) => [1, 10, 20, 50, 100].map((min, i) => ({ min, price: prices[i] }))
const CATALOG = {
  chu: { type: 'tag', name: 'Tag in chữ', active: true, note: '', tiers: tierList([28000, 25000, 22000, 20000, 18000]), price: null, colors: [], sizes: [], spec: '', sortOrder: 1 },
  hinh: { type: 'tag', name: 'Tag in hình', active: true, note: '', tiers: tierList([33000, 30000, 27000, 25000, 23000]), price: null, colors: [], sizes: [], spec: '', sortOrder: 2 },
  thun: { type: 'shirt', name: 'Áo thun', active: true, note: 'Giá đã gồm tối đa 2 tag', tiers: [], price: 229000, colors: ['Xanh than', 'Trắng', 'Đen'], sizes: ['XS', 'S', 'M', 'L', 'XL'], spec: 'Cotton 100% · 250 gsm · Regular · Unisex, cổ tròn', sortOrder: 3 },
  polo: { type: 'shirt', name: 'Áo polo', active: true, note: 'Giá đã gồm tối đa 2 tag', tiers: [], price: 269000, colors: ['Đen', 'Trắng', 'Xanh than'], sizes: ['M', 'L', 'XL', '2XL'], spec: 'Spandex Polyester Lacoste · 250 gsm · Regular fit, cổ bẻ', sortOrder: 4 },
}
const PRODUCTS = ['chu', 'hinh'].map((id) => ({ id, name: CATALOG[id].name, tiers: CATALOG[id].tiers }))
function quoteTotals(items, ship) {
  const byProduct = {}
  for (const it of items) byProduct[it.productId] = (byProduct[it.productId] ?? 0) + it.qty
  let qty = 0
  let goods = 0
  for (const it of items) {
    const p = PRODUCTS.find((x) => x.id === it.productId)
    let price = it.price
    if (p && !it.manual) {
      const tier = [...p.tiers].reverse().find((t) => byProduct[it.productId] >= t.min) ?? p.tiers[0]
      price = tier?.price ?? null
    }
    qty += it.qty
    goods += (price ?? 0) * it.qty
  }
  return { qty, goods, grand: goods + (ship ?? 0) }
}
const orderTotals = (items, ship) => {
  const qty = items.reduce((s, it) => s + it.qty, 0)
  const goods = items.reduce((s, it) => s + (it.price ?? 0) * it.qty, 0)
  return { qty, goods, grand: goods + (ship ?? 0) }
}
const NO_SHIPPING = { carrier: '', trackingCode: '', printedAt: null }

function sampleDocs() {
  const now = Date.now()
  const at = (hoursAgo) => new Date(now - hoursAgo * 3600_000)
  const today = new Date().toISOString().slice(0, 10)
  const by = 'seed-script'
  const steps = ['unpaid', 'paid', 'shipped']
  const statusAtOf = (status, hoursAgo) =>
    Object.fromEntries(steps.slice(0, steps.indexOf(status) + 1).map((s, i) => [s, at(hoursAgo - i * 4)]))
  const tag = (id, productId, color, size, qty) => ({ id, productId, name: '', color, size, qty, price: null, manual: false })
  const quoteBase = {
    title: 'BẢNG GIÁ TAG IN',
    subtitle: 'Kích thước: 4 × 6 cm · 3 × 5 cm · 1.5 × 6 cm',
    notes: 'Màu in: In đầy đủ màu theo thiết kế.\nĐơn giá tính theo số lượng của từng loại tag.',
    font: 'inter',
    showPriceTables: true,
    showPayment: true,
    products: PRODUCTS,
    date: today,
    shipping: NO_SHIPPING,
    seed: true,
  }

  const q1Items = [tag('s1a', 'chu', 'Be', '4 × 6 cm', 42), tag('s1b', 'hinh', 'Trắng', '3 × 5 cm', 3)]
  const q2Items = [tag('s2a', 'chu', 'Trắng', '1.5 × 6 cm', 12)]
  const quotes = {
    'sample-quote-1': {
      ...quoteBase,
      customer: { name: 'Chị Lan (mẫu)', phone: '0900 000 001', address: 'Quận 1, TP.HCM' },
      items: q1Items,
      ship: 20000,
      // Mở "Mẫu câu" để xem các câu tách từ nội dung in này
      printContent: [
        '1. Mỗi ngày cố gắng,',
        'hãy nhớ luôn có em',
        'tự hào về anh.',
        '2. Gửi anh một cái ôm',
        'dưới hình hài chiếc áo.',
        '3. Chúc mừng sinh nhật!',
        'Mong mọi điều tốt đẹp',
        'sẽ đến với bạn 🎂',
        '4. Cảm ơn vì đã luôn ở bên 💙',
        '5. Hy vọng chiếc áo này',
        'sẽ thay em ôm anh',
        'qua những ngày gió lạnh.',
      ].join('\n'),
      status: 'unpaid',
      paidPercent: null,
      statusAt: statusAtOf('unpaid', 30),
      totals: quoteTotals(q1Items, 20000),
      createdAt: at(30),
      createdBy: by,
      updatedAt: at(30),
      updatedBy: by,
    },
    'sample-quote-2': {
      ...quoteBase,
      customer: { name: 'Anh Minh (mẫu)', phone: '0900 000 002', address: 'Cầu Giấy, Hà Nội' },
      items: q2Items,
      ship: 0,
      printContent: '1. Happy Men’s Day\n19.11\n2. Cảm ơn anh\nvì tất cả\n3. Luôn vui vẻ nhé!',
      status: 'paid',
      paidPercent: 50,
      statusAt: statusAtOf('paid', 26),
      totals: quoteTotals(q2Items, 0),
      createdAt: at(26),
      createdBy: by,
      updatedAt: at(22),
      updatedBy: by,
    },
  }

  const shirt = (id, productId, color, size, qty) => ({
    id,
    productId,
    name: CATALOG[productId].name,
    color,
    size,
    qty,
    price: CATALOG[productId].price,
  })
  const order = (n, status, paidPercent, recipient, items, extra, hoursAgo) => {
    const ship = extra.ship ?? null
    return [
      `sample-order-${n}`,
      {
        recipient,
        items,
        tagContent: extra.tagContent ?? '',
        embroideryContent: extra.embroideryContent ?? '',
        ship,
        note: extra.note ?? '',
        status,
        paidPercent,
        statusAt: statusAtOf(status, hoursAgo),
        shipping: extra.shipping ?? NO_SHIPPING,
        totals: orderTotals(items, ship),
        createdAt: at(hoursAgo),
        createdBy: by,
        updatedAt: at(Math.max(0, hoursAgo - 4 * steps.indexOf(status))),
        updatedBy: by,
        seed: true,
      },
    ]
  }
  const orders = Object.fromEntries([
    order(
      1,
      'unpaid',
      null,
      { name: 'Nguyễn Văn A (mẫu)', phone: '0900 000 011', address: '12 Lê Lợi, Quận 1, TP.HCM' },
      [shirt('o1a', 'thun', 'Đen', 'L', 1)],
      { tagContent: 'Tag cổ: Gửi anh một cái ôm\nTag gấu: 16.11.2026', ship: 30000 },
      2,
    ),
    order(
      2,
      'paid',
      100,
      { name: 'Trần Thị B (mẫu)', phone: '0900 000 012', address: '45 Trần Phú, Hải Châu, Đà Nẵng' },
      [shirt('o2a', 'polo', 'Trắng', 'M', 2)],
      { embroideryContent: 'Ngực trái: “T&L”, chỉ nâu', ship: 30000, note: 'Gói quà, kèm thiệp' },
      12,
    ),
    order(
      3,
      'paid',
      50,
      { name: 'Lê Văn C (mẫu)', phone: '0900 000 013', address: '8 Nguyễn Huệ, Huế' },
      [shirt('o3a', 'thun', 'Xanh than', 'S', 1), shirt('o3b', 'polo', 'Đen', 'XL', 1)],
      { tagContent: 'Tag tay: For someone special', embroideryContent: 'Thêu tên “Cường” sau cổ', ship: 0 },
      28,
    ),
    order(
      4,
      'shipped',
      100,
      { name: 'Phạm Thị D (mẫu)', phone: '0900 000 014', address: '99 Hai Bà Trưng, Hoàn Kiếm, Hà Nội' },
      [shirt('o4a', 'thun', 'Trắng', 'M', 3)],
      { tagContent: 'Tag gấu: Team GK 2026', shipping: { carrier: 'GHTK', trackingCode: 'S20261116001', printedAt: null } },
      50,
    ),
  ])
  const products = Object.fromEntries(
    Object.entries(CATALOG).map(([id, p]) => [id, { ...p, createdAt: at(72), createdBy: by, updatedAt: at(72), updatedBy: by }]),
  )
  return { gk_products: products, gk_quotes: quotes, gk_orders: orders }
}

async function setupSample() {
  log(`\n[4] Dữ liệu mẫu${REMOVE_SAMPLE ? ' — xoá' : ''}`)
  for (const [collection, docs] of Object.entries(sampleDocs())) {
    for (const [id, data] of Object.entries(docs)) {
      const url = `${FS}/${collection}/${id}`
      if (REMOVE_SAMPLE) {
        todo(`xoá ${collection}/${id}`)
        if (DRY) continue
        const r = await api('DELETE', url)
        if (!r.ok && r.status !== 404) fail(`Xoá ${collection}/${id} lỗi: ${errMsg(r)}`)
        ok(`Đã xoá ${collection}/${id}`)
        continue
      }
      const label =
        collection === 'gk_products'
          ? `${data.name} (${data.type === 'tag' ? 'mác áo' : 'áo'})`
          : `${data.customer?.name ?? data.recipient?.name}, ${data.status}, tổng ${data.totals.grand.toLocaleString('vi-VN')}đ`
      todo(`ghi ${collection}/${id} — ${label}`)
      if (DRY) continue
      // PATCH không có updateMask = thay cả document → chạy lại không nhân đôi
      const r = await api('PATCH', url, { fields: fsFields(data) })
      if (!r.ok) fail(`Ghi ${collection}/${id} lỗi: ${errMsg(r)}`)
      ok(`Đã ghi ${collection}/${id}`)
    }
  }
}

// ---------- chạy ----------
log(`Firebase project: ${PROJECT}${DRY ? '   — CHẠY THỬ, không sửa gì' : ''}`)
log(`Khoá service account: ${ENV_FILE}`)
TOKEN = await getAccessToken()
if (REMOVE_SAMPLE) {
  await setupSample()
  log(DRY ? '\nChạy thử xong.' : '\nĐã xoá dữ liệu mẫu.')
  process.exit(0)
}
log(`Danh sách người dùng: ${path.relative(ROOT, MEMBERS_FILE)}`)
const members = readMembers()
await setupRules()
await setupMembers(members)
await setupAuth(members)
if (SAMPLE) await setupSample()
log(
  DRY
    ? '\nChạy thử xong. Chạy lại không có --dry-run để làm thật.'
    : '\nXong. Nên xoá các "password" trong file danh sách sau khi mọi người đã đăng nhập và đổi mật khẩu.',
)
