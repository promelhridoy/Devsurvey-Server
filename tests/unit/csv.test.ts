import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '../../src/utils/csv';

describe('csvCell', () => {
  it('leaves plain text alone', () => {
    expect(csvCell('hello')).toBe('hello');
  });
  it('quotes commas, quotes and newlines (RFC 4180)', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });
  it('neutralizes spreadsheet formula injection', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvCell('+1+1')).toBe("'+1+1");
    expect(csvCell('-2')).toBe("'-2");
    expect(csvCell('@cmd')).toBe("'@cmd");
  });
  it('handles null and undefined as empty', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });
});

describe('toCsv', () => {
  it('writes a header and CRLF-separated rows', () => {
    expect(toCsv(['a', 'b'], [[1, 'x,y']])).toBe('a,b\r\n1,"x,y"\r\n');
  });
  it('writes only the header when there are no rows', () => {
    expect(toCsv(['a', 'b'], [])).toBe('a,b\r\n');
  });
});
