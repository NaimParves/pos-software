import { useUser } from './auth'
import { useCollection } from './db'
import { SHOP } from '../config/shop'
import { LABOR_PER_CARTOON } from '../config/invoiceModes'
import { blankTemplate } from '../config/templates'

const pick = (...vals) => vals.find((v) => v !== undefined && v !== null && String(v).trim() !== '')

// The shop details printed on every report and document. Priority:
// Template Settings > Global Report Header, then the signed-in user's branch
// (Basic Settings > Add Branch), then the defaults in config/shop.js.
export function useShop() {
  const user = useUser()
  const branches = useCollection('branches')
  const settings = useCollection('templateSettings')[0] || {}
  const found = branches.find((b) => b.name === user?.branch) || branches[0] || {}
  // a branch's details are used once its Organization Name is filled in on Add
  // Branch, so an old branch record with placeholder details changes nothing
  const branch = found.organization ? found : { paperSize: found.paperSize, laborPerCarton: found.laborPerCarton }
  const h = settings.header || {}
  const phone = pick(h.mobile, branch.phone, SHOP.phone)
  return {
    ...SHOP,
    name: pick(h.name, branch.organization, SHOP.name),
    branchName: branch.name || '',
    address: pick(h.address, branch.address, SHOP.address),
    phone,
    mobiles: pick(h.mobile, branch.phone) ? String(phone).split(/\s*,\s*/) : SHOP.mobiles,
    email: pick(h.email, branch.email, ''),
    website: pick(h.website, branch.website, ''),
    dealer: pick(h.dealer, ''),
    logo: pick(h.logo, branch.logo, SHOP.logo),
    paperSize: branch.paperSize || 'A4',
    laborPerCarton: Number(pick(branch.laborPerCarton, LABOR_PER_CARTOON)),
  }
}

// Design settings for one template category (see config/templates.js)
export function useTemplate(kind) {
  const settings = useCollection('templateSettings')[0] || {}
  const key = settings.useForAll ? settings.allKind || 'sale' : kind
  return { ...blankTemplate(), ...(settings.categories?.[key] || {}) }
}
