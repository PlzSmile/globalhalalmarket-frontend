import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ComplianceCell, ComplianceStatus, Market, ProductCompliance } from '../../core/models/compliance';
import { StatusBadge } from '../../shared/ui/status-badge';
import { SAMPLE_MARKETS, SAMPLE_PRODUCTS } from './sample-data';

@Component({
  selector: 'hs-dashboard',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatTableModule, MatTooltipModule, StatusBadge],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  protected readonly markets = signal<readonly Market[]>(SAMPLE_MARKETS);
  protected readonly products = signal<readonly ProductCompliance[]>(SAMPLE_PRODUCTS);

  protected readonly columns = computed(() => ['product', ...this.markets().map((market) => market.slug)]);

  protected readonly totals = computed(() => {
    const counts: Record<ComplianceStatus, number> = { green: 0, amber: 0, red: 0 };
    for (const product of this.products()) {
      for (const cell of product.cells) {
        counts[cell.status]++;
      }
    }
    return counts;
  });

  protected cellFor(product: ProductCompliance, market: Market): ComplianceCell | null {
    return product.cells.find((cell) => cell.market === market.slug) ?? null;
  }
}
