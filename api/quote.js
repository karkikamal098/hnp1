/*
 * api/quote.js — RFQ intake.
 *
 * Receives the contact.html quote form and turns it into real Shopify records:
 * a customer, and a draft order tagged RFQ. Sales then prices the draft order
 * in admin and sends the invoice; the customer sees it when they log in at
 * hnpbuilding.com/account. That is the whole portal — no bespoke UI.
 *
 * Runs as a serverless function. The handler is the Web-standard
 * (Request) => Response shape, which both Vercel Functions and Netlify
 * Functions v2 accept unchanged. See api/README.md for wiring.
 *
 * Required environment variables (never commit these):
 *   SHOPIFY_STORE_DOMAIN   j1rk0j-9d.myshopify.com — the store's permanent
 *                          admin domain, not the public hnpbuilding.com
 *   SHOPIFY_ADMIN_TOKEN    Admin API access token, scopes:
 *                          read_customers, write_customers,
 *                          read_draft_orders, write_draft_orders
 * Optional:
 *   RESEND_API_KEY         if set, emails SALES_MAILBOX on each new RFQ
 *   SALES_MAILBOX          defaults to sales@hnpbuilding.com
 */

const API_VERSION = '2026-04';
const SALES_MAILBOX = process.env.SALES_MAILBOX || 'sales@hnpbuilding.com';

/* The form posts from the static site, which is served from a different origin
 * than the function host until/unless they share a domain. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

async function shopify(query, variables) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!domain || !token) throw new Error('Shopify credentials are not configured');

  const r = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!r.ok) throw new Error(`Shopify HTTP ${r.status}`);
  const body = await r.json();
  // GraphQL returns 200 with an errors array, so a bare r.ok check is not enough.
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  return body.data;
}

/* `email` is a tokenized search field — an unquoted value matches on word
 * fragments and can return the wrong customer. Quoting forces an exact match.
 * The inner quotes are escaped for the search-syntax string, not for GraphQL. */
const FIND_CUSTOMER = `
  query findCustomer($q: String!) {
    customers(first: 1, query: $q) { nodes { id } }
  }`;

const CREATE_CUSTOMER = `
  mutation createCustomer($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer { id }
      userErrors { field message }
    }
  }`;

const CREATE_DRAFT_ORDER = `
  mutation createDraftOrder($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder { id name }
      userErrors { field message }
    }
  }`;

async function findOrCreateCustomer({ email, name, company, phone }) {
  const found = await shopify(FIND_CUSTOMER, { q: `email:"${email}"` });
  const existing = found.customers.nodes[0];
  if (existing) return existing.id;

  // The form collects a single free-text name; split on the first space so the
  // admin customer list is sorted sensibly, rather than guessing at more.
  const [firstName, ...rest] = name.trim().split(/\s+/);
  const input = {
    email,
    firstName,
    lastName: rest.join(' ') || undefined,
    phone: phone || undefined,
    note: company ? `Company: ${company}` : undefined,
    tags: ['RFQ'],
  };

  const created = await shopify(CREATE_CUSTOMER, { input });
  const errs = created.customerCreate.userErrors;
  if (errs.length) {
    /* A phone number Shopify considers invalid is the common failure here, and
     * it must not cost us the enquiry — retry once without the optional fields. */
    const retry = await shopify(CREATE_CUSTOMER, {
      input: { email, firstName, lastName: rest.join(' ') || undefined, tags: ['RFQ'] },
    });
    const retryErrs = retry.customerCreate.userErrors;
    if (retryErrs.length) throw new Error(retryErrs.map((e) => e.message).join('; '));
    return retry.customerCreate.customer.id;
  }
  return created.customerCreate.customer.id;
}

async function createDraftOrder(customerId, f) {
  const note = [
    `Project:  ${f.project}`,
    `Material: ${f.material}`,
    `Company:  ${f.company}`,
    f.phone ? `Phone:    ${f.phone}` : null,
    '',
    f.details || '(no additional detail supplied)',
  ]
    .filter((l) => l !== null)
    .join('\n');

  const input = {
    purchasingEntity: { customerId },
    email: f.email,
    note,
    tags: ['RFQ', 'website'],
    /* A draft order must carry at least one line item, so the RFQ opens with a
     * zero-priced placeholder naming the project. Sales replaces it with the
     * real priced items when quoting — it is a slot, not a product. */
    lineItems: [
      {
        title: `Quote pending — ${f.project}`,
        quantity: 1,
        originalUnitPrice: '0',
        requiresShipping: true,
      },
    ],
    metafields: [
      { namespace: 'rfq', key: 'project', type: 'single_line_text_field', value: f.project },
      { namespace: 'rfq', key: 'material', type: 'single_line_text_field', value: f.material },
      { namespace: 'rfq', key: 'company', type: 'single_line_text_field', value: f.company },
    ],
  };

  const res = await shopify(CREATE_DRAFT_ORDER, { input });
  const errs = res.draftOrderCreate.userErrors;
  if (errs.length) throw new Error(errs.map((e) => e.message).join('; '));
  return res.draftOrderCreate.draftOrder;
}

/* Best-effort only. Sales already sees the draft order in admin, so a mail
 * provider outage must never fail the request and lose the enquiry. */
async function notifySales(draftOrder, f) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: SALES_MAILBOX,
        to: SALES_MAILBOX,
        reply_to: f.email,
        subject: `RFQ ${draftOrder.name} — ${f.project} (${f.company})`,
        text: [
          `${f.name} at ${f.company} requested a quote.`,
          ``,
          `Project:  ${f.project}`,
          `Material: ${f.material}`,
          `Email:    ${f.email}`,
          f.phone ? `Phone:    ${f.phone}` : ``,
          ``,
          f.details || '(no additional detail supplied)',
          ``,
          `Draft order ${draftOrder.name} is waiting in Shopify admin.`,
        ].join('\n'),
      }),
    });
  } catch {
    // swallowed on purpose — see comment above
  }
}

const REQUIRED = ['name', 'email', 'company', 'project', 'material'];

/*
 * Exported as named HTTP-method handlers, NOT as `export default function
 * handler(req, res)`. Vercel treats a default export as the legacy Node
 * (request, response) signature: it passes Node's req/res, ignores whatever
 * the function returns, and waits for res.end() that never comes — so the
 * endpoint hangs until the platform times it out rather than erroring. Named
 * method exports select the Web-standard Request/Response contract this file
 * is written against. Unlisted methods get a 405 from the platform.
 */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request) {
  let f;
  try {
    // site.js posts FormData; accept JSON too so the endpoint is easy to test.
    const type = request.headers.get('content-type') || '';
    if (type.includes('application/json')) {
      f = await request.json();
    } else {
      f = Object.fromEntries(await request.formData());
    }
  } catch {
    return json(400, { error: 'Could not read the submitted form' });
  }

  // Honeypot. site.js strips this before sending, but a bot posting directly
  // to this endpoint will not, so the check has to live here too.
  if (f.website) return json(200, { ok: true });

  const missing = REQUIRED.filter((k) => !String(f[k] || '').trim());
  if (missing.length) return json(400, { error: `Missing required field(s): ${missing.join(', ')}` });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return json(400, { error: 'Invalid email address' });

  try {
    const customerId = await findOrCreateCustomer(f);
    const draftOrder = await createDraftOrder(customerId, f);
    await notifySales(draftOrder, f);
    return json(200, { ok: true, reference: draftOrder.name });
  } catch (err) {
    /* Log for us, stay vague for the caller — error text can leak store detail.
     * A non-2xx makes site.js show its "email or call us" fallback, so the
     * enquiry still has somewhere to go. */
    console.error('RFQ intake failed:', err);
    return json(502, { error: 'Could not record the request' });
  }
}
