import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthApi } from '../../../core/api/auth-api';
import { AuthService } from '../../../core/auth/auth.service';

const COOLDOWN_SECONDS = 60;

@Component({
  selector: 'hs-verify-email',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <h1 class="auth-title">Check your inbox</h1>
    <p class="auth-subtitle">We sent a verification link to <strong>{{ auth.user()?.email }}</strong>. Click it to start using Global Halal Market.</p>

    @if (message(); as text) { <p class="notice notice--info" role="status">{{ text }}</p> }

    <div class="auth-form">
      <button mat-flat-button class="auth-submit" type="button" (click)="continue()">I've verified my email</button>
      <button mat-stroked-button class="auth-submit" type="button" (click)="resend()" [disabled]="cooldown() > 0">
        {{ cooldown() > 0 ? 'Resend in ' + cooldown() + ' s' : 'Resend the email' }}
      </button>
      <button mat-button class="auth-submit" type="button" (click)="logout()">
        <mat-icon svgIcon="logout" /> Log out
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmail {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);

  protected readonly cooldown = signal(0);
  protected readonly message = signal<string | null>(null);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  async resend(): Promise<void> {
    try {
      await firstValueFrom(this.api.resendVerification());
      this.message.set('A new link is on its way. It can take a minute to arrive.');
      this.startCooldown();
    } catch {
      this.message.set('We could not send the email just now. Please try again in a minute.');
    }
  }

  async continue(): Promise<void> {
    const user = await this.auth.refresh().catch(() => null);
    if (user?.email_verified) {
      await this.router.navigateByUrl('/dashboard');
    } else {
      this.message.set('Your email is not verified yet. Open the link in the email we sent you.');
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout().catch(() => undefined);
    await this.router.navigateByUrl('/login');
  }

  private startCooldown(): void {
    this.cooldown.set(COOLDOWN_SECONDS);
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.cooldown.update((s) => s - 1);
      if (this.cooldown() <= 0) clearInterval(this.timer);
    }, 1000);
  }
}
