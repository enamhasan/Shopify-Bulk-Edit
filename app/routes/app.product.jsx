import {
  TextField,
  IndexTable,
  LegacyCard,
  IndexFilters,
  useSetIndexFiltersMode,
  useIndexResourceState,
  Text,
  ChoiceList,
  Badge,
  useBreakpoints,
  Thumbnail,
} from '@shopify/polaris';
import { useState, useCallback, useMemo } from 'react';
import { useLoaderData } from '@remix-run/react';
import shopify from '../shopify.server';
import { json } from '@remix-run/node';

export async function loader({ request }) {
  const { admin } = await shopify.authenticate.admin(request);
  const response = await admin.graphql(`
    {
      products(first: 20) {
        nodes {
          id
          title
          status
          vendor
          productType
          variants(first: 1) {
            nodes {
              price
            }
          }
          images(first: 1) {
            edges {
              node {
                originalSrc
                altText
              }
            }
          }
        }
      }
    }
  `);

  const parsed = await response.json();
  const products = parsed.data.products.nodes;
  return json({ products });
}

export default function ProductsIndexTable() {
  const { products } = useLoaderData();

  const [views, setViews] = useState(['All', 'Active', 'Draft', 'Archived']);
  const [selectedViewIndex, setSelectedViewIndex] = useState(0);
  const [sortSelected, setSortSelected] = useState(['title asc']);
  const [queryValue, setQueryValue] = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  const [vendorFilter, setVendorFilter] = useState('');
  const { mode, setMode } = useSetIndexFiltersMode();
  const breakpoints = useBreakpoints();

  const deleteView = (index) => {
    const newViews = [...views];
    newViews.splice(index, 1);
    setViews(newViews);
    setSelectedViewIndex(0);
  };

  const filters = [
    {
      key: 'status',
      label: 'Status',
      filter: (
        <ChoiceList
          title="Product status"
          titleHidden
          choices={[
            { label: 'Active', value: 'ACTIVE' },
            { label: 'Draft', value: 'DRAFT' },
            { label: 'Archived', value: 'ARCHIVED' },
          ]}
          selected={statusFilter}
          onChange={setStatusFilter}
          allowMultiple
        />
      ),
      shortcut: true,
    },
    {
      key: 'vendor',
      label: 'Vendor',
      filter: (
        <TextField
          label="Vendor"
          value={vendorFilter}
          onChange={setVendorFilter}
          autoComplete="off"
          labelHidden
        />
      ),
    },
  ];

  const appliedFilters = [];
  if (statusFilter.length > 0) {
    appliedFilters.push({
      key: 'status',
      label: `Status: ${statusFilter.join(', ')}`,
      onRemove: () => setStatusFilter([]),
    });
  }
  if (vendorFilter) {
    appliedFilters.push({
      key: 'vendor',
      label: `Vendor: ${vendorFilter}`,
      onRemove: () => setVendorFilter(''),
    });
  }

  const handleClearAll = () => {
    setStatusFilter([]);
    setVendorFilter('');
    setQueryValue('');
  };

  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchesQuery =
        queryValue === '' || prod.title.toLowerCase().includes(queryValue.toLowerCase());
      const matchesStatus =
        statusFilter.length === 0 || statusFilter.includes(prod.status);
      const matchesVendor =
        vendorFilter === '' || prod.vendor?.toLowerCase().includes(vendorFilter.toLowerCase());
      return matchesQuery && matchesStatus && matchesVendor;
    });
  }, [products, queryValue, statusFilter, vendorFilter]);

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(filteredProducts);

  const rowMarkup = filteredProducts.map((product, index) => {
    const image = product.images?.edges?.[0]?.node;
    const price = product.variants?.nodes?.[0]?.price || '—';

    return (
      <IndexTable.Row
        id={product.id}
        key={product.id}
        selected={selectedResources.includes(product.id)}
        position={index}
      >
        <IndexTable.Cell>
          <Thumbnail
            source={image?.originalSrc || 'https://via.placeholder.com/50'}
            alt={image?.altText || 'Product image'}
          />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text fontWeight="bold">{product.title}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text>{product.vendor}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{product.productType || '—'}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge>{product.status}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>${price}</IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <LegacyCard>
      <IndexFilters
        queryValue={queryValue}
        queryPlaceholder="Search products"
        onQueryChange={setQueryValue}
        onQueryClear={() => setQueryValue('')}
        sortOptions={[
          { label: 'Title', value: 'title asc', directionLabel: 'A-Z' },
          { label: 'Title', value: 'title desc', directionLabel: 'Z-A' },
          { label: 'Price', value: 'price asc', directionLabel: 'Lowest' },
          { label: 'Price', value: 'price desc', directionLabel: 'Highest' },
        ]}
        sortSelected={sortSelected}
        onSort={setSortSelected}
        tabs={views.map((v, i) => ({
          content: v,
          index: i,
          id: `${v}-${i}`,
          isLocked: i === 0,
          actions: i === 0 ? [] : [
            {
              type: 'rename',
              onAction: () => {},
              onPrimaryAction: async (value) => {
                const updated = [...views];
                updated[i] = value;
                setViews(updated);
                return true;
              },
            },
            {
              type: 'duplicate',
              onPrimaryAction: async (value) => {
                setViews([...views, value]);
                setSelectedViewIndex(views.length);
                return true;
              },
            },
            {
              type: 'delete',
              onPrimaryAction: async () => {
                deleteView(i);
                return true;
              },
            },
          ],
        }))}
        selected={selectedViewIndex}
        onSelect={setSelectedViewIndex}
        canCreateNewView
        filters={filters}
        appliedFilters={appliedFilters}
        onClearAll={handleClearAll}
        mode={mode}
        setMode={setMode}
        primaryAction={{
          type: selectedViewIndex === 0 ? 'save-as' : 'save',
          onAction: async () => true,
        }}
      />
      <IndexTable
        resourceName={{ singular: 'product', plural: 'products' }}
        itemCount={filteredProducts.length}
        selectedItemsCount={
          allResourcesSelected ? 'All' : selectedResources.length
        }
        onSelectionChange={handleSelectionChange}
        headings={[
          { title: '' },
          { title: 'Title' },
          { title: 'Vendor' },
          { title: 'Type' },
          { title: 'Status' },
          { title: 'Price', alignment: 'end' },
        ]}
        condensed={breakpoints.smDown}
      >
        {rowMarkup}
      </IndexTable>
    </LegacyCard>
  );
}
