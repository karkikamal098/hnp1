# RFQ intake — deployment

[`quote.js`](quote.js) turns a submission from [`../contact.html`](../contact.html) into a Shopify
customer and a draft order tagged `RFQ`. Sales prices the draft order in admin and sends the
invoice; the customer sees it at `hnpbuilding.com/account`.

The GraphQL operations were validated against Admin API `2026-04`.

## 1. Shopify admin

- **Settings → Customer accounts** — already on the new passwordless version, nothing to change.
  The portal lives at `https://shopify.com/58040320129/account`, and `hnpbuilding.com/account`
  302-redirects to it (verified), which is what the "Client login" links across the site point at.
  Sign-in method is a one-time email code; **Authentication → Manage** adjusts that if needed.
- **Settings → Apps and sales channels → Develop apps** → create an app, grant
  `read_customers`, `write_customers`, `read_draft_orders`, `write_draft_orders`, and install it.
  Copy the Admin API access token.

## 2. Environment variables

Set these on the host. **Never commit them.**

| Variable | Required | Notes |
|---|---|---|
| `SHOPIFY_STORE_DOMAIN` | yes | `j1rk0j-9d.myshopify.com` — the store's permanent admin domain, **not** `hnpbuilding.com` and not `hnpbuilding.myshopify.com` (that one 404s). Verified against the live store: it serves the same 78 products |
| `SHOPIFY_ADMIN_TOKEN` | yes | from step 1 |
| `RESEND_API_KEY` | no | if set, emails sales on each RFQ. Without it, the draft order in admin is the only notification |
| `SALES_MAILBOX` | no | defaults to `sales@hnpbuilding.com` |

## 3. Host wiring

The handler is the Web-standard `(Request) => Response` shape, so it runs unmodified on either host.

**Vercel** — works as-is. `api/quote.js` is served at `/api/quote`, which is what
`QUOTE_ENDPOINT` in [`../assets/site.js`](../assets/site.js) already points at. Nothing to configure.

**Netlify** — Functions v2 uses the same handler signature but a different directory. Either move
the file to `netlify/functions/quote.mjs`, or keep it here and add to `netlify.toml`:

```toml
[functions]
  directory = "api"

[[redirects]]
  from = "/api/quote"
  to   = "/.netlify/functions/quote"
  status = 200
```

If the function ends up on a different origin than the static site, change `QUOTE_ENDPOINT` to the
absolute URL. CORS is already open on the function.

## 4. Testing

```bash
curl -X POST https://<host>/api/quote \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Architect","email":"test@example.com","company":"Test Studio",
       "project":"Portal smoke test","material":"Corten Steel","details":"Ignore."}'
```

Expect `{"ok":true,"reference":"#D1"}`. Then check:

1. A customer for `test@example.com` exists in Shopify admin, tagged `RFQ`.
2. A draft order tagged `RFQ` + `website` exists, with the project detail in its note and a
   `Quote pending — …` placeholder line item.
3. Log in at `hnpbuilding.com/account` as that customer and confirm the quote is visible.
4. Delete the test draft order and customer.

To confirm the safety net, point `QUOTE_ENDPOINT` at a bad path and submit the form — it should
open a pre-filled email rather than lose the enquiry.

## Note on the placeholder line item

Shopify requires every draft order to carry at least one line item, so the RFQ opens with a
zero-priced `Quote pending — {project}` item. It is a slot for sales to replace when quoting, not
a product. Don't be alarmed by the $0 draft orders in admin — that is an RFQ awaiting pricing.
