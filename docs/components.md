# Components

## Table

Extract structured data from HTML tables.

```ts
import { Table } from 'pw-core/component/table';

type Row = { name: string; status: string };

const table = new Table<Row>(page.locator('table'));
const rows = await table.get();

rows.get('name');              // first row's name column
rows.get('name', 'Alice');     // row where name === 'Alice'
rows.getAll('status', 'active'); // all active rows
```

| Method | Description |
|--------|-------------|
| `getHeaders()` | Column headers (lowercase) |
| `getRows()` | All rows as typed objects |
| `get()` | Rows as a `TableRows` collection with `get` / `getAll` |
| `getRowCount()` | Number of data rows |
| `getCellValue(row, column)` | Single cell value |
