import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Participant } from '../../../models/group-orders/participant.model';

export interface ParticipantDishQuantityChange {
  dishId: string;
  change: number;
}

@Component({
  selector: 'app-participant-card',
  imports: [CurrencyPipe],
  templateUrl: './participant-card.component.html',
  styleUrl: './participant-card.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ParticipantCardComponent {
  readonly participant = input.required<Participant>();
  readonly isMe = input(false);
  readonly canEdit = input(false);
  readonly canRemove = input(false);
  readonly removeClick = output<Participant>();
  readonly removeDish = output<string>();
  readonly quantityChange = output<ParticipantDishQuantityChange>();

  readonly title = computed(() => {
    const person = this.participant();
    if (this.isMe()) return 'My Pre-Order';
    return person.type === 'Owner' ? `Owner: ${person.name}` : `Guest: ${person.name}`;
  });
}
