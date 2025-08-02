import {
  Page,
  Card,
  TextField,
  Select,
  Button,
  IndexTable,
  Text,
  InlineStack,
  Box,
  Divider,
} from '@shopify/polaris';
import {useLoaderData, useNavigate} from '@remix-run/react';
import {json} from '@remix-run/node';
import {authenticate} from '../shopify.server';
import {useEffect, useMemo, useState} from 'react';

export const loader = async ({request}) => {
  const {admin} = await authenticate.admin(request);
  const url = new URL(request.url);
  const ids = url.searchParams.get('ids')?.split(',') || [];

  const query = `
    query {
      nodes(ids: [${ids.map((id) => `"${id}"`).join(',')}]) {
        ... on Product {
          id
          title
          variants(first: 1) {
            edges {
              node {
                id
                price
              }
            }
          }
        }
      }
    }
  `;

  const response = await admin.graphql(query);
  const result = await response.json();

  const products = result.data.nodes.map((product) => ({
    id: product.id,
    title: product.title,
    price: parseFloat(product.variants.edges[0].node.price),
    variantId: product.variants.edges[0].node.id,
  }));

  return json({products});
};

export default function BulkEditPage() {
  const {products} = useLoaderData();
  const navigate = useNavigate();

  const [editType, setEditType] = useState('percent');
  const [amount, setAmount] = useState('10');
  const [isIncreasing, setIsIncreasing] = useState(true);
  const [loading, setLoading] = useState(false);

  const editedProducts = useMemo(() => {
    const amt = parseFloat(amount);
    return products.map((p) => {
      let newPrice = p.price;
      if (editType === 'percent') {
        newPrice = isIncreasing
          ? p.price * (1 + amt / 100)
          : p.price * (1 - amt / 100);
      } else {
        newPrice = isIncreasing ? p.price + amt : p.price - amt;
      }
      return {...p, newPrice: newPrice.toFixed(2)};
    });
  }, [products, amount, editType, isIncreasing]);

  const handleRunEdit = async () => {
    setLoading(true);
    await Promise.all(
      editedProducts.map((product) =>
        fetch('/app/api/update-price', {
          method: 'POST',
          body: JSON.stringify({
            variantId: product.variantId,
            newPrice: product.newPrice,
          }),
          headers: {'Content-Type': 'application/json'},
        }),
      ),
    );
    setLoading(false);
    navigate('/app');
  };  

  return (
    <Page
      title="Configure modifications"
      primaryAction={{
        content: loading ? 'Updating...' : 'Run Edit',
        onAction: handleRunEdit,
        disabled: loading,
      }}
      secondaryActions={[
        {content: 'Back to Products', url: '/app'},
      ]}
    >
      <Card>
        <Box paddingBlockEnd="400">
          <Text variant="headingMd" as="h2">
            Price
          </Text>
        </Box>

        <InlineStack gap="400" wrap={false}>
          <TextField label="Field to edit" value="Price" disabled />
          <Select
            label="How to edit"
            options={[
              {label: 'Increase by percent', value: 'percent'},
              {label: 'Decrease by percent', value: 'percent-decrease'},
              {label: 'Increase by amount', value: 'amount'},
              {label: 'Decrease by amount', value: 'amount-decrease'},
            ]}
            onChange={(val) => {
              setEditType(val.includes('percent') ? 'percent' : 'amount');
              setIsIncreasing(!val.includes('decrease'));
            }}
            value={
              isIncreasing
                ? editType === 'percent'
                  ? 'percent'
                  : 'amount'
                : editType === 'percent'
                  ? 'percent-decrease'
                  : 'amount-decrease'
            }
          />
          <TextField
            label={
              editType === 'percent'
                ? `${isIncreasing ? 'Increase' : 'Decrease'} by %`
                : `${isIncreasing ? 'Increase' : 'Decrease'} by amount`
            }
            value={amount}
            type="number"
            onChange={setAmount}
            suffix={editType === 'percent' ? '%' : '$'}
          />
        </InlineStack>
      </Card>

      <Divider />

      <Card title={`Previewing ${editedProducts.length} products`}>
        <IndexTable
          resourceName={{singular: 'product', plural: 'products'}}
          itemCount={editedProducts.length}
          headings={[
            {title: 'Product'},
            {title: 'Original Price'},
            {title: 'New Price'},
          ]}
          selectable={false}
        >
          {editedProducts.map(({id, title, price, newPrice}, index) => (
            <IndexTable.Row id={id} key={id} position={index}>
              <IndexTable.Cell>{title}</IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span" tone="subdued" lineThrough>
                  ${price}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span">${newPrice}</Text>
              </IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </Card>
    </Page>
  );
}
