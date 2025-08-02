// app/routes/api.update-price.jsx
import { json } from '@remix-run/node';
import { authenticate } from '../shopify.server';
import shopify from '../shopify.server';

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);

  try {
    const body = await request.json(); // Expecting { products: [ { id, newPrice } ] }
    const { products } = body;

    if (!products || !Array.isArray(products)) {
      return json({ error: 'Invalid payload' }, { status: 400 });
    }

    for (const product of products) {
      const { id, newPrice } = product;

      // Update the first variant price only (simplified)
      const productData = await admin.graphql(`
        query {
          product(id: "${id}") {
            variants(first: 1) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      `);

      const variantId =
        productData.body.data.product?.variants.edges?.[0]?.node.id;

      if (!variantId) continue;

      // Update price
      await admin.graphql(`
        mutation {
          productVariantUpdate(input: {
            id: "${variantId}",
            price: "${newPrice}"
          }) {
            productVariant {
              id
              price
            }
            userErrors {
              field
              message
            }
          }
        }
      `);
    }

    return json({ success: true });
  } catch (err) {
    console.error('Error updating products:', err);
    return json({ error: 'Server error' }, { status: 500 });
  }
}
