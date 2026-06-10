import { Locator, test } from '@playwright/test';

/**
 * A custom Array subclass representing a list of table rows.
 * Inherits all standard Array methods while adding type-safe get and getAll capabilities.
 */
export class TableRows<T extends Record<string, any>> extends Array<T> {
  constructor(...items: T[]) {
    // Call the base Array constructor
    super(...items);
    // Explicitly set the prototype for correct inheritance in ES6 environment
    Object.setPrototypeOf(this, TableRows.prototype);
  }

  /**
   * Overloaded get method:
   * 1. rows.get('id') -> returns the 'id' value of the first row (T[K] | undefined)
   * 2. rows.get('id', 'value') -> returns the first matching row object (T | undefined)
   */
  get<K extends keyof T>(key: K): T[K] | undefined;
  get<K extends keyof T>(key: K, value: T[K]): T | undefined;
  get(key: any, value?: any): any {
    if (arguments.length === 1) {
      // Return the value of the key from the first row
      return this[0] ? this[0][key] : undefined;
    }
    // Return the first matching row
    return this.find(row => row[key] === value);
  }

  /**
   * Overloaded getAll method:
   * 1. rows.getAll('id') -> returns an array of all rows' 'id' values (T[K][])
   * 2. rows.getAll('id', 'value') -> returns an array of all matching row objects (T[])
   */
  getAll<K extends keyof T>(key: K): T[K][];
  getAll<K extends keyof T>(key: K, value: T[K]): T[];
  getAll(key: any, value?: any): any[] {
    if (arguments.length === 1) {
      // Return the values of the key from all rows
      return this.map(row => row[key]);
    }
    // Return all matching rows
    return this.filter(row => row[key] === value);
  }
}

export class Table<T extends Record<string, any>> {
  constructor(public readonly root: Locator) {}

  /**
   * Retrieves all the headers from the table as lowercase strings.
   */
  async getHeaders(): Promise<string[]> {
    return test.step(`Get headers of table`, async () => {
      const headers = await this.root.locator('th').evaluateAll(ths => 
        ths.map(th => th.textContent?.trim().toLowerCase() || '')
      );
      return headers;
    });
  }

  /**
   * Retrieves all the rows of the table as typed objects.
   * Dynamically maps table headers to object keys.
   */
  async getRows(): Promise<T[]> {
    return test.step('Get table rows', async () => {
      const headers = await this.getHeaders();
      const rowsData = await this.root.locator('tbody tr, tr[data-testid="transaction-row"]').evaluateAll((trs, headers) => {
        return trs.map(tr => {
          const cells = Array.from(tr.querySelectorAll('td')).map(td => td.textContent?.trim() || '');
          if (cells.length === 0) return null; // Skip header or empty rows
          const rowData: any = {};
          headers.forEach((header, index) => {
            if (index < cells.length && header) {
              rowData[header] = cells[index];
            }
          });
          return rowData;
        });
      }, headers);
      return rowsData.filter((r): r is any => r !== null) as T[];
    });
  }

  /**
   * Retrieves all rows from the table, returned as a custom TableRows collection
   * with type-safe finder helper methods.
   */
  async get(): Promise<TableRows<T>> {
    const rows = await this.getRows();
    return new TableRows<T>(...rows);
  }

  /**
   * Gets the total count of data rows in the table.
   */
  async getRowCount(): Promise<number> {
    return test.step('Get table row count', async () => {
      return await this.root.locator('tbody tr, tr[data-testid="transaction-row"]').evaluateAll(trs => {
        return trs.filter(tr => tr.querySelectorAll('td').length > 0).length;
      });
    });
  }

  /**
   * Retrieves the value of a specific cell by row index and column key.
   */
  async getCellValue(rowIndex: number, column: keyof T): Promise<string> {
    return test.step(`Get table cell value at row ${rowIndex}, column "${String(column)}"`, async () => {
      const headers = await this.getHeaders();
      const columnIndex = headers.indexOf(String(column).toLowerCase());
      if (columnIndex === -1) {
        throw new Error(`Column "${String(column)}" not found in table headers: ${headers.join(', ')}`);
      }

      return await this.root.evaluate((tableEl, { rowIndex, columnIndex }) => {
        const trs = Array.from(tableEl.querySelectorAll('tbody tr, tr[data-testid="transaction-row"]'));
        const dataRows = trs.filter(tr => tr.querySelectorAll('td').length > 0);
        if (rowIndex < 0 || rowIndex >= dataRows.length) {
          throw new Error(`Row index ${rowIndex} is out of bounds (0 to ${dataRows.length - 1})`);
        }
        const cell = dataRows[rowIndex].querySelectorAll('td')[columnIndex];
        return cell?.textContent?.trim() ?? '';
      }, { rowIndex, columnIndex });
    });
  }
}
