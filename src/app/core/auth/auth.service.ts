import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthApi } from '../api/auth-api';
import { CurrentUser, LoginRequest, RegisterRequest } from '../models/auth';

/** Who is logged in. Loaded once from GET /api/v1/me; screens and guards read the signals. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApi);
  private readonly state = signal<CurrentUser | null>(null);
  private loaded = false;

  readonly user = this.state.asReadonly();
  readonly isLoggedIn = computed(() => this.state() !== null);
  readonly isVerified = computed(() => this.state()?.email_verified === true);
  readonly canManageTeam = computed(() => {
    const role = this.state()?.role;
    return role === 'owner' || role === 'admin';
  });

  /** Loads the current user on first call; later calls return the cached value. */
  async ensureLoaded(): Promise<CurrentUser | null> {
    return this.loaded ? this.state() : this.refresh();
  }

  async refresh(): Promise<CurrentUser | null> {
    try {
      this.state.set(await firstValueFrom(this.api.me()));
    } catch (error) {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        throw error;
      }
      this.state.set(null);
    } finally {
      this.loaded = true;
    }
    return this.state();
  }

  async login(body: LoginRequest): Promise<CurrentUser> {
    return this.setUser(await firstValueFrom(this.api.login(body)));
  }

  async register(body: RegisterRequest): Promise<CurrentUser> {
    return this.setUser(await firstValueFrom(this.api.register(body)));
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.logout());
    } finally {
      this.clear();
    }
  }

  setUser(user: CurrentUser): CurrentUser {
    this.state.set(user);
    this.loaded = true;
    return user;
  }

  clear(): void {
    this.state.set(null);
    this.loaded = true;
  }
}
