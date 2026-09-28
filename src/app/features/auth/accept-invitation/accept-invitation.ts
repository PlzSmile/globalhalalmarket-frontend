import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TeamApi } from '../../../core/api/team-api';
import { AuthService } from '../../../core/auth/auth.service';
import { InvitationPreview, ROLE_LABELS } from '../../../core/models/auth';
import { applyServerErrorsOr, clearServerErrors, serverError } from '../../../shared/forms/server-errors';
import { PASSWORD_MIN, matchesField } from '../../../shared/forms/validators';

type State = { kind: 'loading' } | { kind: 'invalid' } | { kind: 'ready'; preview: InvitationPreview };

@Component({
  selector: 'hs-accept-invitation',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressBarModule],
  templateUrl: './accept-invitation.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcceptInvitation implements OnInit {
  readonly token = input.required<string>();

  protected readonly auth = inject(AuthService);
  private readonly api = inject(TeamApi);
  private readonly router = inject(Router);

  protected readonly roleLabels = ROLE_LABELS;
  protected readonly passwordMin = PASSWORD_MIN;
  protected readonly state = signal<State>({ kind: 'loading' });
  protected readonly busy = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly serverError = serverError;
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN)]],
    password_confirmation: ['', [Validators.required, matchesField('password')]],
  });

  constructor() {
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.form.controls.password_confirmation.updateValueAndValidity({ emitEvent: false }));
  }

  async ngOnInit(): Promise<void> {
    try {
      this.state.set({ kind: 'ready', preview: await firstValueFrom(this.api.previewInvitation(this.token())) });
    } catch {
      this.state.set({ kind: 'invalid' });
    }
  }

  async submit(): Promise<void> {
    clearServerErrors(this.form);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.formError.set(null);
    try {
      this.auth.setUser(await firstValueFrom(this.api.acceptInvitation(this.token(), this.form.getRawValue())));
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      this.formError.set(applyServerErrorsOr(this.form, error, 'This invitation could not be accepted. It may have expired.'));
    } finally {
      this.busy.set(false);
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout().catch(() => undefined);
  }
}
