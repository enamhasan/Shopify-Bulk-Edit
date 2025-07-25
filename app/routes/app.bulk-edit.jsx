// app/routes/products.jsx
import {
  Card,
  IndexTable,
  Page,
  Text,
  Filters,
  TextField,
  Select,
  Button,
  Badge,
  useIndexResourceState,
  Spinner,
} from '@shopify/polaris';
import { useEffect, useState } from 'react';
import { json, useLoaderData } from '@remix-run/react';
import { authenticate } from '../shopify.server';

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const query = `
    {
      products(first: 50) {
        edges {
          node {
            id
            title
            tags
            productType
            totalInventory
            vendor
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
  const data = await response.json();

  const products = data.data.products.edges.map(({ node }) => ({
    id: node.id,
    title: node.title,
    tags: node.tags,
    productType: node.productType,
    vendor: node.vendor,
    inventory: node.totalInventory,
    variantId: node.variants.edges[0]?.node?.id || null,
    price: node.variants.edges[0]?.node?.price || 'N/A',
  }));

  return json({ products });
};

export default function ProductList() {
  const { products: initialProducts } = useLoaderData();
  const [products, setProducts] = useState(initialProducts);
  const [queryValue, setQueryValue] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(products);

  const handleFiltersClearAll = () => {
    setQueryValue('');
    setTagFilter('');
    setTypeFilter('');
  };

  const handleQueryChange = (value) => setQueryValue(value);
  const handleTagChange = (value) => setTagFilter(value);
  const handleTypeChange = (value) => setTypeFilter(value);
  const toggleSortDirection = () =>
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));

  const filteredProducts = products
    .filter((product) =>
      product.title.toLowerCase().includes(queryValue.toLowerCase())
    )
    .filter((product) =>
      tagFilter ? product.tags.includes(tagFilter) : true
    )
    .filter((product) =>
      typeFilter ? product.productType === typeFilter : true
    )
    .sort((a, b) =>
      sortDirection === 'asc'
        ? a.title.localeCompare(b.title)
        : b.title.localeCompare(a.title)
    );

  const rowMarkup = filteredProducts.map(
    ({ id, title, productType, tags, price, inventory }, index) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
        position={index}
      >
        <IndexTable.Cell>{title}</IndexTable.Cell>
        <IndexTable.Cell>{productType}</IndexTable.Cell>
        <IndexTable.Cell>
          {tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </IndexTable.Cell>
        <IndexTable.Cell>{price}</IndexTable.Cell>
        <IndexTable.Cell>{inventory}</IndexTable.Cell>
      </IndexTable.Row>
    )
  );

  const filters = [
    {
      key: 'tagFilter',
      label: 'Tag',
      filter: (
        <TextField
          label="Tag"
          value={tagFilter}
          onChange={handleTagChange}
          autoComplete="off"
          labelHidden
        />
      ),
      shortcut: true,
    },
    {
      key: 'typeFilter',
      label: 'Product type',
      filter: (
        <TextField
          label="Type"
          value={typeFilter}
          onChange={handleTypeChange}
          autoComplete="off"
          labelHidden
        />
      ),
      shortcut: true,
    },
  ];

  return (
    <Page
      title="Products"
      primaryAction={{
        content: 'Bulk Update Price',
        onAction: () => {
          console.log('Selected:', selectedResources);
          // Next step: Navigate to price update page or open modal
        },
        disabled: selectedResources.length === 0,
      }}
    >
      <Card>
        <div style={{ padding: '1rem' }}>
          <Filters
            queryValue={queryValue}
            filters={filters}
            onQueryChange={handleQueryChange}
            onClearAll={handleFiltersClearAll}
          />
        </div>

        <IndexTable
          resourceName={{ singular: 'product', plural: 'products' }}
          itemCount={filteredProducts.length}
          selectedItemsCount={
            allResourcesSelected ? 'All' : selectedResources.length
          }
          onSelectionChange={handleSelectionChange}
          headings={[
            { title: 'Title', isSortable: true },
            { title: 'Type' },
            { title: 'Tags' },
            { title: 'Price' },
            { title: 'Inventory' },
          ]}
        >
          {rowMarkup}
        </IndexTable>
      </Card>
    </Page>
  );
}
