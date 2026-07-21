import { buildLocationCode } from './location-code.util';

describe('buildLocationCode', () => {
  it('builds RM-E01 format uppercase', () => {
    expect(
      buildLocationCode({
        warehouseCode: 'entcot',
        zone: 'a',
        aisle: '01',
        rack: '02',
        bin: 'c3',
      }),
    ).toBe('ENTCOT-A-01-02-C3');
  });

  it('trims segments', () => {
    expect(
      buildLocationCode({
        warehouseCode: ' ENT ',
        zone: ' B ',
        aisle: ' 1 ',
        rack: ' 2 ',
        bin: ' X ',
      }),
    ).toBe('ENT-B-1-2-X');
  });
});
