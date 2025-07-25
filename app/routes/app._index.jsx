import {
  Page,
  IndexTable,
  Text,
  useIndexResourceState,
  Card,
  Button,
  Filters,
  Modal,
  TextField,
  InlineStack,
  Box,
  useBreakpoints,
  Spinner,
} from '@shopify/polaris';
import {useLoaderData, useSubmit} from '@remix-run/react';
import {json} from '@remix-run/node';
import {authenticate} from '../shopify.server';
import {useState} from 'react';

export const loader = async ({request}) => {
  const {admin} = await authenticate.admin(request);

  const query = `
    {
      products(first: 50) {
        edges {
          node {
            id
            title
            productType
            tags
            handle
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
    }
  `;

  const response = await admin.graphql(query);
  const result = await response.json();

  const products = result.data.products.edges.map(({node}) => ({
    id: node.id,
    title: node.title,
    type: node.productType,
    tags: node.tags,
    price: node.variants.edges[0]?.node?.price ?? '',
    variantId: node.variants.edges[0]?.node?.id ?? '',
  }));

  return json({products});
};

export default function Products() {
  const {products} = useLoaderData();
  const [modalOpen, setModalOpen] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
  } = useIndexResourceState(products);

  const selectedProducts = products.filter((product) =>
    selectedResources.includes(product.id),
  );

  const handleBulkEdit = () => {
    setModalOpen(true);
  };

  const handleSubmitPriceChange = async () => {
    setLoading(true);

    await Promise.all(
      selectedProducts.map(async (product) => {
        await fetch('/api/update-price', {
          method: 'POST',
          body: JSON.stringify({
            variantId: product.variantId,
            newPrice,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }),
    );

    setLoading(false);
    setModalOpen(false);
  };

  return (
    <Page
      title="Products"
      primaryAction={
        <Button
          onClick={handleBulkEdit}
          disabled={selectedResources.length === 0}
        >
          Bulk Edit Price
        </Button>
      }
    >
      <Card>
        <IndexTable
          resourceName={{singular: 'product', plural: 'products'}}
          itemCount={products.length}
          selectedItemsCount={
            allResourcesSelected ? 'All' : selectedResources.length
          }
          onSelectionChange={handleSelectionChange}
          headings={[
            {title: 'Title'},
            {title: 'Type'},
            {title: 'Tags'},
            {title: 'Price'},
          ]}
        >
          {products.map(({id, title, type, tags, price}, index) => (
            <IndexTable.Row
              id={id}
              key={id}
              selected={selectedResources.includes(id)}
              position={index}
            >
              <IndexTable.Cell>{title}</IndexTable.Cell>
              <IndexTable.Cell>{type}</IndexTable.Cell>
              <IndexTable.Cell>{tags.join(', ')}</IndexTable.Cell>
              <IndexTable.Cell>${price}</IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Bulk Edit Prices"
        primaryAction={{
          content: 'Update Prices',
          onAction: handleSubmitPriceChange,
          disabled: loading || !newPrice,
        }}
        secondaryActions={[{content: 'Cancel', onAction: () => setModalOpen(false)}]}
      >
        <Modal.Section>
          <InlineStack gap="400" align="center">
            <TextField
              label="New Price"
              type="number"
              value={newPrice}
              onChange={setNewPrice}
              autoComplete="off"
            />
            {loading && <Spinner accessibilityLabel="Updating prices" size="small" />}
          </InlineStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
