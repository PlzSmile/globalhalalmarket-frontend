import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { CurrentUser } from '../models/auth';

const USER: CurrentUser = {
  id: 1, name: 'Aisha', email: 'aisha@example.com', role: 'owner', email_verified: true, company: { id: 5, name: 'Khan Foods' },
};

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the current user once', async () => {
    const first = service.ensureLoaded();
    http.expectOne('/api/v1/me').flush({ data: USER });
    expect(await first).toEqual(USER);

    expect(await service.ensureLoaded()).toEqual(USER);
    http.expectNone('/api/v1/me');
    expect(service.isLoggedIn()).toBe(true);
    expect(service.canManageTeam()).toBe(true);
  });

  it('treats 401 as logged out', async () => {
    const result = service.ensureLoaded();
    http.expectOne('/api/v1/me').flush({ message: 'Unauthenticated.' }, { status: 401, statusText: 'Unauthorized' });
    expect(await result).toBeNull();
    expect(service.isLoggedIn()).toBe(false);
  });

  it('logs in after fetching the CSRF cookie', async () => {
    const result = service.login({ email: 'aisha@example.com', password: 'secret-secret', remember: false });
    http.expectOne('/sanctum/csrf-cookie').flush(null, { status: 204, statusText: 'No Content' });
    const login = http.expectOne('/api/v1/auth/login');
    expect(login.request.method).toBe('POST');
    login.flush({ data: USER });
    expect(await result).toEqual(USER);
    expect(service.user()).toEqual(USER);
  });

  it('clears the user on logout even if the request fails', async () => {
    service.setUser(USER);
    const result = service.logout();
    http.expectOne('/sanctum/csrf-cookie').flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne('/api/v1/auth/logout').flush({}, { status: 500, statusText: 'Server Error' });
    await result.catch(() => undefined);
    expect(service.user()).toBeNull();
  });
});
