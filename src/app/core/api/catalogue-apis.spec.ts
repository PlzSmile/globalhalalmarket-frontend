import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProductsApi } from './products-api';
import { IngredientsApi } from './ingredients-api';
import { SuppliersApi } from './suppliers-api';
import { CountriesApi } from './countries-api';

describe('catalogue APIs', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists products with search and page, omitting an empty search', () => {
    const api = TestBed.inject(ProductsApi);
    api.list('sau', 2).subscribe();
    backend.expectOne((r) => r.url === '/api/v1/products' && r.params.get('search') === 'sau' && r.params.get('page') === '2').flush({ data: [], meta: {} });
    api.list('', 1).subscribe();
    backend.expectOne((r) => r.url === '/api/v1/products' && !r.params.has('search')).flush({ data: [], meta: {} });
  });

  it('links an ingredient by id or by name', () => {
    const api = TestBed.inject(ProductsApi);
    api.linkIngredient(7, { id: 3 }).subscribe();
    expect(backend.expectOne({ method: 'POST', url: '/api/v1/products/7/ingredients' }).request.body).toEqual({ ingredient_id: 3 });
    api.linkIngredient(7, { name: 'Gelatin' }).subscribe();
    const req = backend.expectOne({ method: 'POST', url: '/api/v1/products/7/ingredients' });
    expect(req.request.body).toEqual({ name: 'Gelatin' });
    req.flush({ data: { id: 7, name: 'P', sku: null, ingredients: [] } });
  });

  it('searches ingredients and links a supplier', () => {
    const api = TestBed.inject(IngredientsApi);
    api.search('gel').subscribe();
    backend.expectOne((r) => r.url === '/api/v1/ingredients' && r.params.get('search') === 'gel').flush({ data: [] });
    api.linkSupplier(3, { id: 5 }).subscribe();
    expect(backend.expectOne({ method: 'POST', url: '/api/v1/ingredients/3/suppliers' }).request.body).toEqual({ supplier_id: 5 });
  });

  it('maps supplier search to id/name pairs', () => {
    let result: unknown;
    TestBed.inject(SuppliersApi).search('ac').subscribe((r) => (result = r));
    backend.expectOne((r) => r.url === '/api/v1/suppliers' && r.params.get('search') === 'ac')
      .flush({ data: [{ id: 5, name: 'Acme', country: null, ingredients_count: 0 }], meta: {} });
    expect(result).toEqual([{ id: 5, name: 'Acme' }]);
  });

  it('loads countries once', () => {
    const api = TestBed.inject(CountriesApi);
    api.list().subscribe();
    api.list().subscribe();
    backend.expectOne('/api/v1/reference/countries').flush({ data: [{ code: 'GB', name: 'United Kingdom' }] });
  });
});
